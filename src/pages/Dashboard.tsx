import { useCallback, useEffect, useState } from 'react';
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

export default function Dashboard() {
  const [data, setData] = useState<FetchAllResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [interval, setIntervalSec] = useState(60);

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
    (async () => {
      const cfg = await window.dsApi.getConfig();
      setIntervalSec(cfg.refreshIntervalSec ?? 60);
    })();
    load();
  }, [load]);

  useEffect(() => {
    if (!interval) return;
    const t = window.setInterval(load, interval * 1000);
    return () => window.clearInterval(t);
  }, [interval, load]);

  const balance = data?.balance?.balance_infos?.[0];
  const usage = data?.usage;

  const balanceError = data?.errors?.find((e) => e.kind === 'balance');
  const usageError = data?.errors?.find((e) => e.kind === 'usage');

  const modelPie = Object.entries(usage?.byModel ?? {}).map(([name, value]) => ({
    name,
    value,
  }));

  const usageDebugError = data?.errors?.find((e) => e.kind === 'usage')?.debug as
    | { capturedUrls?: string[] }
    | undefined;

  return (
    <div className="p-6 space-y-6 max-w-[1200px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-warm-800">总览</h1>
          <p className="text-xs text-warm-600 mt-1">
            {lastUpdated ? `最后更新 ${lastUpdated.toLocaleTimeString('zh-CN')}` : '准备中…'}
          </p>
        </div>
        <button className="btn btn-primary no-drag" onClick={load} disabled={loading}>
          <span className={loading ? 'animate-spin' : ''}>↻</span>
          {loading ? '同步中' : '刷新'}
        </button>
      </div>

      {/* Status strip */}
      <div className="flex gap-2 flex-wrap text-xs">
        {balance?.currency && (
          <span className="badge badge-ok">余额 · {balance.currency}</span>
        )}
        {data?.balance?.is_available && <span className="badge badge-ok">服务可用</span>}
        {balanceError && (
          <span className="badge badge-err">余额接口: {balanceError.error}</span>
        )}
        {usageError && (
          <span className="badge badge-warn">使用量: {usageError.error}</span>
        )}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="API 总余额"
          value={balance ? Number(balance.total_balance).toFixed(2) : '--'}
          unit={balance?.currency ?? ''}
          hint={balance ? `已充值 ${Number(balance.topped_up_balance).toFixed(2)}` : undefined}
          accent="peach"
        />
        <StatCard
          label="赠送额度"
          value={balance ? Number(balance.granted_balance).toFixed(2) : '--'}
          unit={balance?.currency ?? ''}
          hint="Granted"
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
          value={
            usage
              ? `${(usage.today.totalTokens / 1000).toFixed(1)}K`
              : '--'
          }
          unit="tokens"
          hint={
            usage
              ? `输入 ${usage.today.promptTokens.toLocaleString()} · 输出 ${usage.today.completionTokens.toLocaleString()}`
              : '需要登录平台'
          }
          accent="terracotta"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-warm-800">
              {usage?.periodLabel ? '月度 Token 概览' : '7 日 Token 趋势'}
            </h2>
            <span className="text-xs text-warm-600">
              {usage ? `${usage.startStr} → ${usage.endStr}` : '—'}
            </span>
          </div>
          <div className="h-64">
            {usage?.series?.length === 0 ? (
              <EmptyState
                text={`平台返回的是月度累计数据，暂无日粒度曲线。本月累计 ${(
                  usage.totals.totalTokens / 1000
                ).toFixed(1)}K tokens · ${usage.totals.requests.toLocaleString()} 次请求`}
              />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
              <LineChart data={usage?.series ?? []}>
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
              <EmptyState text="暂无模型分布数据" />
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-warm-800 mb-3">请求数趋势</h2>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={usage?.series ?? []}>
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
          </div>
        </div>

        <div className="card p-5">
          <h2 className="text-sm font-semibold text-warm-800 mb-3">消耗金额趋势</h2>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={usage?.series ?? []}>
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
          </div>
        </div>
      </div>

      {/* Empty state / CTA */}
      {!usage && (
        <div className="card p-6 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-warm-800">尚未获取到使用量详情</p>
              <p className="text-xs text-warm-600 mt-1">
                使用量、token、请求次数等数据来自 DeepSeek 平台账户。已登录但仍为空时，可能是平台改了接口。
              </p>
            </div>
            <button
              className="btn btn-primary no-drag"
              onClick={() => (window.location.hash = '/settings')}
            >
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
                  <li key={i} className="text-warm-700 break-all">· {u}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="h-full flex items-center justify-center text-xs text-warm-600/70">{text}</div>
  );
}
