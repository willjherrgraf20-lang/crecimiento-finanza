export type AssetType = "ETF" | "STOCK" | "CRYPTO" | "BOND" | "COMMODITY";

export interface MarketAsset {
  id: string;
  symbol: string;
  type: AssetType;
  currency: string;
}

export interface PriceQuote {
  assetId: string;
  symbol: string;
  price: number;
  currency: string;
  source: string;
  asOf: Date;
}

export async function getLatestPricesForAssets(assets: MarketAsset[]): Promise<PriceQuote[]> {
  if (assets.length === 0) return [];

  const cryptoAssets = assets.filter((a) => a.type === "CRYPTO");
  const nonCryptoAssets = assets.filter((a) => a.type !== "CRYPTO");

  const [cryptoQuotes, marketQuotes] = await Promise.all([
    fetchCryptoPrices(cryptoAssets),
    fetchEtfAndStockPrices(nonCryptoAssets),
  ]);

  return [...cryptoQuotes, ...marketQuotes];
}

async function fetchCryptoPrices(assets: MarketAsset[]): Promise<PriceQuote[]> {
  if (assets.length === 0) return [];

  const symbolMap = new Map<string, MarketAsset>();
  for (const a of assets) {
    const binanceSym = mapToBinanceSymbol(a.symbol);
    if (binanceSym) symbolMap.set(binanceSym, a);
  }

  if (symbolMap.size === 0) return [];

  try {
    const symbolsJson = JSON.stringify([...symbolMap.keys()]);
    const url = `https://api.binance.com/api/v3/ticker/price?symbols=${encodeURIComponent(symbolsJson)}`;
    const data = await httpGetJson<{ symbol: string; price: string }[]>(url);
    const asOf = new Date();

    return data
      .map((item) => {
        const asset = symbolMap.get(item.symbol);
        if (!asset) return null;
        const price = parseFloat(item.price);
        if (isNaN(price)) return null;
        return { assetId: asset.id, symbol: asset.symbol, price, currency: "USD", source: "binance", asOf } satisfies PriceQuote;
      })
      .filter((q): q is PriceQuote => q !== null);
  } catch (err) {
    console.error("[marketData] Error fetching crypto batch from Binance:", err);
    return fetchCryptoPricesOneByOne(assets);
  }
}

async function fetchCryptoPricesOneByOne(assets: MarketAsset[]): Promise<PriceQuote[]> {
  const results: PriceQuote[] = [];
  for (const asset of assets) {
    const binanceSym = mapToBinanceSymbol(asset.symbol);
    if (!binanceSym) continue;
    try {
      const data = await httpGetJson<{ symbol: string; price: string }>(
        `https://api.binance.com/api/v3/ticker/price?symbol=${binanceSym}`
      );
      const price = parseFloat(data.price);
      if (!isNaN(price)) {
        results.push({ assetId: asset.id, symbol: asset.symbol, price, currency: "USD", source: "binance", asOf: new Date() });
      }
    } catch (err) {
      console.warn(`[marketData] No se pudo obtener precio para ${asset.symbol}:`, err);
    }
  }
  return results;
}

async function fetchEtfAndStockPrices(assets: MarketAsset[]): Promise<PriceQuote[]> {
  if (assets.length === 0) return [];

  const BATCH_SIZE = 20;
  const results: PriceQuote[] = [];

  for (let i = 0; i < assets.length; i += BATCH_SIZE) {
    const batch = assets.slice(i, i + BATCH_SIZE);
    const symbols = batch.map((a) => mapToYahooSymbol(a.symbol)).join(",");

    try {
      const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbols}&fields=regularMarketPrice,currency,regularMarketTime`;
      const data = await httpGetJson<YahooQuoteResponse>(url, {
        headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
      });

      for (const quote of data?.quoteResponse?.result ?? []) {
        const asset = batch.find(
          (a) => mapToYahooSymbol(a.symbol).toUpperCase() === quote.symbol?.toUpperCase()
        );
        if (!asset) continue;
        const price = quote.regularMarketPrice;
        if (!price || isNaN(price)) continue;

        results.push({
          assetId: asset.id,
          symbol: asset.symbol,
          price,
          currency: quote.currency ?? asset.currency,
          source: "yahoo",
          asOf: quote.regularMarketTime ? new Date(quote.regularMarketTime * 1000) : new Date(),
        });
      }
    } catch (err) {
      console.error(`[marketData] Error fetching ETF batch from Yahoo (${symbols}):`, err);
    }
  }

  return results;
}

const DEFAULT_TIMEOUT_MS = 8000;

async function httpGetJson<T>(url: string, options: RequestInit = {}): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const res = await fetch(url, { method: "GET", signal: controller.signal, next: { revalidate: 0 }, ...options });
    if (!res.ok) throw new Error(`HTTP ${res.status} al obtener ${url}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

const BINANCE_OVERRIDES: Record<string, string> = {};

function mapToBinanceSymbol(symbol: string): string | null {
  const upper = symbol.toUpperCase();
  if (BINANCE_OVERRIDES[upper]) return BINANCE_OVERRIDES[upper];
  return `${upper}USDT`;
}

function mapToYahooSymbol(symbol: string): string {
  return symbol.toUpperCase();
}

interface YahooQuoteResponse {
  quoteResponse: {
    result: {
      symbol: string;
      regularMarketPrice: number;
      regularMarketTime: number;
      currency: string;
    }[];
    error: unknown;
  };
}
