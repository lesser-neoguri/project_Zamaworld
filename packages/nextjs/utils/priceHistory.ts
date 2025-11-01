import { openDB, DBSchema, IDBPDatabase } from "idb";

export type PriceChangeEvent = {
  pixelId: number;
  timestamp: number;
  priceWei: bigint;
  eventType: "listed" | "sale" | "removed";
  fromAddress?: string;
  toAddress?: string;
  blockNumber?: number;
  txHash?: string;
};

interface PriceHistoryDB extends DBSchema {
  priceHistory: {
    key: string; // `${pixelId}-${timestamp}-${blockNumber}`
    value: PriceChangeEvent;
    indexes: {
      pixelId: number;
      timestamp: number;
      eventType: string;
    };
  };
}

let __dbPromise: Promise<IDBPDatabase<PriceHistoryDB>> | undefined = undefined;

async function _getDB(): Promise<IDBPDatabase<PriceHistoryDB> | undefined> {
  if (__dbPromise) {
    return __dbPromise;
  }
  if (typeof window === "undefined") {
    return undefined;
  }
  __dbPromise = openDB<PriceHistoryDB>("price-history", 1, {
    upgrade(db) {
      const store = db.createObjectStore("priceHistory", { keyPath: "key" });
      store.createIndex("pixelId", "pixelId");
      store.createIndex("timestamp", "timestamp");
      store.createIndex("eventType", "eventType");
    },
  });
  return __dbPromise;
}

export async function savePriceChange(event: PriceChangeEvent): Promise<void> {
  const db = await _getDB();
  if (!db) return;

  const key = `${event.pixelId}-${event.timestamp}-${event.blockNumber ?? 0}`;
  await db.put("priceHistory", { ...event, key });
}

export async function getPriceHistory(pixelId: number): Promise<PriceChangeEvent[]> {
  const db = await _getDB();
  if (!db) return [];

  const allEvents = await db.getAllFromIndex("priceHistory", "pixelId", pixelId);
  return allEvents.sort((a, b) => a.timestamp - b.timestamp);
}

export async function getAllPriceHistory(): Promise<PriceChangeEvent[]> {
  const db = await _getDB();
  if (!db) return [];

  return await db.getAll("priceHistory");
}

export async function getPriceHistoryByType(
  pixelId: number,
  eventType: "listed" | "sale" | "removed"
): Promise<PriceChangeEvent[]> {
  const db = await _getDB();
  if (!db) return [];

  const events = await db.getAllFromIndex("priceHistory", "pixelId", pixelId);
  return events.filter((e) => e.eventType === eventType).sort((a, b) => a.timestamp - b.timestamp);
}

export async function getLatestPrice(pixelId: number): Promise<PriceChangeEvent | undefined> {
  const history = await getPriceHistory(pixelId);
  return history[history.length - 1];
}

export async function getPriceStats(pixelId: number): Promise<{
  minPrice: bigint;
  maxPrice: bigint;
  avgPrice: bigint;
  totalSales: number;
}> {
  const sales = await getPriceHistoryByType(pixelId, "sale");
  if (sales.length === 0) {
    return {
      minPrice: 0n,
      maxPrice: 0n,
      avgPrice: 0n,
      totalSales: 0,
    };
  }

  const prices = sales.map((s) => s.priceWei);
  const minPrice = prices.reduce((min, p) => (p < min ? p : min), prices[0]);
  const maxPrice = prices.reduce((max, p) => (p > max ? p : max), prices[0]);
  const sum = prices.reduce((acc, p) => acc + p, 0n);
  const avgPrice = sum / BigInt(prices.length);

  return {
    minPrice,
    maxPrice,
    avgPrice,
    totalSales: sales.length,
  };
}

