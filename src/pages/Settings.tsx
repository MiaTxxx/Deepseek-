import { useEffect, useState } from 'react';

type DiagItem = {
  index: number;
  url: string;
  method: string;
  bytes: number;
  usageRowMatches: number;
  preview: string;
};

export default function Settings() {
  const [apiKey, setApiKey] = useState('');
  const [hasCookie, setHasCookie] = useState(false);
  const [refreshIntervalSec, setRefreshIntervalSec] = useState(60);
  const [usageEndpoint, setUsageEndpoint] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [showKey, setShowKey] = useState(false);

  // Diagnose
  const [diagRunning, setDiagRunning] = useState(false);
  const [diagItems, setDiagItems] = useState<DiagItem[] | null>(null);
  const [diagAuto, setDiagAuto] = useState<{ url: string; rows: number } | null>(null);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  const refreshCfg = async () => {
    const c = await window.dsApi.getConfig();
    setApiKey(c.apiKey ?? '');
    setHasCookie(c.hasCookie);
    setRefreshIntervalSec(c.refreshIntervalSec ?? 60);
    setUsageEndpoint(c.usageEndpoint ?? '');
  };

  useEffect(() => {
    refreshCfg();
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const r = await window.dsApi.setConfig({ apiKey, refreshIntervalSec });
      if (r.ok) {
        setMsg({ type: 'ok', text: '已保存' });
      } else {
        setMsg({ type: 'err', text: '保存失败' });
      }
      setTimeout(() => setMsg(null), 1600);
    } finally {
      setSaving(false);
    }
  };

  const copyUsageEndpoint = async () => {
    if (!usageEndpoint) return;
    try {
      await navigator.clipboard.writeText(usageEndpoint);
      setMsg({ type: 'ok', text: '已复制用量接口地址' });
    } catch {
      setMsg({ type: 'err', text: '复制失败' });
    }
  };

  const testBalance = async () => {
    try {
      await window.dsApi.setConfig({ apiKey });
      const r = await window.dsApi.fetchBalance();
      if (r.ok) {
        const b = r.data?.balance_infos?.[0];
        setMsg({ type: 'ok', text: `连接成功 · 余额 ${b?.total_balance} ${b?.currency}` });
      } else {
        setMsg({ type: 'err', text: r.error ?? '失败' });
      }
    } catch (err: any) {
      setMsg({ type: 'err', text: err?.message ?? '余额查询异常' });
    }
  };

  const login = async () => {
    setLoggingIn(true);
    setMsg(null);
    try {
      const r = await window.dsApi.loginDeepSeek();
      if (r.ok) {
        setHasCookie(true);
        setMsg({ type: 'ok', text: '登录成功' });
      } else {
        setMsg({ type: 'err', text: r.error ?? '登录失败' });
      }
    } catch (err: any) {
      setMsg({ type: 'err', text: err?.message ?? '登录异常' });
    } finally {
      setLoggingIn(false);
    }
  };

  const logout = async () => {
    await window.dsApi.clearCookie();
    setHasCookie(false);
    setMsg({ type: 'ok', text: '已清除登录凭证' });
  };

  const diagnose = async () => {
    setDiagRunning(true);
    setMsg(null);
    setDiagItems(null);
    setDiagAuto(null);
    try {
      const r = await window.dsApi.diagnose();
      if (!r.ok) {
        setMsg({ type: 'err', text: r.error ?? '诊断失败' });
        return;
      }
      setDiagItems(r.items ?? []);
      setDiagAuto(r.autoBest ?? null);
      if ((r.total ?? 0) === 0) {
        setMsg({ type: 'err', text: '一个 XHR 都没抓到，可能是 Cookie 失效，请重新登录' });
      }
    } catch (err: any) {
      setMsg({ type: 'err', text: err?.message ?? '诊断异常' });
    } finally {
      setDiagRunning(false);
    }
  };

  const useItem = async (idx: number) => {
    const r = await window.dsApi.useCaptured(idx);
    if (r.ok) {
      setUsageEndpoint(r.url ?? '');
      setMsg({ type: 'ok', text: `已绑定接口：${r.url}` });
    } else {
      setMsg({ type: 'err', text: r.error ?? '绑定失败' });
    }
  };

  const clearEndpoint = async () => {
    await window.dsApi.setConfig({ usageEndpoint: '' });
    setUsageEndpoint('');
    setMsg({ type: 'ok', text: '已清除绑定接口' });
  };

  // Sort: prefer items with most usage-row matches, then by bytes
  const sortedDiag = diagItems
    ? [...diagItems].sort((a, b) => b.usageRowMatches - a.usageRowMatches || b.bytes - a.bytes)
    : null;

  return (
    <div className="p-6 max-w-[900px] mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-warm-800">设置</h1>
        <p className="text-xs text-warm-600 mt-1">配置你的 API Key 与平台登录以启用所有数据</p>
      </div>

      {/* API Key */}
      <section className="card p-6 space-y-4">
        <header className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-warm-800">API Key</h2>
            <p className="text-xs text-warm-600 mt-1">用于查询余额。存储在本地（加密）</p>
          </div>
          <button
            className="text-xs text-accent-terracotta no-drag hover:underline"
            onClick={() => window.dsApi.openExternal('https://platform.deepseek.com/api_keys')}
          >
            获取 API Key →
          </button>
        </header>

        <div className="flex gap-2">
          <input
            className="input font-mono"
            placeholder="sk-..."
            type={showKey ? 'text' : 'password'}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
          <button className="btn btn-ghost" onClick={() => setShowKey((v) => !v)}>
            {showKey ? '隐藏' : '显示'}
          </button>
        </div>

        <div className="flex gap-2">
          <button className="btn btn-primary" onClick={testBalance} disabled={!apiKey}>
            测试连接
          </button>
          <button className="btn btn-ghost" onClick={save}>
            保存
          </button>
        </div>
      </section>

      {/* Platform login */}
      <section className="card p-6 space-y-4">
        <header className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-warm-800">DeepSeek 平台登录</h2>
            <p className="text-xs text-warm-600 mt-1">
              登录后可读取使用量统计（token、请求次数、模型分布、消耗金额等）
            </p>
          </div>
          <span className={`badge ${hasCookie ? 'badge-ok' : 'badge-warn'}`}>
            {hasCookie ? '已登录' : '未登录'}
          </span>
        </header>

        <div className="flex gap-2">
          <button className="btn btn-primary" onClick={login} disabled={loggingIn}>
            {loggingIn ? '请在弹窗完成登录…' : hasCookie ? '重新登录' : '登录 DeepSeek'}
          </button>
          {hasCookie && (
            <button className="btn btn-ghost" onClick={logout}>
              退出登录
            </button>
          )}
        </div>
      </section>

      {/* Usage endpoint diagnose */}
      <section className="card p-6 space-y-4">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-warm-800">用量接口诊断</h2>
            <p className="text-xs text-warm-600 mt-1 leading-relaxed">
              DeepSeek 平台没有公开用量 API。点「诊断」后会弹出一个浏览器窗口，<b>你手动点进「用量统计」或「Usage」页面</b>，让页面加载出来，然后关闭那个窗口。程序会列出所有抓到的接口，你选对应的那个即可。
            </p>
          </div>
          <span className={`badge ${usageEndpoint ? 'badge-ok' : 'badge-warn'} shrink-0`}>
            {usageEndpoint ? '已绑定' : '未绑定'}
          </span>
        </header>

        {usageEndpoint && (
          <div className="space-y-2">
            <div className="text-[11px] font-mono text-warm-700 bg-cream-100/70 rounded-md p-2 break-all">
              {usageEndpoint}
            </div>
            <div className="flex gap-2 flex-wrap">
              <button className="btn btn-ghost !text-[11px] !py-1 !px-2" onClick={copyUsageEndpoint}>
                复制接口
              </button>
              <button
                className="btn btn-ghost !text-[11px] !py-1 !px-2"
                onClick={() => window.dsApi.openExternal('https://platform.deepseek.com/usage')}
              >
                打开用量页
              </button>
            </div>
          </div>
        )}

        <div className="flex gap-2 flex-wrap">
          <button
            className="btn btn-primary"
            onClick={diagnose}
            disabled={diagRunning || !hasCookie}
          >
            {diagRunning ? '诊断窗口打开中…完成后关闭它' : '诊断接口'}
          </button>
          {usageEndpoint && (
            <button className="btn btn-ghost" onClick={clearEndpoint}>
              清除绑定
            </button>
          )}
        </div>

        {diagAuto && (
          <div className="text-xs bg-accent-sage/10 border border-accent-sage/30 rounded-md p-3">
            <div className="font-medium text-[#5a6b4f] mb-1">
              自动识别到疑似用量接口（{diagAuto.rows} 行数据）
            </div>
            <div className="font-mono text-[11px] break-all text-warm-700">{diagAuto.url}</div>
          </div>
        )}

        {sortedDiag && sortedDiag.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-warm-600">
              共抓到 {sortedDiag.length} 个 JSON 响应，按疑似用量匹配度排序。点击条目可展开预览，点「选为用量接口」绑定。
            </p>
            <div className="border border-cream-200 rounded-lg divide-y divide-cream-200 max-h-[460px] overflow-auto">
              {sortedDiag.map((item) => (
                <div key={item.index} className="p-3 hover:bg-cream-50/60 transition-colors">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-[11px] text-warm-600 mb-1">
                        <span className="font-medium text-warm-700">{item.method}</span>
                        <span>{(item.bytes / 1024).toFixed(1)} KB</span>
                        {item.usageRowMatches > 0 && (
                          <span className="badge badge-ok !py-0">匹配 {item.usageRowMatches} 行</span>
                        )}
                      </div>
                      <div className="font-mono text-[11px] text-warm-800 break-all">
                        {item.url}
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button
                        className="btn btn-ghost !text-[11px] !py-1 !px-2"
                        onClick={() =>
                          setExpandedIdx(expandedIdx === item.index ? null : item.index)
                        }
                      >
                        {expandedIdx === item.index ? '收起' : '预览'}
                      </button>
                      <button
                        className="btn btn-primary !text-[11px] !py-1 !px-2"
                        onClick={() => useItem(item.index)}
                      >
                        选为用量接口
                      </button>
                    </div>
                  </div>
                  {expandedIdx === item.index && (
                    <pre className="mt-2 text-[10px] bg-cream-100/70 rounded p-2 overflow-auto max-h-48 whitespace-pre-wrap break-all text-warm-700">
                      {item.preview}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Refresh */}
      <section className="card p-6 space-y-4">
        <header>
          <h2 className="text-sm font-semibold text-warm-800">刷新间隔</h2>
          <p className="text-xs text-warm-600 mt-1">主面板与悬浮窗的数据自动刷新周期</p>
        </header>
        <div className="flex flex-wrap gap-2">
          {[15, 30, 60, 300].map((sec) => (
            <button
              key={sec}
              className={`btn !py-1.5 !px-3 ${refreshIntervalSec === sec ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setRefreshIntervalSec(sec)}
            >
              {sec < 60 ? `${sec}s` : sec === 300 ? '5m' : '1m'}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <input
            className="input max-w-[160px]"
            type="number"
            min={15}
            max={3600}
            value={refreshIntervalSec}
            onChange={(e) => {
              const raw = e.target.value;
              if (raw === '') { setRefreshIntervalSec(60); return; }
              const n = Number(raw);
              if (isNaN(n)) return;
              setRefreshIntervalSec(Math.min(3600, Math.max(15, n)));
            }}
          />
          <span className="text-xs text-warm-600">秒</span>
          <button className="btn btn-primary ml-auto" onClick={save} disabled={saving}>
            {saving ? '保存中…' : '保存'}
          </button>
        </div>
      </section>

      {msg && (
        <div className={`text-xs ${msg.type === 'ok' ? 'text-[#5a6b4f]' : 'text-[#9a3a3a]'}`}>
          {msg.text}
        </div>
      )}

      <p className="text-[11px] text-warm-600/70 leading-relaxed pt-2">
        提示：DeepSeek 官方仅公开余额 API，使用量数据需通过浏览平台页面捕获其内部接口。接口地址会根据平台改版变化。若数据不再更新，重新登录并运行「诊断接口」即可。
      </p>
    </div>
  );
}
