import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { userSessions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getOptionContracts, getOptionChain, getNearestExpiry, getAllExpiries } from "@/lib/upstox-api";

/**
 * GET /api/debug/option-chain?symbol=RELIANCE&sessionId=xxx
 * Debug endpoint to test option chain fetching
 */
export async function GET(request: NextRequest) {
  try {
    const sessionId = request.nextUrl.searchParams.get("sessionId");
    const instrumentKey = request.nextUrl.searchParams.get("instrumentKey") || "NSE_EQ|INE002A01018"; // Default: RELIANCE

    if (!sessionId) {
      return NextResponse.json(
        { error: "Session ID required" },
        { status: 401 }
      );
    }

    const sessions = await db
      .select()
      .from(userSessions)
      .where(eq(userSessions.sessionId, sessionId))
      .limit(1);

    if (sessions.length === 0 || !sessions[0].isActive) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    const accessToken = sessions[0].accessToken;
    const results: Record<string, unknown> = {
      instrumentKey,
      timestamp: new Date().toISOString(),
    };

    // Step 1: Fetch option contracts
    console.log(`[Debug] Fetching option contracts for: ${instrumentKey}`);
    const contractsResult = await getOptionContracts(instrumentKey, accessToken);
    
    results.contractsResult = {
      error: contractsResult.error,
      contractCount: contractsResult.contracts?.length || 0,
      sampleContracts: contractsResult.contracts?.slice(0, 3) || [],
    };

    if (contractsResult.error) {
      return NextResponse.json({
        success: false,
        step: "contracts",
        ...results,
      });
    }

    if (!contractsResult.contracts || contractsResult.contracts.length === 0) {
      return NextResponse.json({
        success: false,
        step: "contracts",
        message: "No option contracts found for this instrument",
        ...results,
      });
    }

    // Step 2: Get expiry dates
    const allExpiries = getAllExpiries(contractsResult.contracts);
    const nearestExpiry = getNearestExpiry(contractsResult.contracts);
    
    results.expiries = {
      all: allExpiries.slice(0, 5),
      nearest: nearestExpiry,
    };

    if (!nearestExpiry) {
      return NextResponse.json({
        success: false,
        step: "expiry",
        message: "Could not determine nearest expiry",
        ...results,
      });
    }

    // Step 3: Fetch option chain
    console.log(`[Debug] Fetching option chain for: ${instrumentKey}, expiry: ${nearestExpiry}`);
    const chainResult = await getOptionChain(instrumentKey, nearestExpiry, accessToken);
    
    results.chainResult = {
      error: chainResult.error,
      strikeCount: chainResult.chain?.length || 0,
      sampleStrikes: chainResult.chain?.slice(0, 3).map(s => ({
        strike_price: s.strike_price,
        call_oi: s.call_options?.market_data?.oi,
        put_oi: s.put_options?.market_data?.oi,
        underlying_spot: s.underlying_spot_price,
      })) || [],
    };

    if (chainResult.error) {
      return NextResponse.json({
        success: false,
        step: "chain",
        ...results,
      });
    }

    if (!chainResult.chain || chainResult.chain.length === 0) {
      return NextResponse.json({
        success: false,
        step: "chain",
        message: "Option chain returned empty",
        ...results,
      });
    }

    // Success - include full analysis
    const chain = chainResult.chain;
    let maxCallOI = { strike: 0, oi: 0 };
    let maxPutOI = { strike: 0, oi: 0 };
    let totalCallOI = 0;
    let totalPutOI = 0;

    for (const entry of chain) {
      const callOI = entry.call_options?.market_data?.oi || 0;
      const putOI = entry.put_options?.market_data?.oi || 0;
      
      totalCallOI += callOI;
      totalPutOI += putOI;
      
      if (callOI > maxCallOI.oi) {
        maxCallOI = { strike: entry.strike_price, oi: callOI };
      }
      if (putOI > maxPutOI.oi) {
        maxPutOI = { strike: entry.strike_price, oi: putOI };
      }
    }

    results.analysis = {
      underlyingSpot: chain[0]?.underlying_spot_price,
      maxCallOI,
      maxPutOI,
      totalCallOI,
      totalPutOI,
      pcr: totalCallOI > 0 ? (totalPutOI / totalCallOI).toFixed(2) : 0,
      support: maxPutOI.strike,
      resistance: maxCallOI.strike,
    };

    return NextResponse.json({
      success: true,
      ...results,
    });
  } catch (error) {
    console.error("Debug option chain error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Debug failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
