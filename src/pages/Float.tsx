import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FetchAllResult } from '../types';

function fmt(n: number | undefined | null): string {
  if (n === undefined || n === null || isNaN(n as number)) return '--';
  const v = Number(n);
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(2) + 'M';
  if (v >= 10_000) return (v / 1000).toFixed(1) + 'K';
  return v.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function Sparkline({ values, color = '#D78B5C' }: { values: number[]; color?: string }) {
  if (values.length < 2) {
    return <div className="h-8 flex items-center justify-center text-[9px] text-warm-600/60">无曲线数据</div>;
  }
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const w = 280;
  const h = 32;
  const step = w / (values.length - 1);
  const pts = values
    .map((v, i) => `${(i * step).toFixed(1)},${(h - ((v - min) / range) * (h - 4) - 2).toFixed(1)}`)
    .join(' ');
  const last = values[values.length - 1];
  const lastY = h - ((last - min) / range) * (h - 4) - 2;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="w-full h-8">
      <defs>
        <linearGradient id="spark-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.28} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <polyline
        points={`0,${h} ${pts} ${w},${h}`}
        fill="url(#spark-grad)"
        stroke="none"
      />
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
      <circle cx={w} cy={lastY} r={2.2} fill={color} />
    </svg>
  );
}

export default function Float() {
  const [data, setData] = useState<FetchAllResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [intervalSec, setIntervalSec] = useState(60);
  const [usageEndpoint, setUsageEndpoint] = useState('');
  const [hasCookie, setHasCookie] = useState(false);

  useEffect(() => {
    document.body.classList.add('float-body');
    return () => document.body.classList.remove('float-body');
  }, []);

  useEffect(() => {
    (async () => {
      const cfg = await window.dsApi.getConfig();
      setIntervalSec(cfg.refreshIntervalSec ?? 60);
      setUsageEndpoint(cfg.usageEndpoint ?? '');
      setHasCookie(cfg.hasCookie);
    })();
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await window.dsApi.fetchAll();
      setData(r);
      setLastUpdated(new Date());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!intervalSec) return;
    load();
    const t = window.setInterval(load, intervalSec * 1000);
    return () => window.clearInterval(t);
  }, [intervalSec, load]);

  const balance = data?.balance?.balance_infos?.[0];
  const usage = data?.usage;

  const isMonthly = !!usage?.periodLabel;
  const periodLabel = isMonthly ? '本月' : '今日';
  const hasUsageBinding = Boolean(usageEndpoint);

  const topModels = useMemo(() => {
    if (!usage) return [] as Array<{ name: string; value: number; pct: number }>;
    const entries = Object.entries(usage.byModel || {});
    const total = entries.reduce((sum, [, v]) => sum + v, 0) || 1;
    return entries
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name, value]) => ({ name, value, pct: Math.round((value / total) * 100) }));
  }, [usage]);

  const sparkValues = useMemo(() => {
    if (!usage?.series || usage.series.length < 2) return [] as number[];
    return usage.series.map((p) => p.totalTokens);
  }, [usage]);

  const balanceLow = balance && Number(balance.total_balance) < 1;

  return (
    <div className="w-screen h-screen p-2">
      <div className="float-card w-full h-full relative overflow-hidden flex flex-col">
        {/* drag handle — restricted to header area */}
        <div className="absolute top-0 left-0 right-0 h-10" style={{ WebkitAppRegion: 'drag' } as any} />

        <div className="relative p-3 flex flex-col h-full gap-2.5">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <img src="./logo.svg" alt="logo" className="w-4 h-4 rounded" />
              <span className="text-[11px] font-semibold text-warm-700">DeepSeek</span>
              {lastUpdated && (
                <span className="text-[9px] text-warm-600/70 tabular-nums">
                  {lastUpdated.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>
            <div
              className="flex items-center gap-0.5 no-drag"
              style={{ WebkitAppRegion: 'no-drag' } as any}
            >
              <button
                className="w-5 h-5 rounded text-warm-600 hover:bg-cream-200 text-[10px]"
                onClick={load}
                title="刷新"
                disabled={loading}
              >
                <span className={loading ? 'inline-block animate-spin' : ''}>↻</span>
              </button>
              <button
                className="w-5 h-5 rounded text-warm-600 hover:bg-cream-200 text-[10px]"
                onClick={() => window.dsApi.showMain()}
                title="打开主面板"
              >
                ⤢
              </button>
              <button
                className="w-5 h-5 rounded text-warm-600 hover:bg-cream-200 text-xs"
                onClick={() => window.dsApi.hideFloat()}
                title="关闭"
              >
                ×
              </button>
            </div>
          </div>

          <div className="flex items-center gap-1 flex-wrap text-[9px]">
            <span className={`badge !text-[9px] !px-1.5 !py-0 ${hasCookie ? 'badge-ok' : 'badge-warn'}`}>
              平台 {hasCookie ? '已登录' : '未登录'}
            </span>
            <span className={`badge !text-[9px] !px-1.5 !py-0 ${hasUsageBinding ? 'badge-ok' : 'badge-info'}`}>
              接口 {hasUsageBinding ? '已绑定' : '待绑定'}
            </span>
            <span className="badge badge-info !text-[9px] !px-1.5 !py-0">每 {intervalSec}s 刷新</span>
          </div>

          {/* Balance */}
          <div
            className="no-drag flex items-end justify-between pb-1.5 border-b border-cream-200"
            style={{ WebkitAppRegion: 'no-drag' } as any}
          >
            <div>
              <div className="text-[10px] text-warm-600 mb-0.5">API 余额</div>
              <div className={`text-2xl font-semibold tabular-nums leading-none ${balanceLow ? 'text-[#b85a3a]' : 'text-warm-800'}`}>
                {balance ? Number(balance.total_balance).toFixed(2) : '--'}
                <span className="text-xs text-warm-600 ml-1 font-normal">
                  {balance?.currency ?? ''}
                </span>
              </div>
            </div>
            {balance && (
              <div className="text-right">
                <div className="text-[9px] text-warm-600">充值 / 赠送</div>
                <div className="text-[10px] text-warm-700 tabular-nums">
                  {Number(balance.topped_up_balance).toFixed(1)} ·{' '}
                  {Number(balance.granted_balance).toFixed(1)}
                </div>
              </div>
            )}
          </div>

          {!usage && (
            <div className="rounded-md bg-[#eef5fb] px-2 py-1.5 text-[9px] leading-snug text-[#486276]">
              {hasUsageBinding
                ? '接口已绑定，但还没有拿到可视化数据。'
                : '先在主面板完成用量接口绑定，悬浮窗才能显示趋势。'}
            </div>
          )}

          {balanceLow && (
            <div className="rounded-md bg-[#fbf0e9] px-2 py-1.5 text-[9px] leading-snug text-[#9a5b3d]">
              余额偏低，建议尽快补充。
            </div>
          )}

          {/* Today/Month metrics */}
          <div
            className="no-drag grid grid-cols-2 gap-1.5"
            style={{ WebkitAppRegion: 'no-drag' } as any}
          >
            <div className="bg-cream-100/70 rounded-md px-2 py-1.5">
              <div className="text-[9px] text-warm-600 mb-0.5">{periodLabel}请求</div>
              <div className="text-sm text-warm-800 font-semibold tabular-nums leading-tight">
                {usage ? fmt(usage.today.requests) : '--'}
                <span className="text-[9px] text-warm-600 font-normal ml-1">次</span>
              </div>
            </div>
            <div className="bg-cream-100/70 rounded-md px-2 py-1.5">
              <div className="text-[9px] text-warm-600 mb-0.5">{periodLabel}消耗</div>
              <div className="text-sm text-warm-800 font-semibold tabular-nums leading-tight">
                {usage ? usage.today.cost.toFixed(2) : '--'}
                <span className="text-[9px] text-warm-600 font-normal ml-1">
                  {balance?.currency ?? ''}
                </span>
              </div>
            </div>
            <div className="bg-cream-100/70 rounded-md px-2 py-1.5 col-span-2">
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[9px] text-warm-600">{periodLabel} Token</span>
                <span className="text-[9px] text-warm-700 tabular-nums">
                  {usage ? fmt(usage.today.totalTokens) : '--'}
                </span>
              </div>
              <div className="flex items-center gap-1 text-[9px] text-warm-600">
                <span>↑</span>
                <span className="tabular-nums">
                  {usage ? fmt(usage.today.promptTokens) : '--'}
                </span>
                <span className="text-warm-600/50 mx-1">·</span>
                <span>↓</span>
                <span className="tabular-nums">
                  {usage ? fmt(usage.today.completionTokens) : '--'}
                </span>
              </div>
            </div>
          </div>

          {/* Top models */}
          {topModels.length > 0 && (
            <div
              className="no-drag space-y-1"
              style={{ WebkitAppRegion: 'no-drag' } as any}
            >
              <div className="text-[9px] text-warm-600">模型分布</div>
              {topModels.map((m) => (
                <div key={m.name} className="flex items-center gap-1.5 text-[10px]">
                  <span className="flex-1 truncate text-warm-700">{m.name}</span>
                  <div className="w-14 h-1.5 bg-cream-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-accent-peach to-accent-terracotta"
                      style={{ width: `${m.pct}%` }}
                    />
                  </div>
                  <span className="tabular-nums text-warm-600 w-8 text-right">{m.pct}%</span>
                </div>
              ))}
            </div>
          )}

          {/* Sparkline (only if we have daily series) */}
          {sparkValues.length >= 2 && (
            <div
              className="no-drag mt-auto"
              style={{ WebkitAppRegion: 'no-drag' } as any}
            >
              <div className="flex items-center justify-between text-[9px] text-warm-600 mb-0.5">
                <span>Token 曲线</span>
                <span>{usage?.series.length ?? 0} 日</span>
              </div>
              <Sparkline values={sparkValues} />
            </div>
          )}

          {/* Error state */}
          {data?.errors && data.errors.length > 0 && (
            <div className="mt-auto text-[9px] text-warm-600/80 bg-cream-100/60 rounded px-2 py-1.5">
              {data.errors.map((e, i) => (
                <div key={i}>{e.error}</div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
