/**
 * Upstox API Service
 * Handles all communication with Upstox REST API v2
 * All methods require a valid access token
 */

const UPSTOX_BASE_URL = "https://api.upstox.com";

interface UpstoxResponse<T> {
  status: string;
  data: T;
}

// ---- Full Market Quote Types ----
interface UpstoxOHLC {
  open: number;
  high: number;
  low: number;
  close: number;
}

interface UpstoxDepthEntry {
  quantity: number;
  price: number;
  orders: number;
}

interface UpstoxFullQuote {
  ohlc: UpstoxOHLC;
  depth: {
    buy: UpstoxDepthEntry[];
    sell: UpstoxDepthEntry[];
  };
  timestamp: string;
  instrument_token: string;
  symbol: string;
  last_price: number;
  volume: number;
  average_price: number;
  oi: number;
  net_change: number;
  total_buy_quantity: number;
  total_sell_quantity: number;
  lower_circuit_limit: number;
  upper_circuit_limit: number;
  last_trade_time: string;
  oi_day_high: number;
  oi_day_low: number;
}

// ---- Option Chain Types ----
interface UpstoxOptionMarketData {
  ltp: number;
  volume: number;
  oi: number;
  close_price: number;
  bid_price: number;
  bid_qty: number;
  ask_price: number;
  ask_qty: number;
  prev_oi: number;
}

interface UpstoxOptionGreeks {
  vega: number;
  theta: number;
  gamma: number;
  delta: number;
  iv: number;
  pop: number;
}

interface UpstoxOptionChainEntry {
  expiry: string;
  pcr: number;
  strike_price: number;
  underlying_key: string;
  underlying_spot_price: number;
  call_options: {
    instrument_key: string;
    market_data: UpstoxOptionMarketData;
    option_greeks: UpstoxOptionGreeks;
  };
  put_options: {
    instrument_key: string;
    market_data: UpstoxOptionMarketData;
    option_greeks: UpstoxOptionGreeks;
  };
}

// Option contract type from /v2/option/contract
interface UpstoxOptionContract {
  name: string;
  segment: string;
  exchange: string;
  expiry: string; // YYYY-MM-DD format
  instrument_key: string;
  exchange_token: string;
  trading_symbol: string;
  tick_size: number;
  lot_size: number;
  instrument_type: string;
  freeze_quantity: number;
  underlying_key: string;
  underlying_type: string;
  underlying_symbol: string;
  strike_price: number;
  minimum_lot: number;
  weekly: boolean;
}

async function upstoxFetch<T>(
  endpoint: string,
  accessToken: string,
  params?: Record<string, string>
): Promise<{ data: T | null; error: string | null }> {
  try {
    const url = new URL(endpoint, UPSTOX_BASE_URL);
    if (params) {
      Object.entries(params).forEach(([key, val]) => {
        // URL encode the value properly
        url.searchParams.set(key, val);
      });
    }

    console.log(`[Upstox API] Fetching: ${url.toString()}`);

    const response = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      signal: AbortSignal.timeout(30000), // Increased timeout
    });

    const responseText = await response.text();
    
    if (!response.ok) {
      console.error(`[Upstox API] Error ${response.status}: ${endpoint}`, responseText.substring(0, 500));
      return { data: null, error: `HTTP ${response.status}: ${responseText.substring(0, 200)}` };
    }

    let result: UpstoxResponse<T>;
    try {
      result = JSON.parse(responseText);
    } catch (parseErr) {
      console.error(`[Upstox API] JSON parse error: ${endpoint}`, parseErr);
      return { data: null, error: "Invalid JSON response" };
    }

    if (result.status !== "success") {
      console.error(`[Upstox API] Non-success status: ${endpoint}`, result);
      return { data: null, error: `API returned status: ${result.status}` };
    }

    return { data: result.data, error: null };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "Unknown error";
    console.error(`[Upstox API] Fetch error: ${endpoint}`, errMsg);
    return { data: null, error: errMsg };
  }
}

/**
 * Fetch full market quotes for up to 500 instruments
 */
export async function getFullMarketQuotes(
  instrumentKeys: string[],
  accessToken: string
): Promise<Record<string, UpstoxFullQuote> | null> {
  if (instrumentKeys.length === 0) return null;
  
  // URL encode the keys and join
  const keysParam = instrumentKeys.join(",");
  const result = await upstoxFetch<Record<string, UpstoxFullQuote>>(
    "/v2/market-quote/quotes",
    accessToken,
    { instrument_key: keysParam }
  );
  
  return result.data;
}

/**
 * Fetch option contracts to find available expiry dates
 * This returns all option contracts for the given underlying
 */
export async function getOptionContracts(
  instrumentKey: string,
  accessToken: string
): Promise<{ contracts: UpstoxOptionContract[] | null; error: string | null }> {
  const result = await upstoxFetch<UpstoxOptionContract[]>(
    "/v2/option/contract",
    accessToken,
    { instrument_key: instrumentKey }
  );
  
  return { contracts: result.data, error: result.error };
}

/**
 * Fetch option chain for a specific instrument and expiry
 */
export async function getOptionChain(
  instrumentKey: string,
  expiryDate: string,
  accessToken: string
): Promise<{ chain: UpstoxOptionChainEntry[] | null; error: string | null }> {
  const result = await upstoxFetch<UpstoxOptionChainEntry[]>(
    "/v2/option/chain",
    accessToken,
    {
      instrument_key: instrumentKey,
      expiry_date: expiryDate,
    }
  );
  
  return { chain: result.data, error: result.error };
}

/**
 * Validate access token by checking user profile
 * Returns detailed result for debugging
 */
export async function validateToken(
  accessToken: string
): Promise<{ valid: boolean; error?: string; details?: string }> {
  try {
    if (!accessToken || accessToken.trim().length === 0) {
      return { valid: false, error: "Token is empty" };
    }

    // Clean the token (remove any whitespace/newlines)
    const cleanToken = accessToken.trim();
    
    console.log(`[Upstox] Validating token (length: ${cleanToken.length})`);
    
    const url = new URL("/v2/user/profile", UPSTOX_BASE_URL);
    
    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Authorization": `Bearer ${cleanToken}`,
      },
      signal: AbortSignal.timeout(15000), // 15 second timeout
    });

    const responseText = await response.text();
    console.log(`[Upstox] Validation response status: ${response.status}`);
    
    if (!response.ok) {
      console.error(`[Upstox] Token validation failed: ${response.status}`, responseText.substring(0, 200));
      return { 
        valid: false, 
        error: `API returned ${response.status}`,
        details: responseText.substring(0, 200)
      };
    }

    let result;
    try {
      result = JSON.parse(responseText);
    } catch (parseErr) {
      return { valid: false, error: "Invalid JSON response from Upstox" };
    }

    if (result.status === "success") {
      console.log(`[Upstox] Token valid for user: ${result.data?.user_id || 'unknown'}`);
      return { valid: true };
    } else {
      return { 
        valid: false, 
        error: result.message || "Token validation failed",
        details: JSON.stringify(result).substring(0, 200)
      };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error(`[Upstox] Token validation error:`, errorMessage);
    
    // Check for specific error types
    if (errorMessage.includes("timeout") || errorMessage.includes("abort")) {
      return { valid: false, error: "Connection timeout - Upstox API not responding" };
    }
    if (errorMessage.includes("fetch") || errorMessage.includes("network")) {
      return { valid: false, error: "Network error - Cannot reach Upstox API" };
    }
    
    return { valid: false, error: errorMessage };
  }
}

/**
 * Get nearest expiry date from option contracts
 * Returns date in YYYY-MM-DD format
 */
export function getNearestExpiry(
  contracts: UpstoxOptionContract[]
): string | null {
  if (!contracts || contracts.length === 0) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayTime = today.getTime();

  // Filter valid future expiries and sort
  const validExpiries = contracts
    .map((c) => c.expiry)
    .filter((expiry) => {
      if (!expiry) return false;
      const expiryDate = new Date(expiry);
      return expiryDate.getTime() >= todayTime;
    })
    .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

  // Remove duplicates
  const uniqueExpiries = [...new Set(validExpiries)];
  
  if (uniqueExpiries.length === 0) return null;
  
  // Return nearest expiry
  return uniqueExpiries[0];
}

/**
 * Get all unique expiry dates from option contracts
 */
export function getAllExpiries(
  contracts: UpstoxOptionContract[]
): string[] {
  if (!contracts || contracts.length === 0) return [];

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayTime = today.getTime();

  const validExpiries = contracts
    .map((c) => c.expiry)
    .filter((expiry) => {
      if (!expiry) return false;
      const expiryDate = new Date(expiry);
      return expiryDate.getTime() >= todayTime;
    })
    .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

  return [...new Set(validExpiries)];
}

export type {
  UpstoxFullQuote,
  UpstoxOptionChainEntry,
  UpstoxOptionMarketData,
  UpstoxOptionGreeks,
  UpstoxOptionContract,
};
