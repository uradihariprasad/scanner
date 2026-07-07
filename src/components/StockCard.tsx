"use client";

import { useState } from "react";
import type { ScannedStock, MomentumClassification, StrikeLevelSR, StrikeLevelStatus } from "@/lib/types";
import MomentumMeter from "./MomentumMeter";

interface StockCardProps {
  stock: ScannedStock;
  rank: number;
}

const classificationLabels: Record<MomentumClassification, string> = {
  long_buildup: "Long Build-up",
  short_buildup: "Short Build-up",
  long_unwinding: "Long Unwinding",
  short_covering: "Short Covering",
  neutral: "Neutral",
};

const classificationColors: Record<MomentumClassification, string> = {
  long_buildup: "bg-accent-green/10 text-accent-green border-accent-green/20",
  short_buildup: "bg-accent-red/10 text-accent-red border-accent-red/20",
  long_unwinding: "bg-accent-yellow/10 text-accent-yellow border-accent-yellow/20",
  short_covering: "bg-accent-purple/10 text-accent-purple border-accent-purple/20",
  neutral: "bg-text-muted/10 text-text-muted border-text-muted/20",
};

const classificationDescriptions: Record<MomentumClassification, string> = {
  long_buildup: "Price ↑ OI ↑ → Bullish accumulation",
  short_buildup: "Price ↓ OI ↑ → Bearish positioning",
  long_unwinding: "Price ↓ OI ↓ → Weak bullish exit",
  short_covering: "Price ↑ OI ↓ → Bearish exit",
  neutral: "No clear directional bias",
};

function fmt(n: number): string {
  if (n >= 10000000) return (n / 10000000).toFixed(2) + " Cr";
  if (n >= 100000) return (n / 100000).toFixed(2) + " L";
  if (n >= 1000) return (n / 1000).toFixed(1) + " K";
  return n.toLocaleString();
}

// Human-readable label and color for each strike status
const statusDisplay: Record<StrikeLevelStatus, { label: string; color: string; icon: string }> = {
  strong_support:           { label: "Strong Support",           color: "text-accent-green",   icon: "🟢" },
  support:                  { label: "Support",                  color: "text-accent-green/80",icon: "🟢" },
  support_strengthening:    { label: "Support Strengthening",    color: "text-accent-green",   icon: "▲" },
  support_weakening:        { label: "Support Weakening",        color: "text-accent-red",     icon: "▼" },
  strong_resistance:        { label: "Strong Resistance",        color: "text-accent-red",     icon: "🔴" },
  resistance:               { label: "Resistance",               color: "text-accent-red/80",  icon: "🔴" },
  resistance_strengthening: { label: "Resistance Strengthening", color: "text-accent-red",     icon: "▲" },
  resistance_weakening:     { label: "Resistance Weakening",     color: "text-accent-green",   icon: "▼" },
  oi_buildup:               { label: "OI Build-up",              color: "text-accent-blue",    icon: "➕" },
  oi_unwinding:             { label: "OI Unwinding",             color: "text-accent-yellow",  icon: "➖" },
  new_entry:                { label: "New Entry",                color: "text-accent-cyan",    icon: "🆕" },
  exit:                     { label: "Exit",                     color: "text-accent-yellow",  icon: "🚪" },
  neutral:                  { label: "Neutral",                  color: "text-text-muted",     icon: "—" },
};

function StatusBadge({ status }: { status: StrikeLevelStatus }) {
  const d = statusDisplay[status] || statusDisplay.neutral;
  return (
    <span className={`text-[10px] font-semibold ${d.color} whitespace-nowrap`}>
      {d.icon} {d.label}
    </span>
  );
}

function StrikeLevelRow({ level, type }: { level: StrikeLevelSR; type: "support" | "resistance" }) {
  const isSupport = type === "support";
  return (
    <tr className="text-xs border-b border-border/40 last:border-0">
      <td className={`py-1.5 font-bold ${isSupport ? "text-accent-green" : "text-accent-red"}`}>₹{level.strike}</td>
      <td className="py-1.5 text-text-primary">{fmt(level.oi)}</td>
      <td className={`py-1.5 ${level.changeOI > 0 ? "text-accent-green" : level.changeOI < 0 ? "text-accent-red" : "text-text-muted"}`}>
        {level.changeOI > 0 ? "+" : ""}{fmt(level.changeOI)}
      </td>
      <td className="py-1.5 text-text-secondary">{level.distancePercent.toFixed(1)}%</td>
      <td className="py-1.5"><StatusBadge status={level.status} /></td>
    </tr>
  );
}

export default function StockCard({ stock, rank }: StockCardProps) {
  const [expanded, setExpanded] = useState(false);

  const isPositive = stock.priceChangePercent >= 0;
  const sr = stock.supportResistance;
  const em = stock.expectedMomentum;
  const oc = stock.optionChainAnalysis;
  const oi = stock.oiAnalysis;
  const vol = stock.volumeAnalysis;

  return (
    <div className="bg-bg-card border border-border rounded-xl overflow-hidden transition-all">
      {/* Compact Header — always visible */}
      <div className="p-4 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        {/* Row 1: Name / Price / Score */}
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-text-muted bg-bg-secondary rounded-md px-1.5 py-0.5">#{rank}</span>
            <h3 className="text-sm font-bold text-text-primary">{stock.symbol}</h3>
            <span className={`text-xs px-2 py-0.5 rounded-full border ${classificationColors[stock.momentumClassification]}`}>
              {classificationLabels[stock.momentumClassification]}
            </span>
            {sr?.breakoutPotential && <span className="text-xs px-1.5 py-0.5 rounded bg-accent-green/20 text-accent-green">🚀 Breakout</span>}
            {sr?.breakdownPotential && <span className="text-xs px-1.5 py-0.5 rounded bg-accent-red/20 text-accent-red">⚠️ Breakdown</span>}
          </div>
          <div className="text-right flex items-center gap-3">
            <div>
              <p className="text-sm font-bold text-text-primary">₹{stock.currentPrice.toFixed(2)}</p>
              <p className={`text-xs font-medium ${isPositive ? "text-accent-green" : "text-accent-red"}`}>
                {isPositive ? "+" : ""}{stock.priceChangePercent.toFixed(2)}%
              </p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-bg-secondary flex items-center justify-center">
              <span className={`text-sm font-bold ${stock.institutionalScore.totalScore >= 70 ? "text-accent-green" : stock.institutionalScore.totalScore >= 50 ? "text-accent-yellow" : "text-accent-red"}`}>
                {stock.institutionalScore.totalScore}
              </span>
            </div>
          </div>
        </div>

        {/* Row 2: Strike-level immediate S/R + Expected move */}
        <div className="grid grid-cols-3 gap-2 text-xs">
          {/* Support */}
          <div className="bg-accent-green/5 border border-accent-green/10 rounded-lg p-2">
            <p className="text-text-muted text-[10px] mb-0.5">Support (Put OI)</p>
            {sr?.immediateSupport ? (
              <>
                <p className="text-accent-green font-bold">₹{sr.immediateSupport.strike}</p>
                <p className="text-text-muted text-[10px]">OI: {fmt(sr.immediateSupport.oi)} · {sr.immediateSupport.distancePercent.toFixed(1)}%↓</p>
                <StatusBadge status={sr.immediateSupport.status} />
              </>
            ) : <p className="text-text-muted">—</p>}
          </div>
          {/* Resistance */}
          <div className="bg-accent-red/5 border border-accent-red/10 rounded-lg p-2">
            <p className="text-text-muted text-[10px] mb-0.5">Resistance (Call OI)</p>
            {sr?.immediateResistance ? (
              <>
                <p className="text-accent-red font-bold">₹{sr.immediateResistance.strike}</p>
                <p className="text-text-muted text-[10px]">OI: {fmt(sr.immediateResistance.oi)} · {sr.immediateResistance.distancePercent.toFixed(1)}%↑</p>
                <StatusBadge status={sr.immediateResistance.status} />
              </>
            ) : <p className="text-text-muted">—</p>}
          </div>
          {/* Expected Move */}
          <div className={`rounded-lg p-2 border ${em?.targetDirection === "bullish" ? "bg-accent-green/5 border-accent-green/10" : em?.targetDirection === "bearish" ? "bg-accent-red/5 border-accent-red/10" : "bg-bg-secondary border-border"}`}>
            <p className="text-text-muted text-[10px] mb-0.5">Expected Move</p>
            {em ? (
              <>
                <p className={`font-bold ${em.targetDirection === "bullish" ? "text-accent-green" : em.targetDirection === "bearish" ? "text-accent-red" : "text-text-muted"}`}>
                  {em.targetDirection === "bullish" ? "↑" : em.targetDirection === "bearish" ? "↓" : "—"} ₹{em.targetPrice}
                </p>
                <p className="text-text-muted text-[10px]">
                  {em.targetDirection === "bullish" ? `${em.upsideProbability}% prob` : em.targetDirection === "bearish" ? `${em.downsideProbability}% prob` : "Neutral"}
                </p>
                <p className="text-text-muted text-[10px]">R:R 1:{em.riskRewardRatio}</p>
              </>
            ) : <p className="text-text-muted">—</p>}
          </div>
        </div>

        {/* Row 3: Momentum meter + expand hint */}
        <div className="mt-2 flex items-center gap-3">
          <div className="flex-1"><MomentumMeter score={stock.institutionalScore.totalScore} strength={stock.momentumStrength} direction={stock.momentumDirection} compact /></div>
          <span className="text-text-muted text-xs">{expanded ? "▲ Less" : "▼ More"}</span>
        </div>
      </div>

      {/* Expanded Detail — toggle */}
      {expanded && (
        <div className="border-t border-border px-4 pb-4 space-y-4">
          {/* Momentum Classification */}
          <div className="pt-3">
            <p className="text-xs text-text-secondary">{classificationDescriptions[stock.momentumClassification]}</p>
          </div>

          {/* OHLC */}
          <div className="grid grid-cols-4 gap-2">
            {([["Open", stock.open], ["High", stock.high], ["Low", stock.low], ["Close", stock.close]] as [string, number][]).map(([l, v]) => (
              <div key={l} className="bg-bg-secondary rounded-lg p-2 text-center">
                <p className="text-[10px] text-text-muted">{l}</p>
                <p className="text-xs font-bold text-text-primary">₹{v.toFixed(2)}</p>
              </div>
            ))}
          </div>

          {/* Strike-Level Support Table */}
          {sr && sr.supportLevels.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-accent-green mb-1">↓ Support Levels (Put OI below price)</h4>
              <table className="w-full text-xs">
                <thead><tr className="text-text-muted text-[10px] border-b border-border">
                  <th className="text-left py-1">Strike</th><th className="text-left py-1">OI</th><th className="text-left py-1">Chg OI</th><th className="text-left py-1">Dist</th><th className="text-left py-1">Status</th>
                </tr></thead>
                <tbody>{sr.supportLevels.map(l => <StrikeLevelRow key={l.strike} level={l} type="support" />)}</tbody>
              </table>
            </div>
          )}

          {/* Strike-Level Resistance Table */}
          {sr && sr.resistanceLevels.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-accent-red mb-1">↑ Resistance Levels (Call OI above price)</h4>
              <table className="w-full text-xs">
                <thead><tr className="text-text-muted text-[10px] border-b border-border">
                  <th className="text-left py-1">Strike</th><th className="text-left py-1">OI</th><th className="text-left py-1">Chg OI</th><th className="text-left py-1">Dist</th><th className="text-left py-1">Status</th>
                </tr></thead>
                <tbody>{sr.resistanceLevels.map(l => <StrikeLevelRow key={l.strike} level={l} type="resistance" />)}</tbody>
              </table>
            </div>
          )}

          {/* Expected Range */}
          {sr && (
            <div className="bg-bg-secondary rounded-lg p-3 flex items-center justify-between text-xs">
              <span className="text-text-muted">Expected Range</span>
              <span><span className="text-accent-green font-bold">₹{sr.expectedFloor.toFixed(0)}</span> <span className="text-text-muted">→</span> <span className="text-accent-red font-bold">₹{sr.expectedCeiling.toFixed(0)}</span></span>
            </div>
          )}

          {/* Expected Momentum Detail */}
          {em && (
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-accent-green/5 border border-accent-green/10 rounded-lg p-2">
                <p className="text-text-muted text-[10px]">Upside Target</p>
                <p className="text-accent-green font-bold">₹{em.immediateResistance.toFixed(0)} (+{em.expectedUpsidePercent.toFixed(1)}%)</p>
                <div className="w-full h-1.5 bg-bg-secondary rounded-full mt-1"><div className="h-full bg-accent-green rounded-full" style={{ width: `${em.upsideProbability}%` }} /></div>
                <p className="text-text-muted text-[10px] mt-0.5">Probability: {em.upsideProbability}%</p>
              </div>
              <div className="bg-accent-red/5 border border-accent-red/10 rounded-lg p-2">
                <p className="text-text-muted text-[10px]">Downside Target</p>
                <p className="text-accent-red font-bold">₹{em.immediateSupport.toFixed(0)} (-{em.expectedDownsidePercent.toFixed(1)}%)</p>
                <div className="w-full h-1.5 bg-bg-secondary rounded-full mt-1"><div className="h-full bg-accent-red rounded-full" style={{ width: `${em.downsideProbability}%` }} /></div>
                <p className="text-text-muted text-[10px] mt-0.5">Probability: {em.downsideProbability}%</p>
              </div>
            </div>
          )}

          {/* Key levels */}
          {em && (
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="bg-bg-secondary rounded-lg p-2"><p className="text-[10px] text-text-muted">Max Pain</p><p className="font-medium text-text-primary">₹{em.maxPainStrike}</p></div>
              <div className="bg-bg-secondary rounded-lg p-2"><p className="text-[10px] text-text-muted">Pivot</p><p className="font-medium text-text-primary">₹{em.pivotStrike}</p></div>
              <div className="bg-bg-secondary rounded-lg p-2"><p className="text-[10px] text-text-muted">R:R Ratio</p><p className={`font-medium ${em.riskRewardRatio >= 2 ? "text-accent-green" : em.riskRewardRatio >= 1 ? "text-accent-yellow" : "text-accent-red"}`}>1:{em.riskRewardRatio}</p></div>
            </div>
          )}

          {/* Score Breakdown */}
          <div>
            <h4 className="text-xs font-semibold text-text-primary mb-2">Institutional Score Breakdown</h4>
            <div className="space-y-1.5">
              {([
                ["Volume", stock.institutionalScore.volumeStrength],
                ["Option Chain", stock.institutionalScore.optionChainStrength],
                ["OI Strength", stock.institutionalScore.oiStrength],
                ["Price Momentum", stock.institutionalScore.priceMomentum],
                ["Support", stock.institutionalScore.supportStrength],
                ["Resistance", stock.institutionalScore.resistanceWeakness],
              ] as [string, number][]).map(([label, val]) => (
                <div key={label} className="flex items-center gap-2 text-xs">
                  <span className="text-text-muted w-28 shrink-0">{label}</span>
                  <div className="flex-1 h-1.5 bg-bg-secondary rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${val >= 70 ? "bg-accent-green" : val >= 50 ? "bg-accent-yellow" : val >= 30 ? "bg-accent-yellow/70" : "bg-accent-red"}`} style={{ width: `${val}%` }} />
                  </div>
                  <span className="text-text-secondary w-8 text-right">{val}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Volume / OI metrics */}
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="bg-bg-secondary rounded-lg p-2"><p className="text-[10px] text-text-muted">Volume</p><p className="text-text-primary font-medium">{fmt(vol.currentVolume)}</p><p className="text-text-muted text-[10px]">Rel: {vol.relativeVolume}x {vol.volumeSpike ? "🔥" : ""}</p></div>
            <div className="bg-bg-secondary rounded-lg p-2"><p className="text-[10px] text-text-muted">OI</p><p className="text-text-primary font-medium">{fmt(oi.currentOI)}</p><p className={`text-[10px] ${oi.changeInOI >= 0 ? "text-accent-green" : "text-accent-red"}`}>{oi.changeInOI >= 0 ? "+" : ""}{fmt(oi.changeInOI)}</p></div>
            <div className="bg-bg-secondary rounded-lg p-2"><p className="text-[10px] text-text-muted">PCR</p><p className={`font-medium ${oc ? (oc.overallPCR > 1 ? "text-accent-green" : "text-accent-red") : "text-text-muted"}`}>{oc ? oc.overallPCR.toFixed(2) : "—"}</p><p className="text-text-muted text-[10px]">{oi.positionStrength}</p></div>
          </div>

          {/* Option chain max OI strikes */}
          {oc && (
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-bg-secondary rounded-lg p-2">
                <p className="text-[10px] text-text-muted">Max Call OI @ ₹{oc.highestCallOI.strike}</p>
                <p className="text-accent-red font-medium">{fmt(oc.highestCallOI.oi)}</p>
              </div>
              <div className="bg-bg-secondary rounded-lg p-2">
                <p className="text-[10px] text-text-muted">Max Put OI @ ₹{oc.highestPutOI.strike}</p>
                <p className="text-accent-green font-medium">{fmt(oc.highestPutOI.oi)}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
