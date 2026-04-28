import { z } from "zod";

export const createAccountSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(["CHECKING", "SAVINGS", "CREDIT_CARD", "CASH", "BROKER", "WALLET"]),
  currency: z.string().min(2).max(10).default("CLP"),
  initialBalance: z.number().default(0),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().nullable(),
});

export const updateAccountSchema = createAccountSchema.partial();

export type CreateAccountInput = z.infer<typeof createAccountSchema>;
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;
