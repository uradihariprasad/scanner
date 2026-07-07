"use client";

import { useState, useEffect, useCallback } from "react";
import type { ScannerState, AlertItem, SortField, SortDirection, ScannedStock } from "@/lib/types";
import LoginPage from "@/components/LoginPage";
import DashboardHeader from "@/components/DashboardHeader";
import MarketStatusBar from "@/components/MarketStatusBar";
import StockLeaderboard from "@/components/StockLeaderboard";
import LoadingOverlay from "@/components/LoadingOverlay";

function getSessionId(): string {
  if (typeof window === "undefined") return "";
  let sid = localStorage.getItem("scanner_session_id");
  if (!sid) {
    sid = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    localStorage.setItem("scanner_session_id", sid);
  }
  return sid;
}

export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [sessionId, setSessionId] = useState("");
  const [scannerState, setScannerState] = useState<ScannerState & { ocStats?: { success: number; failed: number; skipped: number } }>({
    bullishStocks: [],
    bearishStocks: [],
    allStocks: [],
    marketStatus: "closed",
    lastScanTime: "",
    totalScanned: 0,
    totalFiltered: 0,
    isScanning: false,
    scanError: null,
  });
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("score");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [activeTab, setActiveTab] = useState<"bullish" | "bearish" | "all">("all");
  const [isScanning, setIsScanning] = useState(false);
  const [scanInterval, setScanIntervalState] = useState<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const sid = getSessionId();
    setSessionId(sid);
    fetch(`/api/auth/token?sessionId=${sid}`)
      .then((r) => r.json())
      .then((data) => {
        setIsAuthenticated(data.authenticated === true);
        setIsCheckingAuth(false);
      })
      .catch(() => setIsCheckingAuth(false));
  }, []);

  const runScan = useCallback(async () => {
    if (!sessionId || isScanning) return;
    setIsScanning(true);
    setScannerState((prev) => ({ ...prev, isScanning: true, scanError: null }));

    try {
      const res = await fetch(`/api/scanner?sessionId=${sessionId}`);
      const data = await res.json();

      if (data.error) {
        setScannerState((prev) => ({ ...prev, isScanning: false, scanError: data.error }));
      } else {
        setScannerState({
          bullishStocks: data.bullishStocks || [],
          bearishStocks: data.bearishStocks || [],
          allStocks: data.allStocks || [],
          marketStatus: data.marketStatus || "closed",
          lastScanTime: data.lastScanTime || new Date().toISOString(),
          totalScanned: data.totalScanned || 0,
          totalFiltered: data.totalFiltered || 0,
          isScanning: false,
          scanError: data.scanError || null,
          ocStats: data.ocStats || undefined,
        });
        if (data.alerts && data.alerts.length > 0) {
          setAlerts((prev) => [...data.alerts, ...prev].slice(0, 50));
        }
      }
    } catch (err) {
      setScannerState((prev) => ({
        ...prev,
        isScanning: false,
        scanError: err instanceof Error ? err.message : "Scan failed",
      }));
    } finally {
      setIsScanning(false);
    }
  }, [sessionId, isScanning]);

  useEffect(() => {
    if (!isAuthenticated || !sessionId) return;
    runScan();
    const interval = setInterval(runScan, 60000);
    setScanIntervalState(interval);
    return () => { clearInterval(interval); setScanIntervalState(null); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, sessionId]);

  const handleLogin = () => setIsAuthenticated(true);

  const handleLogout = async () => {
    if (scanInterval) clearInterval(scanInterval);
    await fetch("/api/auth/token", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    });
    setIsAuthenticated(false);
    setScannerState({ bullishStocks: [], bearishStocks: [], allStocks: [], marketStatus: "closed", lastScanTime: "", totalScanned: 0, totalFiltered: 0, isScanning: false, scanError: null });
    setAlerts([]);
  };

  const getDisplayStocks = (): ScannedStock[] => {
    let stocks: ScannedStock[] = [];
    if (activeTab === "bullish") stocks = [...scannerState.bullishStocks];
    else if (activeTab === "bearish") stocks = [...scannerState.bearishStocks];
    else stocks = [...scannerState.allStocks];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      stocks = stocks.filter((s) => s.symbol.toLowerCase().includes(q));
    }

    stocks.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "score": cmp = a.institutionalScore.totalScore - b.institutionalScore.totalScore; break;
        case "volume": cmp = a.volumeAnalysis.currentVolume - b.volumeAnalysis.currentVolume; break;
        case "momentum": cmp = a.institutionalScore.totalScore - b.institutionalScore.totalScore; break;
        case "oi": cmp = a.oiAnalysis.currentOI - b.oiAnalysis.currentOI; break;
        case "changeOi": cmp = a.oiAnalysis.changeInOI - b.oiAnalysis.changeInOI; break;
        case "priceChange": cmp = a.priceChangePercent - b.priceChangePercent; break;
        case "alphabetical": cmp = a.symbol.localeCompare(b.symbol); break;
      }
      return sortDirection === "desc" ? -cmp : cmp;
    });

    return stocks;
  };

  if (isCheckingAuth) return <LoadingOverlay message="Initializing scanner..." />;
  if (!isAuthenticated) return <LoginPage sessionId={sessionId} onLogin={handleLogin} />;

  const displayStocks = getDisplayStocks();

  return (
    <div className="min-h-screen flex flex-col">
      <DashboardHeader onLogout={handleLogout} onRefresh={runScan} isScanning={scannerState.isScanning} lastScanTime={scannerState.lastScanTime} />
      <MarketStatusBar marketStatus={scannerState.marketStatus} totalScanned={scannerState.totalScanned} totalFiltered={scannerState.totalFiltered} scanError={scannerState.scanError} ocStats={scannerState.ocStats} />

      {/* Alerts banner */}
      {alerts.length > 0 && (
        <div className="bg-bg-card border-b border-border px-4 py-2 flex items-center gap-3 overflow-x-auto shrink-0">
          <span className="text-xs text-accent-yellow shrink-0">🔔 Alerts:</span>
          {alerts.slice(0, 5).map((a) => (
            <span key={a.id} className="text-xs text-text-secondary shrink-0 bg-bg-secondary rounded-full px-3 py-1">{a.message}</span>
          ))}
          {alerts.length > 5 && <span className="text-xs text-text-muted shrink-0">+{alerts.length - 5} more</span>}
          <button onClick={() => setAlerts([])} className="text-xs text-text-muted hover:text-text-secondary shrink-0 ml-auto">Clear</button>
        </div>
      )}

      {/* Toolbar */}
      <div className="px-4 py-3 border-b border-border flex flex-wrap items-center gap-3 shrink-0">
        <div className="flex bg-bg-secondary rounded-lg p-1">
          {(["all", "bullish", "bearish"] as const).map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab
                ? tab === "bullish" ? "bg-accent-green/20 text-accent-green"
                  : tab === "bearish" ? "bg-accent-red/20 text-accent-red"
                    : "bg-accent-blue/20 text-accent-blue"
                : "text-text-secondary hover:text-text-primary"
            }`}>
              {tab === "all" ? `All (${scannerState.allStocks.length})` : tab === "bullish" ? `Bullish (${scannerState.bullishStocks.length})` : `Bearish (${scannerState.bearishStocks.length})`}
            </button>
          ))}
        </div>
        <div className="flex-1 min-w-[200px]">
          <input type="text" placeholder="Search stock..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full max-w-sm px-3 py-1.5 bg-bg-secondary border border-border rounded-lg text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-blue" />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-text-muted">Sort:</label>
          <select value={sortField} onChange={(e) => setSortField(e.target.value as SortField)} className="px-2 py-1.5 bg-bg-secondary border border-border rounded-lg text-sm text-text-primary focus:outline-none">
            <option value="score">Score</option>
            <option value="volume">Volume</option>
            <option value="oi">Open Interest</option>
            <option value="changeOi">Change OI</option>
            <option value="priceChange">Price Change</option>
            <option value="alphabetical">A-Z</option>
          </select>
          <button onClick={() => setSortDirection((d) => (d === "desc" ? "asc" : "desc"))} className="px-2 py-1.5 bg-bg-secondary border border-border rounded-lg text-sm text-text-secondary hover:text-text-primary">
            {sortDirection === "desc" ? "↓" : "↑"}
          </button>
        </div>
      </div>

      {/* Stock List */}
      <div className="flex-1 overflow-y-auto p-4">
        {scannerState.isScanning && displayStocks.length === 0 ? (
          <LoadingOverlay message="Scanning NSE F&O stocks..." />
        ) : displayStocks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-text-muted">
            <svg className="w-16 h-16 mb-4 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <p className="text-lg">No stocks match current filters</p>
            <p className="text-sm mt-1">{scannerState.scanError || "Try adjusting your filters or wait for the next scan"}</p>
          </div>
        ) : (
          <StockLeaderboard stocks={displayStocks} />
        )}
      </div>
    </div>
  );
}
