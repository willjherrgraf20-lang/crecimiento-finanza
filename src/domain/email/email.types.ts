export interface ParsedEmailTx {
  amount: number;
  type: "INCOME" | "EXPENSE";
  description: string;
  date: Date;
  currency: string;
  confidence: "high" | "medium" | "low";
  rawSubject: string;
  rawSnippet?: string;
  gmailMessageId: string;
  receivedAt: Date;
}

export interface GmailTokenData {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  scope: string;
}

export interface GmailMessage {
  id: string;
  threadId: string;
  snippet: string;
  payload?: {
    headers?: { name: string; value: string }[];
    body?: { data?: string };
    parts?: Array<{ mimeType: string; body?: { data?: string } }>;
  };
  internalDate?: string;
}
