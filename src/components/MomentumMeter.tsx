"use client";

import type { MomentumStrength } from "@/lib/types";

interface MomentumMeterProps {
  score: number;
  strength: MomentumStrength;
  direction: "bullish" | "bearish" | "neutral";
  compact?: boolean;
}

const strengthLabels: Record<MomentumStrength, string> = {
  very_strong: "Very Strong",
  strong: "Strong",
  moderate: "Moderate",
  weak: "Weak",
  very_weak: "Very Weak",
};

export default function MomentumMeter({
  score,
  strength,
  direction,
  compact = false,
}: MomentumMeterProps) {
  const getColor = () => {
    if (score >= 70) return "bg-accent-green";
    if (score >= 50) return "bg-accent-yellow";
    if (score >= 30) return "bg-accent-yellow/70";
    return "bg-accent-red";
  };

  const getTextColor = () => {
    if (score >= 70) return "text-accent-green";
    if (score >= 50) return "text-accent-yellow";
    if (score >= 30) return "text-accent-yellow/70";
    return "text-accent-red";
  };

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-bg-secondary rounded-full overflow-hidden">
          <div
            className={`h-full ${getColor()} rounded-full animate-momentum-fill`}
            style={{ width: `${score}%` }}
          />
        </div>
        <span className={`text-xs font-bold ${getTextColor()}`}>{score}%</span>
      </div>
    );
  }

  return (
    <div className="p-3 bg-bg-secondary rounded-lg">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-text-muted uppercase tracking-wider">
          Momentum
        </span>
        <span className={`text-lg font-bold ${getTextColor()}`}>{score}%</span>
      </div>
      <div className="w-full h-2 bg-bg-primary rounded-full overflow-hidden mb-2">
        <div
          className={`h-full ${getColor()} rounded-full animate-momentum-fill`}
          style={{ width: `${score}%` }}
        />
      </div>
      <div className="flex items-center justify-between">
        <span className={`text-xs font-medium ${getTextColor()}`}>
          {strengthLabels[strength]}
        </span>
        <span
          className={`text-xs px-2 py-0.5 rounded-full ${
            direction === "bullish"
              ? "bg-accent-green/10 text-accent-green"
              : direction === "bearish"
                ? "bg-accent-red/10 text-accent-red"
                : "bg-text-muted/10 text-text-muted"
          }`}
        >
          {direction.charAt(0).toUpperCase() + direction.slice(1)}
        </span>
      </div>
    </div>
  );
}
