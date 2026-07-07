/**
 * Analysis Engine
 * Performs all institutional momentum calculations:
 * - Volume Analysis
 * - Option Chain Analysis
 * - Open Interest Analysis
 * - Strike-Level Dynamic Support/Resistance
 * - Expected Momentum & Price Targets
 * - Momentum Classification
 * - Institutional Momentum Score
 */

import type {
  VolumeAnalysis,
  OptionChainAnalysis,
  OIAnalysis,
  DynamicSupportResistance,
  StrikeLevelSR,
  ExpectedMomentum,
  MomentumClassification,
  MomentumDirection,
  MomentumStrength,
  InstitutionalScore,
  ScannedStock,
  OptionStrikeData,
} from "./types";
import type { UpstoxFullQuote, UpstoxOptionChainEntry } from "./upstox-api";

// ---- Previous snapshot storage for OI comparison ----
const previousSnapshots: Map<
  string,
  {
    oi: number;
    volume: number;
    price: number;
    timestamp: number;
    strikeOI?: Map<number, { callOI: number; putOI: number }>;
  }
> = new Map();

/**
 * Filter 1: Volume Analysis
 */
export function analyzeVolume(
  symbol: string,
  currentVolume: number,
  avgPrice: number,
  open: number,
  _high: number,
  _low: number,
  ltp: number
): VolumeAnalysis {
  const prev = previousSnapshots.get(symbol);
  const now = new Date();
  const marketOpenHour = 9;
  const marketOpenMin = 15;
  const hoursElapsed =
    now.getHours() +
    now.getMinutes() / 60 -
    (marketOpenHour + marketOpenMin / 60);
  const totalMarketHours = 6.25;
  const timeProgress = Math.max(0.05, Math.min(1, hoursElapsed / totalMarketHours));

  const prevVolume = prev?.volume || 0;
  const estimatedFullDayVolume = currentVolume > 0 ? currentVolume / timeProgress : 0;
  const avgVolume = estimatedFullDayVolume > 0 ? estimatedFullDayVolume : 1;
  const expectedVolumeByNow = avgVolume * timeProgress;
  const relativeVolume = expectedVolumeByNow > 0 ? currentVolume / expectedVolumeByNow : 0;
  const volumeSpike = relativeVolume > 1.5;
  const intradayVolumeGrowth = prevVolume > 0 ? ((currentVolume - prevVolume) / prevVolume) * 100 : 0;

  let volumeScore = 0;
  if (relativeVolume >= 3) volumeScore += 40;
  else if (relativeVolume >= 2) volumeScore += 30;
  else if (relativeVolume >= 1.5) volumeScore += 25;
  else if (relativeVolume >= 1.2) volumeScore += 15;
  else if (relativeVolume >= 1) volumeScore += 10;
  else volumeScore += Math.floor(relativeVolume * 10);

  if (volumeSpike) volumeScore += 20;
  if (intradayVolumeGrowth > 50) volumeScore += 20;
  else if (intradayVolumeGrowth > 20) volumeScore += 15;
  else if (intradayVolumeGrowth > 10) volumeScore += 10;
  else if (intradayVolumeGrowth > 0) volumeScore += 5;

  const priceChange = ltp - open;
  const priceVolCorrelation = priceChange !== 0 && currentVolume > 0
    ? Math.abs(priceChange / open) * relativeVolume * 100 : 0;
  if (priceVolCorrelation > 5) volumeScore += 20;
  else if (priceVolCorrelation > 2) volumeScore += 15;
  else if (priceVolCorrelation > 1) volumeScore += 10;
  else volumeScore += Math.min(10, Math.floor(priceVolCorrelation * 2));

  volumeScore = Math.min(100, Math.max(0, volumeScore));

  return {
    currentVolume,
    avgVolume: Math.round(avgVolume),
    relativeVolume: parseFloat(relativeVolume.toFixed(2)),
    volumeSpike,
    intradayVolumeGrowth: parseFloat(intradayVolumeGrowth.toFixed(2)),
    volumeScore,
  };
}

/**
 * Filter 2: Option Chain Analysis
 */
export function analyzeOptionChain(
  chainData: UpstoxOptionChainEntry[]
): OptionChainAnalysis | null {
  if (!chainData || chainData.length === 0) return null;

  const strikes: OptionStrikeData[] = [];
  let highestCallOI = { strike: 0, oi: 0 };
  let highestPutOI = { strike: 0, oi: 0 };
  let highestCallChangeOI = { strike: 0, changeOI: 0 };
  let highestPutChangeOI = { strike: 0, changeOI: 0 };
  let totalCallOI = 0;
  let totalPutOI = 0;
  let totalCallChangeOI = 0;
  let totalPutChangeOI = 0;

  for (const entry of chainData) {
    const callOI = entry.call_options?.market_data?.oi || 0;
    const putOI = entry.put_options?.market_data?.oi || 0;
    const callPrevOI = entry.call_options?.market_data?.prev_oi || 0;
    const putPrevOI = entry.put_options?.market_data?.prev_oi || 0;
    const callChangeOI = callOI - callPrevOI;
    const putChangeOI = putOI - putPrevOI;
    const callVolume = entry.call_options?.market_data?.volume || 0;
    const putVolume = entry.put_options?.market_data?.volume || 0;
    const callLTP = entry.call_options?.market_data?.ltp || 0;
    const putLTP = entry.put_options?.market_data?.ltp || 0;
    const callIV = entry.call_options?.option_greeks?.iv || 0;
    const putIV = entry.put_options?.option_greeks?.iv || 0;

    strikes.push({
      strikePrice: entry.strike_price,
      expiryDate: entry.expiry,
      callOI,
      putOI,
      callChangeOI,
      putChangeOI,
      callVolume,
      putVolume,
      callLTP,
      putLTP,
      callIV,
      putIV,
      pcr: entry.pcr || (callOI > 0 ? putOI / callOI : 0),
      underlyingSpotPrice: entry.underlying_spot_price,
    });

    totalCallOI += callOI;
    totalPutOI += putOI;
    totalCallChangeOI += callChangeOI;
    totalPutChangeOI += putChangeOI;

    if (callOI > highestCallOI.oi) {
      highestCallOI = { strike: entry.strike_price, oi: callOI };
    }
    if (putOI > highestPutOI.oi) {
      highestPutOI = { strike: entry.strike_price, oi: putOI };
    }
    if (callChangeOI > highestCallChangeOI.changeOI) {
      highestCallChangeOI = { strike: entry.strike_price, changeOI: callChangeOI };
    }
    if (putChangeOI > highestPutChangeOI.changeOI) {
      highestPutChangeOI = { strike: entry.strike_price, changeOI: putChangeOI };
    }
  }

  const overallPCR = totalCallOI > 0 ? totalPutOI / totalCallOI : 0;

  return {
    highestCallOI,
    highestPutOI,
    highestCallChangeOI,
    highestPutChangeOI,
    totalCallOI,
    totalPutOI,
    totalCallChangeOI,
    totalPutChangeOI,
    overallPCR: parseFloat(overallPCR.toFixed(4)),
    strikes,
  };
}

/**
 * Filter 3: Open Interest Analysis
 */
export function analyzeOI(
  symbol: string,
  currentOI: number,
  prevOI: number
): OIAnalysis {
  const prev = previousSnapshots.get(symbol);
  const changeInOI = currentOI - prevOI;
  const oiChangePercent = prevOI > 0 ? (changeInOI / prevOI) * 100 : 0;

  let oiTrend: "increasing" | "decreasing" | "stable" = "stable";
  if (changeInOI > 0) oiTrend = "increasing";
  else if (changeInOI < 0) oiTrend = "decreasing";

  const prevOISnapshot = prev?.oi || 0;
  const prevChange = prevOISnapshot > 0 ? currentOI - prevOISnapshot : 0;
  const oiAccelerating = changeInOI > 0 && prevChange > 0 && changeInOI > prevChange;
  const oiUnwinding = changeInOI < 0 && Math.abs(changeInOI) > Math.abs(prevChange);

  let positionStrength: "strengthening" | "weakening" | "neutral" = "neutral";
  if (oiTrend === "increasing" && !oiUnwinding) positionStrength = "strengthening";
  else if (oiTrend === "decreasing" || oiUnwinding) positionStrength = "weakening";

  return {
    currentOI,
    previousOI: prevOI,
    changeInOI,
    oiChangePercent: parseFloat(oiChangePercent.toFixed(2)),
    oiTrend,
    oiAccelerating,
    oiUnwinding,
    positionStrength,
  };
}

/**
 * Determine strength category based on OI relative to max
 */
function getStrengthCategory(oi: number, maxOI: number): "very_strong" | "strong" | "moderate" | "weak" {
  if (maxOI === 0) return "weak";
  const ratio = oi / maxOI;
  if (ratio >= 0.8) return "very_strong";
  if (ratio >= 0.5) return "strong";
  if (ratio >= 0.25) return "moderate";
  return "weak";
}

/**
 * Get OI direction from change values
 */
function getOIDirection(changeOI: number, oi: number): "increasing" | "decreasing" | "flat" {
  if (oi === 0) return "flat";
  const pct = (changeOI / oi) * 100;
  if (pct > 2) return "increasing";
  if (pct < -2) return "decreasing";
  return "flat";
}

/**
 * Compute a descriptive status label for a strike level.
 * Uses OI magnitude (strength), OI change direction, and whether
 * the strike is a support (put OI) or resistance (call OI).
 */
function computeStrikeStatus(
  type: "support" | "resistance",
  strength: "very_strong" | "strong" | "moderate" | "weak",
  changeOI: number,
  oi: number
): import("./types").StrikeLevelStatus {
  const dir = getOIDirection(changeOI, oi);

  if (type === "support") {
    // Put OI below price = support
    if (dir === "increasing") {
      // OI rising → support building up
      if (strength === "very_strong" || strength === "strong") return "support_strengthening";
      return "support_strengthening";
    }
    if (dir === "decreasing") {
      // OI falling → support weakening / unwinding
      if (strength === "very_strong" || strength === "strong") return "support_weakening";
      return "support_weakening";
    }
    // flat OI
    if (strength === "very_strong") return "strong_support";
    if (strength === "strong") return "strong_support";
    if (strength === "moderate") return "support";
    return "support";
  }

  // type === "resistance"
  // Call OI above price = resistance
  if (dir === "increasing") {
    if (strength === "very_strong" || strength === "strong") return "resistance_strengthening";
    return "resistance_strengthening";
  }
  if (dir === "decreasing") {
    if (strength === "very_strong" || strength === "strong") return "resistance_weakening";
    return "resistance_weakening";
  }
  // flat OI
  if (strength === "very_strong") return "strong_resistance";
  if (strength === "strong") return "strong_resistance";
  if (strength === "moderate") return "resistance";
  return "resistance";
}

/**
 * Helper: is the status bullish for the holder?
 */
function isStatusBullish(s: import("./types").StrikeLevelStatus): boolean {
  return s === "support_strengthening" || s === "strong_support" || s === "support" || s === "resistance_weakening";
}
function isStatusBearish(s: import("./types").StrikeLevelStatus): boolean {
  return s === "resistance_strengthening" || s === "strong_resistance" || s === "resistance" || s === "support_weakening";
}

/**
 * Filter 4: Strike-Level Dynamic Support & Resistance
 * Analyzes ALL strikes to find multiple S/R levels based on OI
 */
export function analyzeStrikeLevelSR(
  symbol: string,
  optionChain: OptionChainAnalysis | null,
  currentPrice: number
): DynamicSupportResistance | null {
  if (!optionChain || currentPrice <= 0 || optionChain.strikes.length === 0) return null;

  const strikes = optionChain.strikes;
  const prev = previousSnapshots.get(symbol);
  
  // Find ATM strike (closest to current price)
  let atmStrike = strikes[0].strikePrice;
  let minDiff = Math.abs(strikes[0].strikePrice - currentPrice);
  for (const s of strikes) {
    const diff = Math.abs(s.strikePrice - currentPrice);
    if (diff < minDiff) {
      minDiff = diff;
      atmStrike = s.strikePrice;
    }
  }

  // Find max OI for normalization
  const maxPutOI = Math.max(...strikes.map(s => s.putOI));
  const maxCallOI = Math.max(...strikes.map(s => s.callOI));

  // Build support levels (Put OI at strikes BELOW current price)
  // Support = where institutions have sold puts (they don't want price to go below)
  const supportLevels: StrikeLevelSR[] = [];
  const resistanceLevels: StrikeLevelSR[] = [];

  for (const strike of strikes) {
    const distanceFromPrice = currentPrice - strike.strikePrice;
    const distancePercent = (distanceFromPrice / currentPrice) * 100;
    
    // Use change OI from API (current OI - prev day OI)
    if (strike.strikePrice < currentPrice && strike.putOI > 0) {
      const strength = getStrengthCategory(strike.putOI, maxPutOI);
      supportLevels.push({
        strike: strike.strikePrice,
        oi: strike.putOI,
        changeOI: strike.putChangeOI,
        volume: strike.putVolume,
        distanceFromPrice: Math.abs(distanceFromPrice),
        distancePercent: Math.abs(distancePercent),
        strength,
        status: computeStrikeStatus("support", strength, strike.putChangeOI, strike.putOI),
        oiDirection: getOIDirection(strike.putChangeOI, strike.putOI),
      });
    }
    
    if (strike.strikePrice > currentPrice && strike.callOI > 0) {
      const strength = getStrengthCategory(strike.callOI, maxCallOI);
      resistanceLevels.push({
        strike: strike.strikePrice,
        oi: strike.callOI,
        changeOI: strike.callChangeOI,
        volume: strike.callVolume,
        distanceFromPrice: Math.abs(strike.strikePrice - currentPrice),
        distancePercent: Math.abs((strike.strikePrice - currentPrice) / currentPrice * 100),
        strength,
        status: computeStrikeStatus("resistance", strength, strike.callChangeOI, strike.callOI),
        oiDirection: getOIDirection(strike.callChangeOI, strike.callOI),
      });
    }
  }

  // Sort support levels by distance (closest first)
  supportLevels.sort((a, b) => a.distanceFromPrice - b.distanceFromPrice);
  // Sort resistance levels by distance (closest first)
  resistanceLevels.sort((a, b) => a.distanceFromPrice - b.distanceFromPrice);

  // Filter to keep significant levels (top 5 by OI for each)
  const significantSupports = [...supportLevels]
    .sort((a, b) => b.oi - a.oi)
    .slice(0, 5)
    .sort((a, b) => a.distanceFromPrice - b.distanceFromPrice);
  
  const significantResistances = [...resistanceLevels]
    .sort((a, b) => b.oi - a.oi)
    .slice(0, 5)
    .sort((a, b) => a.distanceFromPrice - b.distanceFromPrice);

  // Immediate S/R (closest with significant OI)
  const immediateSupport = significantSupports.length > 0 ? significantSupports[0] : null;
  const immediateResistance = significantResistances.length > 0 ? significantResistances[0] : null;

  // Strongest S/R (highest OI)
  const strongestSupport = supportLevels.length > 0 
    ? [...supportLevels].sort((a, b) => b.oi - a.oi)[0] 
    : null;
  const strongestResistance = resistanceLevels.length > 0 
    ? [...resistanceLevels].sort((a, b) => b.oi - a.oi)[0] 
    : null;

  // Determine price position
  let pricePosition: "above_resistance" | "near_resistance" | "between" | "near_support" | "below_support";
  
  if (immediateResistance && immediateResistance.distancePercent < 0.5) {
    pricePosition = "near_resistance";
  } else if (immediateSupport && immediateSupport.distancePercent < 0.5) {
    pricePosition = "near_support";
  } else if (!immediateResistance && strongestResistance && currentPrice > strongestResistance.strike) {
    pricePosition = "above_resistance";
  } else if (!immediateSupport && strongestSupport && currentPrice < strongestSupport.strike) {
    pricePosition = "below_support";
  } else {
    pricePosition = "between";
  }

  // Expected floor and ceiling based on strong OI walls
  const expectedFloor = strongestSupport?.strike || (immediateSupport?.strike || currentPrice * 0.95);
  const expectedCeiling = strongestResistance?.strike || (immediateResistance?.strike || currentPrice * 1.05);

  // Breakout/Breakdown potential
  const breakoutPotential = !!(immediateResistance && 
    immediateResistance.status === "resistance_weakening" && 
    immediateResistance.distancePercent < 2);
  const breakdownPotential = !!(immediateSupport && 
    immediateSupport.status === "support_weakening" && 
    immediateSupport.distancePercent < 2);

  // Store current strike OI for next comparison
  const strikeOIMap = new Map<number, { callOI: number; putOI: number }>();
  for (const s of strikes) {
    strikeOIMap.set(s.strikePrice, { callOI: s.callOI, putOI: s.putOI });
  }

  return {
    currentPrice,
    atmStrike,
    supportLevels: significantSupports,
    resistanceLevels: significantResistances,
    immediateSupport,
    immediateResistance,
    strongestSupport,
    strongestResistance,
    pricePosition,
    expectedFloor,
    expectedCeiling,
    breakoutPotential,
    breakdownPotential,
  };
}

/**
 * Calculate Expected Momentum and Price Targets from Strike-Level S/R
 */
export function calculateExpectedMomentum(
  optionChain: OptionChainAnalysis | null,
  supportResistance: DynamicSupportResistance | null,
  currentPrice: number,
  momentumDirection: MomentumDirection,
  oiAnalysis: OIAnalysis
): ExpectedMomentum | null {
  if (!optionChain || !supportResistance || currentPrice <= 0) return null;

  const { immediateSupport, immediateResistance, strongestSupport, strongestResistance } = supportResistance;

  // Immediate levels
  const immSupport = immediateSupport?.strike || currentPrice * 0.98;
  const immResistance = immediateResistance?.strike || currentPrice * 1.02;
  
  // Strong levels
  const strSupport = strongestSupport?.strike || immSupport;
  const strResistance = strongestResistance?.strike || immResistance;

  // Expected upside/downside
  const expectedUpside = immResistance - currentPrice;
  const expectedUpsidePercent = (expectedUpside / currentPrice) * 100;
  const expectedDownside = currentPrice - immSupport;
  const expectedDownsidePercent = (expectedDownside / currentPrice) * 100;

  // Calculate probability based on OI distribution and S/R status
  let upsideProbability = 50;
  let downsideProbability = 50;

  // PCR factor
  const pcr = optionChain.overallPCR;
  if (pcr > 1.2) { upsideProbability += 15; downsideProbability -= 15; }
  else if (pcr > 1) { upsideProbability += 8; downsideProbability -= 8; }
  else if (pcr < 0.8) { upsideProbability -= 15; downsideProbability += 15; }
  else if (pcr < 1) { upsideProbability -= 8; downsideProbability += 8; }

  // Support status factor
  if (immediateSupport && isStatusBullish(immediateSupport.status)) {
    downsideProbability -= 10;
    upsideProbability += 5;
  } else if (immediateSupport && isStatusBearish(immediateSupport.status)) {
    downsideProbability += 15;
    upsideProbability -= 10;
  }

  // Resistance status factor  
  if (immediateResistance && isStatusBullish(immediateResistance.status)) {
    upsideProbability += 15;
    downsideProbability -= 10;
  } else if (immediateResistance && isStatusBearish(immediateResistance.status)) {
    upsideProbability -= 10;
    downsideProbability += 5;
  }

  // Breakout/Breakdown signals
  if (supportResistance.breakoutPotential) {
    upsideProbability += 10;
  }
  if (supportResistance.breakdownPotential) {
    downsideProbability += 10;
  }

  // OI trend factor
  if (oiAnalysis.oiTrend === "increasing") {
    if (momentumDirection === "bullish") upsideProbability += 10;
    else if (momentumDirection === "bearish") downsideProbability += 10;
  }

  // Price position factor
  if (supportResistance.pricePosition === "near_resistance") {
    if (!immediateResistance || !isStatusBullish(immediateResistance.status)) {
      downsideProbability += 10;
      upsideProbability -= 10;
    }
  } else if (supportResistance.pricePosition === "near_support") {
    if (!immediateSupport || isStatusBullish(immediateSupport.status)) {
      upsideProbability += 10;
      downsideProbability -= 10;
    }
  }

  // Clamp probabilities
  upsideProbability = Math.max(10, Math.min(90, upsideProbability));
  downsideProbability = Math.max(10, Math.min(90, downsideProbability));

  // Target direction and price
  let targetDirection: "bullish" | "bearish" | "neutral" = "neutral";
  let targetPrice = currentPrice;

  if (upsideProbability > downsideProbability + 15) {
    targetDirection = "bullish";
    targetPrice = immResistance;
  } else if (downsideProbability > upsideProbability + 15) {
    targetDirection = "bearish";
    targetPrice = immSupport;
  }

  // Risk/Reward ratio
  const riskRewardRatio = expectedDownside > 0 
    ? parseFloat((expectedUpside / expectedDownside).toFixed(2))
    : expectedUpside > 0 ? 99 : 1;

  // Max Pain (simplified)
  let maxPainStrike = currentPrice;
  let maxTotalOI = 0;
  for (const strike of optionChain.strikes) {
    const totalOI = strike.callOI + strike.putOI;
    if (totalOI > maxTotalOI) {
      maxTotalOI = totalOI;
      maxPainStrike = strike.strikePrice;
    }
  }

  // Pivot strike
  let pivotStrike = currentPrice;
  let minOIDiff = Infinity;
  for (const strike of optionChain.strikes) {
    const diff = Math.abs(strike.callOI - strike.putOI);
    if (diff < minOIDiff && strike.callOI > 0 && strike.putOI > 0) {
      minOIDiff = diff;
      pivotStrike = strike.strikePrice;
    }
  }

  return {
    immediateSupport: immSupport,
    immediateResistance: immResistance,
    strongSupport: strSupport,
    strongResistance: strResistance,
    expectedUpside: parseFloat(expectedUpside.toFixed(2)),
    expectedUpsidePercent: parseFloat(expectedUpsidePercent.toFixed(2)),
    expectedDownside: parseFloat(expectedDownside.toFixed(2)),
    expectedDownsidePercent: parseFloat(expectedDownsidePercent.toFixed(2)),
    upsideProbability: Math.round(upsideProbability),
    downsideProbability: Math.round(downsideProbability),
    targetPrice: parseFloat(targetPrice.toFixed(2)),
    targetDirection,
    riskRewardRatio,
    maxPainStrike,
    pivotStrike,
  };
}

/**
 * Classify momentum
 */
export function classifyMomentum(
  priceChange: number,
  oiChange: number
): MomentumClassification {
  const priceUp = priceChange > 0;
  const oiUp = oiChange > 0;

  if (priceUp && oiUp) return "long_buildup";
  if (!priceUp && oiUp) return "short_buildup";
  if (!priceUp && !oiUp) return "long_unwinding";
  if (priceUp && !oiUp) return "short_covering";
  return "neutral";
}

/**
 * Determine momentum direction
 */
export function determineMomentumDirection(
  classification: MomentumClassification,
  volumeScore: number,
  oiAnalysis: OIAnalysis,
  priceChangePercent: number
): MomentumDirection {
  if (classification === "long_buildup" && volumeScore > 30) return "bullish";
  if (classification === "short_buildup" && volumeScore > 30) return "bearish";
  if (classification === "short_covering" && priceChangePercent > 1) return "bullish";
  if (classification === "long_unwinding" && priceChangePercent < -1) return "bearish";
  if (priceChangePercent > 0.5 && oiAnalysis.oiTrend === "increasing") return "bullish";
  if (priceChangePercent < -0.5 && oiAnalysis.oiTrend === "increasing") return "bearish";
  return "neutral";
}

/**
 * Calculate momentum strength
 */
export function calculateMomentumStrength(score: number): MomentumStrength {
  if (score >= 80) return "very_strong";
  if (score >= 65) return "strong";
  if (score >= 45) return "moderate";
  if (score >= 25) return "weak";
  return "very_weak";
}

/**
 * Calculate Institutional Momentum Score
 */
export function calculateInstitutionalScore(
  volumeAnalysis: VolumeAnalysis,
  optionChainAnalysis: OptionChainAnalysis | null,
  oiAnalysis: OIAnalysis,
  supportResistance: DynamicSupportResistance | null,
  priceChangePercent: number,
  classification: MomentumClassification
): InstitutionalScore {
  const volumeStrength = volumeAnalysis.volumeScore;

  let optionChainStrength = 50;
  if (optionChainAnalysis) {
    const pcr = optionChainAnalysis.overallPCR;
    if (classification === "long_buildup" || classification === "short_covering") {
      if (pcr > 1.5) optionChainStrength = 90;
      else if (pcr > 1.2) optionChainStrength = 75;
      else if (pcr > 1) optionChainStrength = 60;
      else if (pcr > 0.8) optionChainStrength = 45;
      else optionChainStrength = 30;
    } else if (classification === "short_buildup" || classification === "long_unwinding") {
      if (pcr < 0.5) optionChainStrength = 90;
      else if (pcr < 0.7) optionChainStrength = 75;
      else if (pcr < 1) optionChainStrength = 60;
      else if (pcr < 1.2) optionChainStrength = 45;
      else optionChainStrength = 30;
    }
  }

  let oiStrength = 50;
  if (oiAnalysis.positionStrength === "strengthening") {
    oiStrength = 70 + Math.min(30, Math.abs(oiAnalysis.oiChangePercent));
    if (oiAnalysis.oiAccelerating) oiStrength = Math.min(100, oiStrength + 10);
  } else if (oiAnalysis.positionStrength === "weakening") {
    oiStrength = 30 - Math.min(30, Math.abs(oiAnalysis.oiChangePercent));
  }
  oiStrength = Math.max(0, Math.min(100, oiStrength));

  let priceMomentum = 50;
  const absPriceChange = Math.abs(priceChangePercent);
  if (absPriceChange > 5) priceMomentum = 95;
  else if (absPriceChange > 3) priceMomentum = 80;
  else if (absPriceChange > 2) priceMomentum = 70;
  else if (absPriceChange > 1) priceMomentum = 60;
  else priceMomentum = 40 + absPriceChange * 20;

  let supportStrengthVal = 50;
  if (supportResistance?.immediateSupport) {
    if (isStatusBullish(supportResistance.immediateSupport.status)) supportStrengthVal = 80;
    else if (isStatusBearish(supportResistance.immediateSupport.status)) supportStrengthVal = 20;
  }

  let resistanceWeakness = 50;
  if (supportResistance?.immediateResistance) {
    if (classification === "long_buildup" || classification === "short_covering") {
      // For bullish: resistance weakening is good
      if (isStatusBullish(supportResistance.immediateResistance.status)) resistanceWeakness = 80;
      else if (isStatusBearish(supportResistance.immediateResistance.status)) resistanceWeakness = 20;
    } else {
      // For bearish: resistance strengthening is confirmation
      if (isStatusBearish(supportResistance.immediateResistance.status)) resistanceWeakness = 80;
      else if (isStatusBullish(supportResistance.immediateResistance.status)) resistanceWeakness = 20;
    }
  }

  const totalScore = Math.round(
    volumeStrength * 0.2 +
    optionChainStrength * 0.25 +
    oiStrength * 0.2 +
    priceMomentum * 0.15 +
    supportStrengthVal * 0.1 +
    resistanceWeakness * 0.1
  );

  return {
    volumeStrength: Math.round(volumeStrength),
    optionChainStrength: Math.round(optionChainStrength),
    oiStrength: Math.round(oiStrength),
    priceMomentum: Math.round(priceMomentum),
    supportStrength: Math.round(supportStrengthVal),
    resistanceWeakness: Math.round(resistanceWeakness),
    totalScore: Math.max(0, Math.min(100, totalScore)),
  };
}

/**
 * Process a single stock through all filters
 */
export function processStock(
  symbol: string,
  instrumentKey: string,
  quote: UpstoxFullQuote,
  optionChainData: UpstoxOptionChainEntry[] | null
): ScannedStock {
  const ltp = quote.last_price || 0;
  const open = quote.ohlc?.open || 0;
  const high = quote.ohlc?.high || 0;
  const low = quote.ohlc?.low || 0;
  const close = quote.ohlc?.close || ltp;
  const volume = quote.volume || 0;
  const netChange = quote.net_change || 0;
  const priceChange = netChange;
  const priceChangePercent = close > 0 ? (priceChange / close) * 100 : 0;

  const volumeAnalysis = analyzeVolume(symbol, volume, quote.average_price || 0, open, high, low, ltp);
  const optionChainAnalysis = optionChainData ? analyzeOptionChain(optionChainData) : null;

  let currentOI = quote.oi || 0;
  if (optionChainAnalysis) {
    currentOI = currentOI || optionChainAnalysis.totalCallOI + optionChainAnalysis.totalPutOI;
  }
  const prev = previousSnapshots.get(symbol);
  const prevOI = prev?.oi || currentOI;

  const oiAnalysis = analyzeOI(symbol, currentOI, prevOI);

  // Use new strike-level S/R analysis
  const supportResistance = analyzeStrikeLevelSR(symbol, optionChainAnalysis, ltp);

  const classification = classifyMomentum(priceChange, oiAnalysis.changeInOI);
  const momentumDirection = determineMomentumDirection(classification, volumeAnalysis.volumeScore, oiAnalysis, priceChangePercent);
  const expectedMomentum = calculateExpectedMomentum(optionChainAnalysis, supportResistance, ltp, momentumDirection, oiAnalysis);
  const institutionalScore = calculateInstitutionalScore(volumeAnalysis, optionChainAnalysis, oiAnalysis, supportResistance, priceChangePercent, classification);
  const momentumStrength = calculateMomentumStrength(institutionalScore.totalScore);

  // Update snapshot
  const strikeOIMap = new Map<number, { callOI: number; putOI: number }>();
  if (optionChainAnalysis) {
    for (const s of optionChainAnalysis.strikes) {
      strikeOIMap.set(s.strikePrice, { callOI: s.callOI, putOI: s.putOI });
    }
  }

  previousSnapshots.set(symbol, {
    oi: currentOI,
    volume,
    price: ltp,
    timestamp: Date.now(),
    strikeOI: strikeOIMap,
  });

  return {
    symbol,
    instrumentKey,
    currentPrice: ltp,
    priceChange,
    priceChangePercent: parseFloat(priceChangePercent.toFixed(2)),
    open,
    high,
    low,
    close,
    volumeAnalysis,
    optionChainAnalysis,
    oiAnalysis,
    supportResistance,
    expectedMomentum,
    momentumClassification: classification,
    momentumDirection,
    momentumStrength,
    institutionalScore,
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Filter and rank stocks
 */
export function filterAndRankStocks(stocks: ScannedStock[]): {
  bullish: ScannedStock[];
  bearish: ScannedStock[];
  all: ScannedStock[];
} {
  const filtered = stocks.filter(
    (s) =>
      s.volumeAnalysis.volumeScore >= 10 &&
      s.institutionalScore.totalScore >= 20 &&
      s.currentPrice > 0
  );

  const bullish = filtered
    .filter((s) => s.momentumDirection === "bullish")
    .sort((a, b) => b.institutionalScore.totalScore - a.institutionalScore.totalScore);

  const bearish = filtered
    .filter((s) => s.momentumDirection === "bearish")
    .sort((a, b) => b.institutionalScore.totalScore - a.institutionalScore.totalScore);

  const all = [...filtered].sort(
    (a, b) => b.institutionalScore.totalScore - a.institutionalScore.totalScore
  );

  return { bullish, bearish, all };
}
