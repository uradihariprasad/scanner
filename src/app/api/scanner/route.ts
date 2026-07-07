import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { userSessions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { 
  getFullMarketQuotes, 
  getOptionChain, 
  getOptionContracts, 
  getNearestExpiry 
} from "@/lib/upstox-api";
import type { UpstoxFullQuote, UpstoxOptionChainEntry } from "@/lib/upstox-api";
import { NSE_FO_STOCKS } from "@/lib/nse-fo-stocks";
import { processStock, filterAndRankStocks } from "@/lib/analysis-engine";
import type { ScannedStock, AlertItem } from "@/lib/types";

const expiryCache: Map<string, { expiry: string; cachedAt: number }> = new Map();
const EXPIRY_CACHE_TTL = 3600000;

// Cache for OI snapshots to track changes
const strikeOIHistory: Map<string, Map<number, { callOI: number; putOI: number; timestamp: number }>> = new Map();

/**
 * GET /api/scanner?sessionId=xxx
 * Run full scan of all NSE F&O stocks with complete option chain analysis
 */
export async function GET(request: NextRequest) {
  try {
    const sessionId = request.nextUrl.searchParams.get("sessionId");
    if (!sessionId) {
      return NextResponse.json({ error: "Session ID required" }, { status: 401 });
    }

    const sessions = await db.select().from(userSessions).where(eq(userSessions.sessionId, sessionId)).limit(1);
    if (sessions.length === 0 || !sessions[0].isActive || !sessions[0].accessToken) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const accessToken = sessions[0].accessToken;
    const marketStatus = getMarketStatus();

    // Phase 1: Fetch all market quotes (up to 500 per batch)
    const allStocks = NSE_FO_STOCKS;
    const allQuotes: Record<string, UpstoxFullQuote> = {};
    const failedQuotes: string[] = [];

    for (let i = 0; i < allStocks.length; i += 200) {
      const chunk = allStocks.slice(i, i + 200);
      const keys = chunk.map(s => s.instrumentKey);
      const quotes = await getFullMarketQuotes(keys, accessToken);
      if (quotes) {
        for (const [key, value] of Object.entries(quotes)) {
          allQuotes[key] = value as UpstoxFullQuote;
        }
      }
      if (i + 200 < allStocks.length) await new Promise(r => setTimeout(r, 200));
    }

    console.log(`[Scanner] Fetched quotes for ${Object.keys(allQuotes).length}/${allStocks.length} stocks`);

    if (Object.keys(allQuotes).length === 0) {
      return NextResponse.json({
        bullishStocks: [], bearishStocks: [], allStocks: [],
        marketStatus, lastScanTime: new Date().toISOString(),
        totalScanned: 0, totalFiltered: 0, isScanning: false,
        scanError: "Could not fetch any market data. Check token validity.",
        alerts: [], ocStats: { success: 0, failed: 0, skipped: 0 }
      });
    }

    // Phase 2: Get expiries for all stocks (cache expiries in parallel)
    console.log(`[Scanner] Fetching expiries for all stocks...`);
    const expiryPromises = allStocks.map(async stock => {
      const cached = expiryCache.get(stock.instrumentKey);
      if (cached && Date.now() - cached.cachedAt < EXPIRY_CACHE_TTL) {
        return { symbol: stock.symbol, expiry: cached.expiry };
      }
      
      try {
        const result = await getOptionContracts(stock.instrumentKey, accessToken);
        if (result.contracts && result.contracts.length > 0) {
          const nearest = getNearestExpiry(result.contracts);
          if (nearest) {
            expiryCache.set(stock.instrumentKey, { expiry: nearest, cachedAt: Date.now() });
            return { symbol: stock.symbol, expiry: nearest };
          }
        }
      } catch (e) {
        console.log(`[Scanner] Expiry error for ${stock.symbol}:`, e);
      }
      return { symbol: stock.symbol, expiry: null };
    });
    
    const expiryResults = await Promise.all(expiryPromises);
    const expiryMap = new Map(expiryResults.map(e => [e.symbol, e.expiry]));

    // Phase 3: Fetch option chains for ALL stocks (with rate limiting)
    const processedStocks: ScannedStock[] = [];
    const alerts: AlertItem[] = [];
    const ocStats = { success: 0, failed: 0, skipped: 0 };

    // Process in very small batches to avoid rate limits
    const BATCH_SIZE = 3;
    const BATCH_DELAY = 500; // 500ms between batches

    for (let i = 0; i < allStocks.length; i += BATCH_SIZE) {
      const batch = allStocks.slice(i, i + BATCH_SIZE);
      
      const promises = batch.map(async stock => {
        // Find matching quote
        let quote: UpstoxFullQuote | null = null;
        const possibleKeys = [
          stock.instrumentKey,
          stock.instrumentKey.replace("|", ":"),
          `NSE_EQ:${stock.symbol}`
        ];
        
        for (const key of possibleKeys) {
          if (allQuotes[key]) {
            quote = allQuotes[key];
            break;
          }
        }
        
        if (!quote) {
          console.log(`[Scanner] No quote found for ${stock.symbol}`);
          ocStats.skipped++;
          return null;
        }

        // Get option chain
        let optionChainData: UpstoxOptionChainEntry[] | null = null;
        const expiry = expiryMap.get(stock.symbol);

        if (expiry) {
          try {
            const result = await getOptionChain(stock.instrumentKey, expiry, accessToken);
            if (result.chain && result.chain.length > 0) {
              optionChainData = result.chain;
              ocStats.success++;
              console.log(`[Scanner] OC for ${stock.symbol}: ${result.chain.length} strikes`);
            } else {
              ocStats.failed++;
              console.log(`[Scanner] Empty OC for ${stock.symbol}: ${result.error || 'no data'}`);
            }
          } catch (e) {
            ocStats.failed++;
            console.log(`[Scanner] OC error for ${stock.symbol}:`, e);
          }
        } else {
          ocStats.failed++;
          console.log(`[Scanner] No expiry for ${stock.symbol}`);
        }

        const processed = processStock(stock.symbol, stock.instrumentKey, quote, optionChainData);
        return processed;
      });

      const results = await Promise.all(promises);
      const validResults = results.filter(r => r !== null) as ScannedStock[];
      processedStocks.push(...validResults);

      if (i + BATCH_SIZE < allStocks.length) {
        await new Promise(r => setTimeout(r, BATCH_DELAY));
      }
    }

    console.log(`[Scanner] Processed ${processedStocks.length} stocks (OC: ${ocStats.success} success, ${ocStats.failed} failed)`);

    // Phase 4: Filter and rank
    const { bullish, bearish, all } = filterAndRankStocks(processedStocks);

    // Phase 5: Generate alerts
    const generateAlerts = (stocks: ScannedStock[]) => {
      for (const s of stocks) {
        if (s.institutionalScore.totalScore >= 70) {
          alerts.push({
            id: `${s.symbol}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            symbol: s.symbol,
            type: s.momentumDirection === "bullish" ? "bullish_momentum" : "bearish_momentum",
            message: `${s.symbol} ${s.momentumStrength} ${s.momentumDirection} momentum (Score: ${s.institutionalScore.totalScore})`,
            score: s.institutionalScore.totalScore,
            timestamp: new Date().toISOString()
          });
        }

        // Support/Resistance alerts from strike levels
        if (s.supportResistance?.immediateSupport) {
          if (s.supportResistance.immediateSupport.status === "support_strengthening" && 
              s.supportResistance.immediateSupport.distancePercent < 1.5) {
            alerts.push({
              id: `support-${s.symbol}-${Date.now()}`,
              symbol: s.symbol,
              type: "support_strengthening",
              message: `${s.symbol} STRONG support at ₹${s.supportResistance.immediateSupport.strike}`,
              score: s.institutionalScore.totalScore,
              timestamp: new Date().toISOString()
            });
          }
        }

        if (s.supportResistance?.immediateResistance) {
          if (s.supportResistance.immediateResistance.status === "resistance_weakening" && 
              s.supportResistance.immediateResistance.distancePercent < 1.5) {
            alerts.push({
              id: `resistance-${s.symbol}-${Date.now()}`,
              symbol: s.symbol,
              type: "resistance_weakening",
              message: `${s.symbol} WEAKENING resistance at ₹${s.supportResistance.immediateResistance.strike}`,
              score: s.institutionalScore.totalScore,
              timestamp: new Date().toISOString()
            });
          }
        }

        // Breakout/Breakdown signals
        if (s.supportResistance?.breakoutPotential) {
          alerts.push({
            id: `breakout-${s.symbol}-${Date.now()}`,
            symbol: s.symbol,
            type: "momentum_reversal",
            message: `🚀 BREAKOUT: ${s.symbol} showing strong upside momentum`,
            score: s.institutionalScore.totalScore,
            timestamp: new Date().toISOString()
          });
        }
        if (s.supportResistance?.breakdownPotential) {
          alerts.push({
            id: `breakdown-${s.symbol}-${Date.now()}`,
            symbol: s.symbol,
            type: "momentum_reversal",
            message: `⚠️ BREAKDOWN: ${s.symbol} showing strong downside momentum`,
            score: s.institutionalScore.totalScore,
            timestamp: new Date().toISOString()
          });
        }
      }
    };

    generateAlerts(bullish);
    generateAlerts(bearish);

    // Deduplicate alerts
    const uniqueAlerts = alerts.filter((a, i, arr) => arr.findIndex(x => x.id === a.id) === i);

    return NextResponse.json({
      bullishStocks: bullish.slice(0, 30),
      bearishStocks: bearish.slice(0, 30),
      allStocks: all.slice(0, 100),
      marketStatus,
      lastScanTime: new Date().toISOString(),
      totalScanned: processedStocks.length,
      totalFiltered: all.length,
      isScanning: false,
      scanError: null,
      alerts: uniqueAlerts,
      ocStats,
      summary: {
        totalStocks: allStocks.length,
        withQuotes: Object.keys(allQuotes).length,
        withOptionChain: ocStats.success,
        withoutOptionChain: ocStats.failed,
      }
    });

  } catch (error) {
    console.error("Scanner error:", error);
    return NextResponse.json({
      error: "Scanner failed",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

function getMarketStatus(): "open" | "closed" | "pre_open" | "post_close" {
  const now = new Date();
  const istOffset = 5.5 * 60;
  const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  const istMinutes = utcMinutes + istOffset;
  const istHours = Math.floor(istMinutes / 60) % 24;
  const timeInMinutes = istHours * 60 + (istMinutes % 60);
  const day = now.getUTCDay();

  if (day === 0 || day === 6) return "closed";
  if (timeInMinutes >= 9 * 60 + 15 && timeInMinutes <= 15 * 60 + 30) return "open";
  if (timeInMinutes >= 9 * 60 && timeInMinutes < 9 * 60 + 15) return "pre_open";
  if (timeInMinutes > 15 * 60 + 30 && timeInMinutes <= 16 * 60) return "post_close";
  return "closed";
}