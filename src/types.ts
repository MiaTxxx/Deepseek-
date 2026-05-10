export interface BalanceInfoCurrency {
  currency: string;
  total_balance: string;
  granted_balance: string;
  topped_up_balance: string;
}

export interface BalanceResponse {
  is_available: boolean;
  balance_infos: BalanceInfoCurrency[];
}

export interface UsagePoint {
  date: string;
  requests: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cost: number;
}

export interface UsageData {
  startStr: string;
  endStr: string;
  totals: Omit<UsagePoint, 'date'>;
  today: UsagePoint;
  series: UsagePoint[];
  byModel: Record<string, number>;
  periodLabel?: string;
}

export interface FetchAllResult {
  ok: boolean;
  balance: BalanceResponse | null;
  usage: UsageData | null;
  usageDebug?: { pickedUrl: string; capturedUrls: string[]; rowCount: number };
  errors: Array<{ kind: string; error: string; debug?: any }>;
}

declare global {
  interface Window {
    dsApi: {
      winMinimize: () => Promise<void>;
      winClose: () => Promise<void>;
      winHide: () => Promise<void>;
      showMain: () => Promise<void>;
      showFloat: () => Promise<void>;
      hideFloat: () => Promise<void>;
      toggleFloat: () => Promise<void>;
      loginDeepSeek: () => Promise<{ ok: boolean; cookie?: string; error?: string }>;
      getConfig: () => Promise<{ apiKey: string; hasCookie: boolean; refreshIntervalSec: number; usageEndpoint: string }>;
      setConfig: (cfg: Partial<{ apiKey: string; refreshIntervalSec: number; usageEndpoint: string }>) => Promise<{ ok: boolean }>;
      clearCookie: () => Promise<{ ok: boolean }>;
      fetchBalance: () => Promise<{ ok: boolean; data?: BalanceResponse; error?: string }>;
      fetchUsage: (range?: { start?: string; end?: string }) => Promise<{
        ok: boolean;
        data?: UsageData;
        raw?: any;
        error?: string;
        attempts?: any[];
      }>;
      fetchAll: () => Promise<FetchAllResult>;
      diagnose: () => Promise<{
        ok: boolean;
        error?: string;
        finalUrl?: string;
        total?: number;
        items?: Array<{
          index: number;
          url: string;
          method: string;
          bytes: number;
          usageRowMatches: number;
          preview: string;
        }>;
        autoBest?: { url: string; rows: number } | null;
      }>;
      useCaptured: (index: number) => Promise<{
        ok: boolean;
        error?: string;
        url?: string;
        data?: UsageData;
      }>;
      openExternal: (url: string) => Promise<void>;
    };
  }
}
