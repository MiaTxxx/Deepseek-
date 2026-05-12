import type { BalanceResponse, FetchAllResult, UsageData, UsagePoint } from './types';

const isDev = Boolean((import.meta as any).env?.DEV);

if (isDev && !window.dsApi) {
  let floatVisible = false;
  const config = {
    apiKey: 'sk-dev-preview',
    hasCookie: true,
    refreshIntervalSec: 60,
    usageEndpoint: 'dev://deepseek-usage',
  };

  const mkDate = (offset: number) => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return d.toISOString().slice(0, 10);
  };

  const series: UsagePoint[] = Array.from({ length: 7 }, (_, i) => {
    const day = i - 6;
    const requests = 80 + i * 18;
    const promptTokens = 42_000 + i * 8_400;
    const completionTokens = 25_000 + i * 6_300;
    return {
      date: mkDate(day),
      requests,
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
      cost: Number((1.2 + i * 0.34).toFixed(2)),
    };
  });

  const totals = series.reduce(
    (acc, p) => {
      acc.requests += p.requests;
      acc.promptTokens += p.promptTokens;
      acc.completionTokens += p.completionTokens;
      acc.totalTokens += p.totalTokens;
      acc.cost += p.cost;
      return acc;
    },
    { requests: 0, promptTokens: 0, completionTokens: 0, totalTokens: 0, cost: 0 },
  );

  const balance: BalanceResponse = {
    is_available: true,
    balance_infos: [
      {
        currency: 'CNY',
        total_balance: '42.80',
        granted_balance: '12.80',
        topped_up_balance: '30.00',
      },
    ],
  };

  const usage: UsageData = {
    startStr: series[0].date,
    endStr: series[series.length - 1].date,
    totals,
    today: series[series.length - 1],
    series,
    byModel: {
      'deepseek-chat': 382_000,
      'deepseek-reasoner': 188_000,
      'deepseek-coder': 74_000,
    },
  };

  const fetchAll = async (): Promise<FetchAllResult> => {
    const errors: FetchAllResult['errors'] = [];
    if (!config.apiKey) errors.push({ kind: 'balance', error: '未配置 API Key' });
    if (!config.hasCookie) errors.push({ kind: 'usage', error: '未登录 DeepSeek 平台' });
    if (config.hasCookie && !config.usageEndpoint) {
      errors.push({ kind: 'usage', error: '尚未绑定用量接口。前往「设置 → 用量接口诊断」。' });
    }

    return {
      ok: true,
      balance: config.apiKey ? balance : null,
      usage: config.hasCookie && config.usageEndpoint ? usage : null,
      errors,
    };
  };

  window.dsApi = {
    winMinimize: async () => undefined,
    winClose: async () => undefined,
    winHide: async () => undefined,
    showMain: async () => undefined,
    showFloat: async () => undefined,
    hideFloat: async () => undefined,
    toggleFloat: async () => {
      floatVisible = !floatVisible;
      return floatVisible;
    },
    loginDeepSeek: async () => {
      config.hasCookie = true;
      return { ok: true, cookie: 'dev-cookie' };
    },
    getConfig: async () => ({ ...config }),
    setConfig: async (patch) => {
      if (typeof patch.apiKey === 'string') config.apiKey = patch.apiKey.trim();
      if (typeof patch.refreshIntervalSec === 'number') {
        config.refreshIntervalSec = Math.min(3600, Math.max(15, patch.refreshIntervalSec));
      }
      if (typeof patch.usageEndpoint === 'string') config.usageEndpoint = patch.usageEndpoint.trim();
      return { ok: true };
    },
    clearCookie: async () => {
      config.hasCookie = false;
      return { ok: true };
    },
    fetchBalance: async () => (config.apiKey ? { ok: true, data: balance } : { ok: false, error: '未配置 API Key' }),
    fetchUsage: async () =>
      config.hasCookie && config.usageEndpoint
        ? { ok: true, data: usage }
        : { ok: false, error: '未登录或未绑定接口' },
    fetchAll,
    diagnose: async () => {
      config.usageEndpoint = 'dev://deepseek-usage';
      return {
        ok: true,
        finalUrl: 'https://platform.deepseek.com/usage',
        total: 1,
        items: [
          {
            index: 0,
            url: config.usageEndpoint,
            method: 'GET',
            bytes: 12048,
            usageRowMatches: 7,
            preview: JSON.stringify({ rows: series.slice(0, 2) }, null, 2),
          },
        ],
        autoBest: { url: config.usageEndpoint, rows: 7 },
      };
    },
    useCaptured: async () => {
      config.usageEndpoint = 'dev://deepseek-usage';
      return { ok: true, url: config.usageEndpoint, data: usage };
    },
    openExternal: async (url) => {
      window.open(url, '_blank', 'noopener,noreferrer');
    },
  };
}
