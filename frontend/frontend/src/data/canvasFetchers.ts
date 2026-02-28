import { getRecentBills, getCurrentCongress, formatBillId, CongressBill } from '../services/congressAPI';

export type CanvasItem = {
  id: string;
  date: string;
  title: string;
  subtitle?: string;
  raw?: any;
};

type Fetcher = (opts?: { limit?: number; offset?: number }) => Promise<CanvasItem[]>;

function sortAscendingByDate<T extends { updateDate?: string; date?: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const da = (a as any).updateDate || (a as any).date || '';
    const db = (b as any).updateDate || (b as any).date || '';
    return da.localeCompare(db);
  });
}

function mapBills(bills: CongressBill[]): CanvasItem[] {
  return sortAscendingByDate(bills).map(b => ({
    id: `${b.type}-${b.number}-${b.congress}`,
    date: b.updateDate,
    title: formatBillId(b),
    subtitle: b.title
  }));
}

export function getHoleFetcher(holeId: string): Fetcher | null {
  const congress = getCurrentCongress();

  // Supported federal holes for first pass
  if (
    holeId === 'federal.legislation.bill_text' ||
    holeId === 'federal.legislation.bill_status'
  ) {
    return async ({ limit = 5, offset = 0 } = {}) => {
      const bills = await getRecentBills(congress, limit, offset);
      return mapBills(bills);
    };
  }

  return null;
}

export type FetcherForHole = ReturnType<typeof getHoleFetcher>;


