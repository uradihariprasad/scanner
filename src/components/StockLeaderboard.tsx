"use client";

import type { ScannedStock } from "@/lib/types";
import StockCard from "./StockCard";

interface StockLeaderboardProps {
  stocks: ScannedStock[];
}

export default function StockLeaderboard({ stocks }: StockLeaderboardProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {stocks.map((stock, index) => (
        <StockCard key={stock.symbol} stock={stock} rank={index + 1} />
      ))}
    </div>
  );
}
