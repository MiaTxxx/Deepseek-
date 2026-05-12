import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import StatCard from '../components/StatCard';
import type { FetchAllResult } from '../types';

const MODEL_COLORS = ['#D78B5C', '#F4B183', '#A8B89D', '#C4A78F', '#8B7355', '#D9C5A0'];
const MIN_REFRESH_SEC = 15;

type DashboardConfig = {
  refreshIntervalSec: number;
  usageEndpoint: string;
  hasCookie: boolean;
  apiKey: string;
};

type BannerState = {
  title: string;
  text: string;
  action: string;
  toSettings: boolean;
};

function EmptyState({ text }: { text: string }) {
  return <div className="h-full flex items-center justify-center text-xs text-warm-600/70 text-center px-4">{text}</div>;
}

function formatCountdown(seconds: number | null): string {
  if (seconds === null) return '--';
  if (seconds <= 0) return '马上';
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${String(secs).padStart(2, '0')}s`;
}

function formatToken(n: number | undefined): string {
  if (n === undefined) return '--';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

export default function Dashboard() {
  const [data, setData] = useState<FetchAllResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [clock, setClock] = useState(() => Date.now());
  const [config, setConfig] = useState<DashboardConfig>({
    refreshIntervalSec: 60,
    usageEndpoint: '',
    hasCookie: false,
    apiKey: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await window.dsApi.fetchAll();
      setData(res);
      setLastUpdated(new Date());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      const cfg = await window.dsApi.getConfig();
      if (!alive) return;
      setConfig({
        refreshIntervalSec: cfg.refreshIntervalSec ?? 60,
        usageEndpoint: cfg.usageEndpoint ?? '',
        hasCookie: cfg.hasCookie,
        apiKey: cfg.apiKey ?? '',
      });
    })();
    load();

    return () => {
      alive = false;
    };
  }, [load]);

  useEffect(() => {
    const t = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  const refreshIntervalSec = Math.max(MIN_REFRESH_SEC, config.refreshIntervalSec || 60);

  useEffect(() => {
    const t = window.setInterval(load, refreshIntervalSec * 1000);
    return () => window.clearInterval(t);
  }, [refreshIntervalSec, load]);

  const balance = data?.balance?.balance_infos?.[0];
  const usage = data?.usage;
  const displayCurrency = usage?.currency ?? balance?.currency ?? '';
  const dailySeries = usage?.series ?? [];
  const hasDailySeries = dailySeries.length > 0;
  const hasUsageBinding = Boolean(config.usageEndpoint);
  const balanceLow = balance ? Number(balance.total_balance) < 1 : false;

  const balanceError = data?.errors?.find((e) => e.kind === 'balance');
  const usageError = data?.errors?.find((e) => e.kind === 'usage');

  const modelPie = useMemo(
    () =>
      Object.entries(usage?.byModel ?? {}).map(([name, value]) => ({
        name,
        value,
      })),
    [usage],
  );

  const banner = useMemo<BannerState | null>(() => {
    if (!config.apiKey) {
      return {
        title: '还没有 API Key',
        text: '先去设置里保存 API Key，余额卡片才会有真实数据。',
        action: '前往设置',
        toSettings: true,
      };
    }

    if (!config.hasCookie) {
      return {
        title: '还没有平台登录',
        text: '完成 DeepSeek 平台登录后，才能查看使用量、模型分布和趋势。',
        action: '前往设置',
        toSettings: true,
      };
    }

    if (!hasUsageBinding) {
      return {
        title: '还没绑定用量接口',
        text: '运行一次「设置 → 用量接口诊断」，把抓到的接口绑定进来。',
        action: '去绑定',
        toSettings: true,
      };
    }

    if (balanceLow) {
      return {
        title: '余额偏低',
        text: '当前总余额低于 1，建议尽快补充。',
        action: '立即刷新',
        toSettings: false,
      };
    }

    return null;
  }, [balanceLow, config.apiKey, config.hasCookie, hasUsageBinding]);

  const nextRefreshIn = lastUpdated
    ? Math.max(0, Math.ceil((lastUpdated.getTime() + refreshIntervalSec * 1000 - clock) / 1000))
    : null;

  const trendEmptyText = usage
    ? usage.periodLabel
      ? `平台返回的是月度累计数据，暂无日粒度曲线。本月累计 ${formatToken(usage.totals.totalTokens)} tokens · ${usage.totals.requests.toLocaleString()} 次请求。`
      : '当前接口没有返回日粒度明细。'
    : hasUsageBinding
      ? '接口已绑定，但暂时还没有抓到可视化曲线。'
      : '绑定用量接口后，这里会显示 Token 曲线。';

  const requestEmptyText = usage
    ? usage.periodLabel
      ? '月度累计接口没有日粒度请求曲线。'
      : '当前接口没有返回请求趋势数据。'
    : hasUsageBinding
      ? '接口已绑定，但暂时没有请求趋势数据。'
      : '绑定用量接口后，这里会显示请求趋势。';

  const costEmptyText = usage
    ? usage.periodLabel
      ? '月度累计接口没有日粒度金额曲线。'
      : '当前接口没有返回金额趋势数据。'
    : hasUsageBinding
      ? '接口已绑定，但暂时没有金额趋势数据。'
      : '绑定用量接口后，这里会显示金额趋势。';

  const usageDebugError = data?.errors?.find((e) => e.kind === 'usage')?.debug as
    | { capturedUrls?: string[] }
    | undefined;

  return (
    <div className="p-6 space-y-6 max-w-[1200px] mx-auto">
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-semibold text-warm-800">总览</h1>
            <p className="text-xs text-warm-600 mt-1">
              {lastUpdated ? `最后更新 ${lastUpdated.toLocaleTimeString('zh-CN')}` : '准备中…'}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap text-xs">
            <span className={`badge ${config.hasCookie ? 'badge-ok' : 'badge-warn'}`}>
              平台 {config.hasCookie ? '已登录' : '未登录'}
            </span>
            <span className={`badge ${hasUsageBinding ? 'badge-ok' : 'badge-info'}`}>
              用量接口 {hasUsageBinding ? '已绑定' : '待绑定'}
            </span>
            <span className="badge badge-info">自动刷新 {refreshIntervalSec}s</span>
            <span className="badge badge-info">下次刷新 {formatCountdown(nextRefreshIn)}</span>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 flex-wrap rounded-2xl border border-[#dcd0ba] bg-[#f9f5ee] px-4 py-3">
          <div>
            <p className="text-sm font-medium text-warm-800">
              {banner
                ? banner.title
                : '数据已连通'}
            </p>
            <p className="text-xs text-warm-600 mt-1">
              {banner
                ? banner.text
                : '余额、使用量和模型分布已经可以同步。手动刷新会立即重置自动刷新计时。'}
            </p>
          </div>
          <button
            className={banner?.toSettings ? 'btn btn-primary no-drag' : 'btn btn-ghost no-drag'}
            onClick={() => {
              if (banner?.toSettings) {
                window.location.hash = '/settings';
                return;
              }
              load();
            }}
            disabled={loading}
          >
            {loading ? '同步中…' : banner?.action ?? '刷新数据'}
          </button>
        </div>

        <div className="flex gap-2 flex-wrap text-xs">
          {displayCurrency && <span className="badge badge-ok">结算 · {displayCurrency}</span>}
          {data?.balance?.is_available && <span className="badge badge-ok">服务可用</span>}
          {balanceError && <span className="badge badge-err">余额接口: {balanceError.error}</span>}
          {usageError && <span className="badge badge-warn">使用量: {usageError.error}</span>}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="API 总余额"
          value={balance ? Number(balance.total_balance).toFixed(2) : '--'}
          unit={displayCurrency}
          hint={balance ? `已充值 ${Number(balance.topped_up_balance).toFixed(2)}` : undefined}
          accent={balanceLow ? 'terracotta' : 'peach'}
        />
        <StatCard
          label="赠送额度"
          value={balance ? Number(balance.granted_balance).toFixed(2) : '--'}
          unit={displayCurrency}
          hint={balanceLow ? '余额偏低时建议优先补充充值额度' : 'Granted'}
          accent="sage"
        />
        <StatCard
          label={usage?.periodLabel ? '本月请求数' : '今日请求数'}
          value={usage ? usage.today.requests.toLocaleString() : '--'}
          unit="次"
          hint={usage ? `累计 ${usage.totals.requests.toLocaleString()}` : '需要登录平台'}
          accent="dusty"
        />
        <StatCard
          label={usage?.periodLabel ? '本月 Token' : '今日 Token'}
          value={usage ? formatToken(usage.today.totalTokens) : '--'}
          unit="tokens"
          hint={
            usage
              ? `输入 ${usage.today.promptTokens.toLocaleString()} · 输出 ${usage.today.completionTokens.toLocaleString()}`
              : '需要登录平台'
          }
          accent="terracotta"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center justify-between gap-3 mb-3">
            <h2 className="text-sm font-semibold text-warm-800">
              {usage?.periodLabel ? '月度 Token 概览' : '7 日 Token 趋势'}
            </h2>
            <span className="text-xs text-warm-600">
              {usage ? `${usage.startStr} → ${usage.endStr}` : '—'}
            </span>
          </div>
          <div className="h-64">
            {hasDailySeries ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailySeries}>
                  <defs>
                    <linearGradient id="grad1" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#D78B5C" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#D78B5C" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ECE3D1" />
                  <XAxis dataKey="date" stroke="#8B7355" fontSize={11} />
                  <YAxis stroke="#8B7355" fontSize={11} />
                  <Tooltip
                    contentStyle={{
                      background: '#FFF',
                      border: '1px solid #ECE3D1',
                      borderRadius: 10,
                      fontSize: 12,
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="promptTokens"
                    name="输入 tokens"
                    stroke="#F4B183"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="completionTokens"
                    name="输出 tokens"
                    stroke="#D78B5C"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState text={trendEmptyText} />
            )}
          </div>
        </div>

        <div className="card p-5">
          <h2 className="text-sm font-semibold text-warm-800 mb-3">模型分布</h2>
          <div className="h-64">
            {modelPie.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={modelPie}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={50}
                    outerRadius={85}
                    paddingAngle={3}
                  >
                    {modelPie.map((_, i) => (
                      <Cell key={i} fill={MODEL_COLORS[i % MODEL_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: '#FFF',
                      border: '1px solid #ECE3D1',
                      borderRadius: 10,
                      fontSize: 12,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState text={usage ? '暂无模型分布数据' : '登录并绑定接口后可查看模型分布'} />
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-5">
          <div className="flex items-center justify-between gap-3 mb-3">
            <h2 className="text-sm font-semibold text-warm-800">请求数趋势</h2>
            <span className="text-xs text-warm-600">{dailySeries.length > 0 ? `${dailySeries.length} 天` : '—'}</span>
          </div>
          <div className="h-56">
            {hasDailySeries ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailySeries}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ECE3D1" />
                  <XAxis dataKey="date" stroke="#8B7355" fontSize={11} />
                  <YAxis stroke="#8B7355" fontSize={11} />
                  <Tooltip
                    contentStyle={{
                      background: '#FFF',
                      border: '1px solid #ECE3D1',
                      borderRadius: 10,
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="requests" fill="#A8B89D" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState text={requestEmptyText} />
            )}
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between gap-3 mb-3">
            <h2 className="text-sm font-semibold text-warm-800">消耗金额趋势</h2>
            <span className="text-xs text-warm-600">{displayCurrency}</span>
          </div>
          <div className="h-56">
            {hasDailySeries ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailySeries}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ECE3D1" />
                  <XAxis dataKey="date" stroke="#8B7355" fontSize={11} />
                  <YAxis stroke="#8B7355" fontSize={11} />
                  <Tooltip
                    contentStyle={{
                      background: '#FFF',
                      border: '1px solid #ECE3D1',
                      borderRadius: 10,
                      fontSize: 12,
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="cost"
                    name="消耗"
                    stroke="#C4A78F"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState text={costEmptyText} />
            )}
          </div>
        </div>
      </div>

      {!usage && (
        <div className="card p-6 space-y-3">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="text-sm font-medium text-warm-800">尚未获取到使用量详情</p>
              <p className="text-xs text-warm-600 mt-1">
                使用量、token、请求次数等数据来自 DeepSeek 平台账户。已登录但仍为空时，可能是平台改了接口。
              </p>
            </div>
            <button className="btn btn-primary no-drag" onClick={() => (window.location.hash = '/settings')}>
              前往设置
            </button>
          </div>

          {usageDebugError?.capturedUrls && usageDebugError.capturedUrls.length > 0 && (
            <details className="text-xs text-warm-600 pt-2 border-t border-cream-200">
              <summary className="cursor-pointer hover:text-warm-800 select-none">
                已抓取的平台接口（{usageDebugError.capturedUrls.length}）· 点击展开
              </summary>
              <ul className="mt-2 space-y-0.5 font-mono text-[11px] max-h-48 overflow-auto">
                {usageDebugError.capturedUrls.map((u, i) => (
                  <li key={i} className="text-warm-700 break-all">
                    · {u}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
