import {
  pgTable,
  serial,
  text,
  real,
  integer,
  timestamp,
  jsonb,
  boolean,
} from "drizzle-orm/pg-core";

// Store scan snapshots for OI comparison over time
export const scanSnapshots = pgTable("scan_snapshots", {
  id: serial("id").primaryKey(),
  symbol: text("symbol").notNull(),
  instrumentKey: text("instrument_key").notNull(),
  ltp: real("ltp"),
  open: real("open"),
  high: real("high"),
  low: real("low"),
  close: real("close"),
  volume: integer("volume"),
  oi: integer("oi"),
  prevOi: integer("prev_oi"),
  changeOi: integer("change_oi"),
  avgPrice: real("avg_price"),
  netChange: real("net_change"),
  totalBuyQty: integer("total_buy_qty"),
  totalSellQty: integer("total_sell_qty"),
  optionChainData: jsonb("option_chain_data"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Store user access tokens (session-based)
export const userSessions = pgTable("user_sessions", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id").notNull().unique(),
  accessToken: text("access_token").notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Store alerts
export const alerts = pgTable("alerts", {
  id: serial("id").primaryKey(),
  symbol: text("symbol").notNull(),
  alertType: text("alert_type").notNull(),
  message: text("message").notNull(),
  score: real("score"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
