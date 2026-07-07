import { NextRequest, NextResponse } from "next/server";

const UPSTOX_BASE_URL = "https://api.upstox.com";

/**
 * POST /api/debug/validate-token
 * Debug endpoint to test Upstox token validation
 * Returns detailed information about the validation attempt
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const results: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
  };

  try {
    const body = await request.json();
    const { accessToken } = body;

    if (!accessToken) {
      return NextResponse.json({
        success: false,
        error: "No access token provided",
        hint: "Send POST request with body: { \"accessToken\": \"your_token\" }"
      }, { status: 400 });
    }

    const cleanToken = accessToken.trim();
    results.tokenLength = cleanToken.length;
    results.tokenPrefix = cleanToken.substring(0, 10) + "...";

    // Test 1: Check if we can reach Upstox at all
    console.log("[Debug] Testing Upstox connectivity...");
    try {
      const pingResponse = await fetch("https://api.upstox.com/v2/market/status/NSE", {
        method: "GET",
        headers: { "Accept": "application/json" },
        signal: AbortSignal.timeout(10000),
      });
      results.upstoxReachable = true;
      results.pingStatus = pingResponse.status;
    } catch (pingError) {
      results.upstoxReachable = false;
      results.pingError = pingError instanceof Error ? pingError.message : "Unknown";
    }

    // Test 2: Validate token with user profile endpoint
    console.log("[Debug] Testing token with /v2/user/profile...");
    try {
      const profileUrl = new URL("/v2/user/profile", UPSTOX_BASE_URL);
      const profileResponse = await fetch(profileUrl.toString(), {
        method: "GET",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json",
          "Authorization": `Bearer ${cleanToken}`,
        },
        signal: AbortSignal.timeout(15000),
      });

      results.profileStatus = profileResponse.status;
      results.profileHeaders = Object.fromEntries(profileResponse.headers.entries());

      const profileText = await profileResponse.text();
      results.profileResponseLength = profileText.length;
      
      try {
        const profileJson = JSON.parse(profileText);
        results.profileResponse = profileJson;
        results.tokenValid = profileJson.status === "success";
        
        if (profileJson.status === "success" && profileJson.data) {
          results.userId = profileJson.data.user_id;
          results.userName = profileJson.data.user_name;
          results.email = profileJson.data.email;
        }
      } catch {
        results.profileResponseRaw = profileText.substring(0, 500);
        results.tokenValid = false;
      }
    } catch (profileError) {
      results.profileError = profileError instanceof Error ? profileError.message : "Unknown";
      results.tokenValid = false;
    }

    // Test 3: Try a simple market data call
    if (results.tokenValid) {
      console.log("[Debug] Testing market data access...");
      try {
        const marketUrl = new URL("/v2/market-quote/ltp", UPSTOX_BASE_URL);
        marketUrl.searchParams.set("instrument_key", "NSE_EQ|INE002A01018");
        
        const marketResponse = await fetch(marketUrl.toString(), {
          method: "GET",
          headers: {
            "Accept": "application/json",
            "Authorization": `Bearer ${cleanToken}`,
          },
          signal: AbortSignal.timeout(10000),
        });

        results.marketDataStatus = marketResponse.status;
        const marketText = await marketResponse.text();
        try {
          results.marketDataResponse = JSON.parse(marketText);
          results.marketDataAccess = true;
        } catch {
          results.marketDataRaw = marketText.substring(0, 300);
          results.marketDataAccess = false;
        }
      } catch (marketError) {
        results.marketDataError = marketError instanceof Error ? marketError.message : "Unknown";
        results.marketDataAccess = false;
      }
    }

    results.totalTime = `${Date.now() - startTime}ms`;

    return NextResponse.json({
      success: results.tokenValid === true,
      results,
      recommendations: getRecommendations(results),
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      results,
      totalTime: `${Date.now() - startTime}ms`,
    }, { status: 500 });
  }
}

function getRecommendations(results: Record<string, unknown>): string[] {
  const recommendations: string[] = [];

  if (!results.upstoxReachable) {
    recommendations.push("Cannot reach Upstox API. Check if your server has internet access.");
    recommendations.push("Render free tier should have outbound internet access.");
  }

  if (results.profileStatus === 401) {
    recommendations.push("Token is invalid or expired. Generate a new access token from Upstox.");
    recommendations.push("Access tokens expire daily. You need to regenerate via OAuth flow.");
  }

  if (results.profileStatus === 403) {
    recommendations.push("Token doesn't have required permissions.");
    recommendations.push("Check your Upstox app permissions in Developer Console.");
  }

  if (results.profileError?.toString().includes("timeout")) {
    recommendations.push("Request timed out. Upstox API might be slow or blocked.");
    recommendations.push("Try again in a few minutes.");
  }

  if (results.tokenValid && !results.marketDataAccess) {
    recommendations.push("Token is valid but market data access failed.");
    recommendations.push("Check if your Upstox subscription includes market data API.");
  }

  if (results.tokenValid && results.marketDataAccess) {
    recommendations.push("✅ Token is fully working! You should be able to use the scanner.");
  }

  return recommendations;
}

// Also support GET for easy browser testing
export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: "Use POST request with body: { \"accessToken\": \"your_token\" }",
    example: "curl -X POST -H 'Content-Type: application/json' -d '{\"accessToken\":\"your_token\"}' https://your-app.onrender.com/api/debug/validate-token"
  });
}
