import { z } from "zod";

export const createHoldingSchema = z.object({
  accountId: z.string().uuid(),
  ticker: z.string().min(1).max(20).toUpperCase(),
  name: z.string().min(1).max(100),
  type: z.enum(["ETF", "STOCK", "CRYPTO", "BOND", "COMMODITY"]),
  quantity: z.number().positive(),
  avgCost: z.number().positive(),
  currency: z.string().length(3).default("USD"),
});

export const updateHoldingSchema = z.object({
  quantity: z.number().positive().optional(),
  avgCost: z.number().positive().optional(),
});

export const addTradeSchema = z.object({
  accountId: z.string().uuid(),
  assetId: z.string().uuid(),
  type: z.enum(["BUY", "SELL", "DEPOSIT", "WITHDRAW", "DIVIDEND", "SPLIT"]),
  quantity: z.number().positive().optional(),
  price: z.number().positive().optional(),
  fee: z.number().min(0).optional(),
  totalAmount: z.number(),
  currency: z.string().length(3).default("USD"),
  tradeDate: z.string().datetime(),
  notes: z.string().max(500).optional(),
});

export type CreateHoldingInput = z.infer<typeof createHoldingSchema>;
export type UpdateHoldingInput = z.infer<typeof updateHoldingSchema>;
export type AddTradeInput = z.infer<typeof addTradeSchema>;
