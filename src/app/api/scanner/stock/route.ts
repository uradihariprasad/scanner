import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { userSessions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getFullMarketQuotes, getOptionChain, getOptionContracts, getNearestExpiry } from "@/lib/upstox-api";
import type { UpstoxFullQuote } from "@/lib/upstox-api";
import { processStock } from "@/lib/analysis-engine";
import { getStockBySymbol } from "@/lib/nse-fo-stocks";

/**
 * GET /api/scanner/stock?symbol=RELIANCE&sessionId=xxx
 * Get detailed scan data for a single stock
 */
export async function GET(request: NextRequest) {
  try {
    const sessionId = request.nextUrl.searchParams.get("sessionId");
    const symbol = request.nextUrl.searchParams.get("symbol");

    if (!sessionId || !symbol) {
      return NextResponse.json(
        { error: "Session ID and symbol required" },
        { status: 400 }
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
    const stock = getStockBySymbol(symbol);

    if (!stock) {
      return NextResponse.json(
        { error: "Stock not found in F&O list" },
        { status: 404 }
      );
    }

    // Fetch quote
    const quotes = await getFullMarketQuotes([stock.instrumentKey], accessToken);
    if (!quotes || Object.keys(quotes).length === 0) {
      return NextResponse.json(
        { error: "Could not fetch market data" },
        { status: 502 }
      );
    }

    const quoteKey = Object.keys(quotes)[0];
    const quote = quotes[quoteKey] as UpstoxFullQuote;

    // Fetch option chain
    let optionChainData = null;
    let ocError: string | null = null;
    
    try {
      const contractsResult = await getOptionContracts(stock.instrumentKey, accessToken);
      
      if (contractsResult.error) {
        ocError = contractsResult.error;
      } else if (contractsResult.contracts && contractsResult.contracts.length > 0) {
        const expiryDate = getNearestExpiry(contractsResult.contracts);
        
        if (expiryDate) {
          const chainResult = await getOptionChain(
            stock.instrumentKey,
            expiryDate,
            accessToken
          );
          
          if (chainResult.error) {
            ocError = chainResult.error;
          } else if (chainResult.chain) {
            optionChainData = chainResult.chain;
          }
        }
      }
    } catch (err) {
      console.error(`Option chain error for ${symbol}:`, err);
      ocError = err instanceof Error ? err.message : "Unknown error";
    }

    const processed = processStock(
      stock.symbol,
      stock.instrumentKey,
      quote,
      optionChainData
    );

    return NextResponse.json({ 
      stock: processed,
      ocError, // Include any option chain error for debugging
    });
  } catch (error) {
    console.error("Stock detail error:", error);
    return NextResponse.json(
      { error: "Failed to fetch stock detail" },
      { status: 500 }
    );
  }
}
