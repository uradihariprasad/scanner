"use client";

interface MarketStatusBarProps {
  marketStatus: "open" | "closed" | "pre_open" | "post_close";
  totalScanned: number;
  totalFiltered: number;
  scanError: string | null;
}

interface OcStats {
  success: number;
  failed: number;
  skipped: number;
}

interface MarketStatusBarPropsExtended extends MarketStatusBarProps {
  ocStats?: OcStats;
}

export default function MarketStatusBar({
  marketStatus,
  totalScanned,
  totalFiltered,
  scanError,
  ocStats,
}: MarketStatusBarPropsExtended & { ocStats?: OcStats }) {
  const statusConfig = {
    open: { label: "Market Open", color: "bg-accent-green", textColor: "text-accent-green" },
    closed: { label: "Market Closed", color: "bg-accent-red", textColor: "text-accent-red" },
    pre_open: { label: "Pre-Market", color: "bg-accent-yellow", textColor: "text-accent-yellow" },
    post_close: { label: "Post-Market", color: "bg-accent-yellow", textColor: "text-accent-yellow" },
  };

  const config = statusConfig[marketStatus];

  return (
    <div className="bg-bg-card border-b border-border px-4 py-2 flex items-center justify-between shrink-0">
      <div className="flex items-center gap-4">
        {/* Market Status */}
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${config.color} ${marketStatus === "open" ? "animate-pulse-live" : ""}`} />
          <span className={`text-sm font-medium ${config.textColor}`}>
            {config.label}
          </span>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-3 text-xs text-text-muted">
          <span>
            Scanned: <span className="text-text-secondary font-medium">{totalScanned}</span>
          </span>
          <span className="text-border">|</span>
          <span>
            Filtered: <span className="text-text-secondary font-medium">{totalFiltered}</span>
          </span>
          {ocStats && (
            <>
              <span className="text-border">|</span>
              <span>
                Option Chain: <span className="text-accent-green font-medium">{ocStats.success}</span>
                {ocStats.failed > 0 && (
                  <span className="text-accent-red ml-1">({ocStats.failed} failed)</span>
                )}
              </span>
            </>
          )}
        </div>
      </div>

      {scanError && (
        <div className="text-xs text-accent-yellow flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
            />
          </svg>
          {scanError}
        </div>
      )}
    </div>
  );
}
