import { ipcMain, net } from 'electron';
import { store } from './store';
import { scrapePlatformUsage, fetchJsonWithCookie, CapturedResponse } from './scrape';

type JsonObj = Record<string, any>;

let lastCaptured: CapturedResponse[] = [];

function httpRequest(opts: {
  url: string;
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: any;
}): Promise<{ status: number; json: any; text: string }> {
  return new Promise((resolve, reject) => {
    const req = net.request({
      method: opts.method ?? 'GET',
      url: opts.url,
      redirect: 'follow',
    });

    if (opts.headers) {
      for (const [k, v] of Object.entries(opts.headers)) {
        req.setHeader(k, v);
      }
    }

    let data = '';
    req.on('response', (res) => {
      res.on('data', (chunk) => (data += chunk.toString('utf-8')));
      res.on('end', () => {
        let json: any = null;
        try {
          json = JSON.parse(data);
        } catch {
          /* not json */
        }
        resolve({ status: res.statusCode, json, text: data });
      });
      res.on('error', (err) => reject(err));
    });
    req.on('error', (err) => reject(err));

    if (opts.body !== undefined) {
      req.write(typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body));
    }
    req.end();
  });
}

// --- Public API (requires API key) ---
async function fetchBalance(apiKey: string) {
  const res = await httpRequest({
    url: 'https://api.deepseek.com/user/balance',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json',
    },
  });
  if (res.status !== 200 || !res.json) {
    throw new Error(`余额查询失败: HTTP ${res.status} ${res.text?.slice(0, 200)}`);
  }
  return res.json;
}

// ===========================================================================
// DeepSeek-native usage parser
//
// Shape observed from platform.deepseek.com/api/v0/usage/{amount,cost}:
// {
//   code: 0,
//   data: {
//     biz_code: 0,
//     biz_data: [
//       {
//         total: [
//           { model: "deepseek-v4-pro", usage: [{ type, amount }, ...] },
//           ...
//         ],
//         // potentially daily entries like { date: "2026-05-01", ... }
//       }
//     ]
//   }
// }
// type values seen: PROMPT_TOKEN, PROMPT_CACHE_HIT_TOKEN,
//                   PROMPT_CACHE_MISS_TOKEN, RESPONSE_TOKEN, REQUEST
// ===========================================================================

interface DsEntry {
  date?: string; // "TOTAL" = monthly aggregate, "YYYY-MM-DD" = daily, undefined = ambiguous
  model: string;
  usage: Array<{ type: string; amount: number }>;
}

function extractDsEntries(node: any): DsEntry[] {
  const out: DsEntry[] = [];
  const walk = (n: any, inheritedDate: string | undefined) => {
    if (Array.isArray(n)) {
      for (const x of n) walk(x, inheritedDate);
      return;
    }
    if (!n || typeof n !== 'object') return;

    // Leaf: model + usage array of {type, amount}
    if (typeof n.model === 'string' && Array.isArray(n.usage)) {
      const usage = n.usage
        .filter((u: any) => u && typeof u.type === 'string')
        .map((u: any) => {
          const raw = u.amount;
          const num = typeof raw === 'number' ? raw : parseFloat(String(raw ?? '0'));
          return { type: String(u.type), amount: isNaN(num) ? 0 : num };
        });
      out.push({ date: inheritedDate, model: n.model, usage });
      return;
    }

    // Detect a date-ish field at this level
    const dateCandidate =
      (typeof n.date === 'string' && n.date) ||
      (typeof n.day === 'string' && n.day) ||
      (typeof n.ds === 'string' && n.ds) ||
      (typeof n.report_date === 'string' && n.report_date) ||
      undefined;
    const passedDate = dateCandidate ? String(dateCandidate).slice(0, 10) : inheritedDate;

    for (const [k, v] of Object.entries(n)) {
      if (k === 'total') walk(v, 'TOTAL');
      else walk(v, passedDate);
    }
  };
  walk(node, undefined);
  return out;
}

const PROMPT_TYPES = new Set([
  'PROMPT_TOKEN',
  'PROMPT_CACHE_HIT_TOKEN',
  'PROMPT_CACHE_MISS_TOKEN',
]);
const COMPLETION_TYPES = new Set(['RESPONSE_TOKEN']);

interface NormalizedPoint {
  date: string;
  requests: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cost: number;
}

interface NormalizedUsage {
  startStr: string;
  endStr: string;
  totals: Omit<NormalizedPoint, 'date'>;
  today: NormalizedPoint;
  series: NormalizedPoint[];
  byModel: Record<string, number>;
  periodLabel?: string; // e.g. "2026-05 月累计" when no daily breakdown
  currency?: string;
}

function findCurrency(node: any, depth = 0): string | undefined {
  if (depth > 8 || node === null || node === undefined) return undefined;
  if (typeof node === 'string') {
    const value = node.trim().toUpperCase();
    return /^(USD|CNY|RMB|EUR|JPY|GBP|HKD|SGD)$/.test(value) ? value : undefined;
  }
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findCurrency(item, depth + 1);
      if (found) return found;
    }
    return undefined;
  }
  if (typeof node !== 'object') return undefined;

  for (const key of ['currency', 'settlement_currency', 'settlementCurrency', 'unit']) {
    const found = findCurrency(node[key], depth + 1);
    if (found) return found === 'RMB' ? 'CNY' : found;
  }

  for (const value of Object.values(node)) {
    const found = findCurrency(value, depth + 1);
    if (found) return found === 'RMB' ? 'CNY' : found;
  }
  return undefined;
}

function normalizeDsNative(amountJson: any, costJson: any | null): NormalizedUsage | null {
  const amountEntries = extractDsEntries(amountJson);
  if (amountEntries.length === 0) return null;
  const costEntries = costJson ? extractDsEntries(costJson) : [];

  const totalsByKey = {
    requests: 0,
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    cost: 0,
  };
  const byModel: Record<string, number> = {};

  // Prefer TOTAL-scoped entries for aggregates; otherwise treat everything
  // that isn't a specific date as "aggregate" so we still produce numbers.
  const totalSrc = amountEntries.filter((e) => e.date === 'TOTAL');
  const aggSrc =
    totalSrc.length > 0
      ? totalSrc
      : amountEntries.filter((e) => !e.date || e.date === 'TOTAL' || !/^\d{4}-\d{2}-\d{2}$/.test(e.date));
  // If no aggregate either, fall back to summing all daily entries
  const finalAggSrc = aggSrc.length > 0 ? aggSrc : amountEntries;

  for (const e of finalAggSrc) {
    let modelTokens = 0;
    for (const u of e.usage) {
      if (u.type === 'REQUEST') totalsByKey.requests += u.amount;
      else if (PROMPT_TYPES.has(u.type)) {
        totalsByKey.promptTokens += u.amount;
        modelTokens += u.amount;
      } else if (COMPLETION_TYPES.has(u.type)) {
        totalsByKey.completionTokens += u.amount;
        modelTokens += u.amount;
      }
    }
    byModel[e.model] = (byModel[e.model] ?? 0) + modelTokens;
  }
  totalsByKey.totalTokens = totalsByKey.promptTokens + totalsByKey.completionTokens;

  const costTotalSrc = costEntries.filter((e) => e.date === 'TOTAL');
  const costAggSrc =
    costTotalSrc.length > 0
      ? costTotalSrc
      : costEntries.filter((e) => !e.date || e.date === 'TOTAL' || !/^\d{4}-\d{2}-\d{2}$/.test(e.date));
  const finalCostSrc = costAggSrc.length > 0 ? costAggSrc : costEntries;
  for (const e of finalCostSrc) {
    for (const u of e.usage) totalsByKey.cost += u.amount;
  }

  // Daily series (if present)
  const byDate = new Map<string, NormalizedPoint>();
  const ensure = (d: string) => {
    let p = byDate.get(d);
    if (!p) {
      p = { date: d, requests: 0, promptTokens: 0, completionTokens: 0, totalTokens: 0, cost: 0 };
      byDate.set(d, p);
    }
    return p;
  };
  for (const e of amountEntries) {
    if (!e.date || !/^\d{4}-\d{2}-\d{2}$/.test(e.date)) continue;
    const p = ensure(e.date);
    for (const u of e.usage) {
      if (u.type === 'REQUEST') p.requests += u.amount;
      else if (PROMPT_TYPES.has(u.type)) p.promptTokens += u.amount;
      else if (COMPLETION_TYPES.has(u.type)) p.completionTokens += u.amount;
    }
    p.totalTokens = p.promptTokens + p.completionTokens;
  }
  for (const e of costEntries) {
    if (!e.date || !/^\d{4}-\d{2}-\d{2}$/.test(e.date)) continue;
    const p = ensure(e.date);
    for (const u of e.usage) p.cost += u.amount;
  }

  const series = Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
  const today = new Date().toISOString().slice(0, 10);
  const hasDaily = series.length > 0;

  const todayPoint: NormalizedPoint = hasDaily
    ? series.find((p) => p.date === today) ?? {
        date: today,
        requests: 0,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        cost: 0,
      }
    : {
        date: today,
        requests: totalsByKey.requests,
        promptTokens: totalsByKey.promptTokens,
        completionTokens: totalsByKey.completionTokens,
        totalTokens: totalsByKey.totalTokens,
        cost: totalsByKey.cost,
      };

  const now = new Date();
  const periodLabel = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')} 月累计`;

  // If we got literally no meaningful data, report null so caller can surface.
  const meaningful =
    totalsByKey.totalTokens > 0 ||
    totalsByKey.requests > 0 ||
    totalsByKey.cost > 0 ||
    series.length > 0;
  if (!meaningful) return null;

  return {
    startStr: hasDaily ? series[0].date : periodLabel,
    endStr: hasDaily ? series[series.length - 1].date : periodLabel,
    totals: totalsByKey,
    today: todayPoint,
    series,
    byModel,
    periodLabel: hasDaily ? undefined : periodLabel,
    currency: findCurrency(costJson) ?? findCurrency(amountJson),
  };
}

// ---------------------------------------------------------------------------
// URL manipulation for DS /usage/{amount,cost}
// ---------------------------------------------------------------------------

function isDsUsageUrl(url: string) {
  return /\/api\/v0\/usage\/(amount|cost)(\?|$)/.test(url);
}

function rebuildDsUsageUrl(
  origUrl: string,
  opts: { variant?: 'amount' | 'cost'; monthOffset?: number } = {},
): string {
  const u = new URL(origUrl);
  const offset = opts.monthOffset ?? 0;
  const now = new Date();
  now.setMonth(now.getMonth() + offset);
  u.searchParams.set('month', String(now.getMonth() + 1));
  u.searchParams.set('year', String(now.getFullYear()));
  if (opts.variant) {
    u.pathname = u.pathname.replace(/\/(amount|cost)$/, `/${opts.variant}`);
  }
  return u.toString();
}

async function fetchDsUsageViaStoredEndpoint(
  storedUrl: string,
  cookie: string,
): Promise<{ ok: true; data: NormalizedUsage } | { ok: false; error: string; debug?: any }> {
  const amountUrl = rebuildDsUsageUrl(storedUrl, { variant: 'amount' });
  const costUrl = rebuildDsUsageUrl(storedUrl, { variant: 'cost' });
  const savedHeaders = (store.get('usageHeaders') as Record<string, string> | undefined) ?? undefined;
  try {
    const [amt, cost] = await Promise.all([
      fetchJsonWithCookie(amountUrl, cookie, savedHeaders),
      fetchJsonWithCookie(costUrl, cookie, savedHeaders),
    ]);
    if (amt.status !== 200 || !amt.json) {
      return {
        ok: false,
        error: `amount 接口 HTTP ${amt.status}`,
        debug: { url: amountUrl, snippet: amt.text?.slice(0, 300) },
      };
    }
    const data = normalizeDsNative(amt.json, cost.status === 200 ? cost.json : null);
    if (!data) {
      return {
        ok: false,
        error: '解析用量响应失败（结构可能已变）',
        debug: { url: amountUrl, snippet: JSON.stringify(amt.json).slice(0, 400) },
      };
    }
    return { ok: true, data };
  } catch (err: any) {
    return { ok: false, error: err?.message ?? String(err) };
  }
}

// ---------------------------------------------------------------------------
// Diagnose helpers
// ---------------------------------------------------------------------------

function scoreUsageResponse(json: any): number {
  // Higher score = more likely the DeepSeek native usage endpoint.
  const ds = extractDsEntries(json);
  if (ds.length > 0) return 1000 + ds.length;
  return 0;
}

function summarizeCaptured(captured: CapturedResponse[]) {
  return captured.map((c, i) => ({
    index: i,
    url: c.url,
    method: c.method,
    bytes: c.bytes,
    usageRowMatches: scoreUsageResponse(c.json),
    preview: c.text?.slice(0, 400) ?? '',
  }));
}

function autoBestFromCaptured(captured: CapturedResponse[]) {
  const scored = captured
    .filter((c) => isDsUsageUrl(c.url))
    .map((c) => ({ c, score: scoreUsageResponse(c.json) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
  if (scored.length === 0) return null;
  const best = scored[0].c;

  const sibling =
    best.url.includes('/amount')
      ? captured.find((c) => c.url === rebuildDsUsageUrl(best.url, { variant: 'cost' }))
      : captured.find((c) => c.url === rebuildDsUsageUrl(best.url, { variant: 'amount' }));
  const amtJson = best.url.includes('/amount') ? best.json : sibling?.json;
  const costJson = best.url.includes('/cost') ? best.json : sibling?.json;
  if (amtJson) {
    const normalized = normalizeDsNative(amtJson, costJson ?? null);
    if (normalized) {
      const amountUrl = best.url.includes('/amount')
        ? best.url
        : rebuildDsUsageUrl(best.url, { variant: 'amount' });
      return { url: amountUrl, data: normalized, rows: scored[0].score };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// IPC handlers
// ---------------------------------------------------------------------------

export function registerApiHandlers() {
  ipcMain.handle('config:get', () => {
    return {
      apiKey: store.get('apiKey') ?? '',
      hasCookie: !!store.get('deepseekCookie'),
      refreshIntervalSec: store.get('refreshIntervalSec') ?? 60,
      usageEndpoint: (store.get('usageEndpoint') as string) ?? '',
    };
  });

  ipcMain.handle('config:set', (_e, patch: JsonObj) => {
    if (typeof patch.apiKey === 'string') store.set('apiKey', patch.apiKey.trim());
    if (typeof patch.refreshIntervalSec === 'number')
      store.set('refreshIntervalSec', patch.refreshIntervalSec);
    if (typeof patch.usageEndpoint === 'string') {
      const v = patch.usageEndpoint.trim();
      store.set('usageEndpoint', v);
      if (v === '') store.delete('usageHeaders' as any);
    }
    return { ok: true };
  });

  ipcMain.handle('config:clearCookie', () => {
    store.delete('deepseekCookie');
    return { ok: true };
  });

  ipcMain.handle('api:balance', async () => {
    const apiKey = store.get('apiKey');
    if (!apiKey) return { ok: false, error: '未配置 API Key' };
    try {
      const data = await fetchBalance(apiKey);
      return { ok: true, data };
    } catch (err: any) {
      return { ok: false, error: err?.message ?? String(err) };
    }
  });

  ipcMain.handle('api:diagnose', async () => {
    const cookie = store.get('deepseekCookie');
    if (!cookie) return { ok: false, error: '未登录 DeepSeek 平台' };
    const { captured, finalUrl, error } = await scrapePlatformUsage({
      visible: true,
      targetPath: '/usage',
    });
    const summary = summarizeCaptured(captured);
    const autoBest = autoBestFromCaptured(captured);
    lastCaptured = captured;

    // Auto-bind the best candidate so the user doesn't need an extra click.
    let autoBound = false;
    if (autoBest) {
      store.set('usageEndpoint', autoBest.url);
      // Find the captured item whose URL matches so we can save its headers
      const matched = captured.find((c) => c.url === autoBest.url);
      if (matched?.requestHeaders) {
        store.set('usageHeaders', matched.requestHeaders);
      }
      autoBound = true;
    }

    return {
      ok: true,
      finalUrl,
      error,
      items: summary,
      autoBest: autoBest ? { url: autoBest.url, rows: autoBest.rows } : null,
      autoBound,
      total: captured.length,
    };
  });

  ipcMain.handle('api:useCaptured', async (_e, index: number) => {
    const captured: CapturedResponse[] = lastCaptured;
    const item = captured[index];
    if (!item) return { ok: false, error: '条目不存在' };

    // DS-native: find sibling (cost/amount) in same capture
    if (isDsUsageUrl(item.url)) {
      const sibling =
        item.url.includes('/amount')
          ? captured.find((c) => c.url === rebuildDsUsageUrl(item.url, { variant: 'cost' }))
          : captured.find((c) => c.url === rebuildDsUsageUrl(item.url, { variant: 'amount' }));
      const amtJson = item.url.includes('/amount') ? item.json : sibling?.json;
      const costJson = item.url.includes('/cost') ? item.json : sibling?.json;
      if (amtJson) {
        const data = normalizeDsNative(amtJson, costJson ?? null);
        if (data) {
          const savedUrl = item.url.includes('/amount')
            ? item.url
            : rebuildDsUsageUrl(item.url, { variant: 'amount' });
          store.set('usageEndpoint', savedUrl);
          // Save request headers from the captured amount item for replay
          const amtItem = item.url.includes('/amount') ? item : sibling;
          if (amtItem?.requestHeaders) {
            store.set('usageHeaders', amtItem.requestHeaders);
          }
          return { ok: true, url: savedUrl, data };
        }
      }
    }

    return {
      ok: false,
      error: '该响应不是 DeepSeek 用量接口（/api/v0/usage/amount 或 /cost），为避免展示误判数据，未绑定。',
      url: item.url,
    };
  });

  ipcMain.handle('api:usage', async () => {
    const cookie = store.get('deepseekCookie');
    if (!cookie) return { ok: false, error: '未登录 DeepSeek 平台' };

    const endpoint = store.get('usageEndpoint') as string | undefined;
    if (endpoint && isDsUsageUrl(endpoint)) {
      const r = await fetchDsUsageViaStoredEndpoint(endpoint, cookie);
      if (r.ok) return { ok: true, data: r.data, via: 'ds-endpoint' };
      return { ok: false, error: `已绑定接口调用失败：${r.error}` };
    }
    if (endpoint) {
      return {
        ok: false,
        error: '已绑定接口不是 DeepSeek 原生用量接口，请重新运行「用量接口诊断」。',
      };
    }

    return {
      ok: false,
      error: '尚未绑定用量接口。请前往「设置 → 用量接口诊断」。',
    };
  });

  ipcMain.handle('api:fetchAll', async () => {
    const apiKey = store.get('apiKey');
    const cookie = store.get('deepseekCookie');

    const result: JsonObj = { ok: true, balance: null, usage: null, errors: [] };

    if (apiKey) {
      try {
        result.balance = await fetchBalance(apiKey);
      } catch (err: any) {
        result.errors.push({ kind: 'balance', error: err?.message ?? String(err) });
      }
    } else {
      result.errors.push({ kind: 'balance', error: '未配置 API Key' });
    }

    if (cookie) {
      const endpoint = store.get('usageEndpoint') as string | undefined;
      if (endpoint && isDsUsageUrl(endpoint)) {
        const r = await fetchDsUsageViaStoredEndpoint(endpoint, cookie);
        if (r.ok) result.usage = r.data;
        else result.errors.push({ kind: 'usage', error: r.error });
      } else if (endpoint) {
        result.errors.push({
          kind: 'usage',
          error: '已绑定接口不是 DeepSeek 原生用量接口，请重新运行「用量接口诊断」。',
        });
      } else {
        result.errors.push({
          kind: 'usage',
          error: '尚未绑定用量接口。前往「设置 → 用量接口诊断」。',
        });
      }
    } else {
      result.errors.push({ kind: 'usage', error: '未登录 DeepSeek 平台' });
    }

    return result;
  });
}
