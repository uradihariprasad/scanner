"use client";

interface DashboardHeaderProps {
  onLogout: () => void;
  onRefresh: () => void;
  isScanning: boolean;
  lastScanTime: string;
}

export default function DashboardHeader({
  onLogout,
  onRefresh,
  isScanning,
  lastScanTime,
}: DashboardHeaderProps) {
  const formatTime = (iso: string) => {
    if (!iso) return "--:--:--";
    try {
      return new Date(iso).toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      });
    } catch {
      return "--:--:--";
    }
  };

  return (
    <header className="bg-bg-secondary border-b border-border px-4 py-2 flex items-center justify-between shrink-0">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-accent-blue/10 border border-accent-blue/20 flex items-center justify-center">
            <svg
              className="w-4 h-4 text-accent-blue"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
              />
            </svg>
          </div>
          <div>
            <h1 className="text-sm font-bold text-text-primary leading-tight">
              AI Institutional Momentum Scanner
            </h1>
            <p className="text-xs text-text-muted">NSE F&O • Live</p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Last Updated */}
        <div className="text-xs text-text-muted flex items-center gap-1.5">
          {isScanning && (
            <div className="w-2 h-2 rounded-full bg-accent-green animate-pulse-live" />
          )}
          <span>Last scan: {formatTime(lastScanTime)}</span>
        </div>

        {/* Refresh */}
        <button
          onClick={onRefresh}
          disabled={isScanning}
          className="px-3 py-1.5 bg-bg-card border border-border rounded-lg text-sm text-text-secondary hover:text-text-primary hover:border-border-bright disabled:opacity-50 transition-all flex items-center gap-1.5"
        >
          <svg
            className={`w-3.5 h-3.5 ${isScanning ? "animate-spin" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          {isScanning ? "Scanning..." : "Refresh"}
        </button>

        {/* Logout */}
        <button
          onClick={onLogout}
          className="px-3 py-1.5 bg-accent-red/10 border border-accent-red/20 rounded-lg text-sm text-accent-red hover:bg-accent-red/20 transition-colors"
        >
          Disconnect
        </button>
      </div>
    </header>
  );
}
