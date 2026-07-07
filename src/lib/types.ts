// ---- Core Types for Institutional Momentum Scanner ----

export interface StockQuote {
  symbol: string;
  instrumentKey: string;
  ltp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  avgPrice: number;
  oi: number;
  netChange: number;
  totalBuyQty: number;
  totalSellQty: number;
  upperCircuit: number;
  lowerCircuit: number;
  lastTradeTime: string;
  timestamp: string;
}

export interface OptionStrikeData {
  strikePrice: number;
  expiryDate: string;
  callOI: number;
  putOI: number;
  callChangeOI: number;
  putChangeOI: number;
  callVolume: number;
  putVolume: number;
  callLTP: number;
  putLTP: number;
  callIV: number;
  putIV: number;
  pcr: number;
  underlyingSpotPrice: number;
}

export interface OptionChainAnalysis {
  highestCallOI: { strike: number; oi: number };
  highestPutOI: { strike: number; oi: number };
  highestCallChangeOI: { strike: number; changeOI: number };
  highestPutChangeOI: { strike: number; changeOI: number };
  totalCallOI: number;
  totalPutOI: number;
  totalCallChangeOI: number;
  totalPutChangeOI: number;
  overallPCR: number;
  strikes: OptionStrikeData[];
}

export interface VolumeAnalysis {
  currentVolume: number;
  avgVolume: number;
  relativeVolume: number;
  volumeSpike: boolean;
  intradayVolumeGrowth: number;
  volumeScore: number; // 0-100
}

export interface OIAnalysis {
  currentOI: number;
  previousOI: number;
  changeInOI: number;
  oiChangePercent: number;
  oiTrend: "increasing" | "decreasing" | "stable";
  oiAccelerating: boolean;
  oiUnwinding: boolean;
  positionStrength: "strengthening" | "weakening" | "neutral";
}

// Descriptive status labels for each strike level
export type StrikeLevelStatus =
  | "strong_support"
  | "support"
  | "support_strengthening"
  | "support_weakening"
  | "strong_resistance"
  | "resistance"
  | "resistance_strengthening"
  | "resistance_weakening"
  | "oi_buildup"
  | "oi_unwinding"
  | "new_entry"
  | "exit"
  | "neutral";

// Strike-level support/resistance with OI data
export interface StrikeLevelSR {
  strike: number;
  oi: number;
  changeOI: number;
  volume: number;
  distanceFromPrice: number;
  distancePercent: number;
  strength: "very_strong" | "strong" | "moderate" | "weak";
  status: StrikeLevelStatus;
  // raw direction used internally
  oiDirection: "increasing" | "decreasing" | "flat";
}

export interface DynamicSupportResistance {
  // Current price reference
  currentPrice: number;
  atmStrike: number;
  
  // Multiple support levels (Put OI below current price) - sorted by proximity
  supportLevels: StrikeLevelSR[];
  // Multiple resistance levels (Call OI above current price) - sorted by proximity
  resistanceLevels: StrikeLevelSR[];
  
  // Immediate (closest) S/R
  immediateSupport: StrikeLevelSR | null;
  immediateResistance: StrikeLevelSR | null;
  
  // Strongest S/R (highest OI)
  strongestSupport: StrikeLevelSR | null;
  strongestResistance: StrikeLevelSR | null;
  
  // Price position relative to S/R
  pricePosition: "above_resistance" | "near_resistance" | "between" | "near_support" | "below_support";
  
  // Expected price range based on OI walls
  expectedFloor: number;  // Strong support where price unlikely to fall below
  expectedCeiling: number; // Strong resistance where price unlikely to rise above
  
  // Breakout/Breakdown signals
  breakoutPotential: boolean; // Price near weakening resistance
  breakdownPotential: boolean; // Price near weakening support
}

export interface ExpectedMomentum {
  // Target levels based on option chain
  immediateSupport: number;
  immediateResistance: number;
  strongSupport: number;
  strongResistance: number;
  // Expected price range
  expectedUpside: number;
  expectedUpsidePercent: number;
  expectedDownside: number;
  expectedDownsidePercent: number;
  // Probability assessment
  upsideProbability: number; // 0-100
  downsideProbability: number; // 0-100
  // Target based on momentum
  targetPrice: number;
  targetDirection: "bullish" | "bearish" | "neutral";
  riskRewardRatio: number;
  // Key OI levels
  maxPainStrike: number;
  pivotStrike: number;
}

export type MomentumClassification =
  | "long_buildup"
  | "short_buildup"
  | "long_unwinding"
  | "short_covering"
  | "neutral";

export type MomentumDirection = "bullish" | "bearish" | "neutral";

export type MomentumStrength =
  | "very_strong"
  | "strong"
  | "moderate"
  | "weak"
  | "very_weak";

export interface InstitutionalScore {
  volumeStrength: number;
  optionChainStrength: number;
  oiStrength: number;
  priceMomentum: number;
  supportStrength: number;
  resistanceWeakness: number;
  totalScore: number; // 0-100
}

export interface ScannedStock {
  symbol: string;
  instrumentKey: string;
  currentPrice: number;
  priceChange: number;
  priceChangePercent: number;
  open: number;
  high: number;
  low: number;
  close: number;

  volumeAnalysis: VolumeAnalysis;
  optionChainAnalysis: OptionChainAnalysis | null;
  oiAnalysis: OIAnalysis;
  supportResistance: DynamicSupportResistance | null;
  expectedMomentum: ExpectedMomentum | null;

  momentumClassification: MomentumClassification;
  momentumDirection: MomentumDirection;
  momentumStrength: MomentumStrength;

  institutionalScore: InstitutionalScore;

  lastUpdated: string;
}

export interface ScannerState {
  bullishStocks: ScannedStock[];
  bearishStocks: ScannedStock[];
  allStocks: ScannedStock[];
  marketStatus: "open" | "closed" | "pre_open" | "post_close";
  lastScanTime: string;
  totalScanned: number;
  totalFiltered: number;
  isScanning: boolean;
  scanError: string | null;
}

export interface AlertItem {
  id: string;
  symbol: string;
  type:
    | "bullish_momentum"
    | "bearish_momentum"
    | "support_strengthening"
    | "support_weakening"
    | "resistance_strengthening"
    | "resistance_weakening"
    | "momentum_reversal";
  message: string;
  score: number;
  timestamp: string;
}

// NSE F&O stock with instrument key mapping
export interface FnOStock {
  symbol: string;
  instrumentKey: string; // NSE_EQ|ISIN format
  name: string;
}

export type SortField =
  | "score"
  | "volume"
  | "momentum"
  | "oi"
  | "changeOi"
  | "priceChange"
  | "alphabetical";

export type SortDirection = "asc" | "desc";
