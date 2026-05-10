import { useEffect, useState } from 'react';

interface Props {
  active: string;
  onNavigate: (route: string) => void;
}

export default function TitleBar({ active, onNavigate }: Props) {
  const [floatOn, setFloatOn] = useState(false);

  useEffect(() => {
    // nothing to do on init; state is local toggle-intent
  }, []);

  return (
    <header className="titlebar h-12 flex items-center justify-between px-4 border-b border-dark-border bg-dark-bg/80 backdrop-blur">
      <div className="flex items-center gap-2">
        <img src="./logo.svg" alt="logo" className="w-6 h-6 rounded-lg shadow-neon" />
        <span className="text-sm font-semibold text-dark-text">DeepSeek Monitor</span>
      </div>

      <nav className="no-drag flex items-center gap-1">
        <TabBtn label="仪表盘" active={active === '/' || active === ''} onClick={() => onNavigate('/')} />
        <TabBtn label="设置" active={active === '/settings'} onClick={() => onNavigate('/settings')} />
      </nav>

      <div className="no-drag flex items-center gap-1">
        <button
          className="btn btn-ghost !py-1.5 !px-3"
          onClick={async () => {
            await window.dsApi.toggleFloat();
            setFloatOn((v) => !v);
          }}
          title="显示/隐藏悬浮窗"
        >
          <span className="text-xs">🪟 {floatOn ? '收起悬浮' : '悬浮窗'}</span>
        </button>
        <button
          className="w-8 h-8 rounded-lg hover:bg-dark-border flex items-center justify-center text-dark-muted"
          onClick={() => window.dsApi.winMinimize()}
          title="最小化"
        >
          —
        </button>
        <button
          className="w-8 h-8 rounded-lg hover:bg-dark-border flex items-center justify-center text-dark-muted"
          onClick={() => window.dsApi.winHide()}
          title="隐藏到托盘"
        >
          ×
        </button>
      </div>
    </header>
  );
}

function TabBtn({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
        active
          ? 'bg-gradient-to-r from-neon-blue/20 to-neon-purple/20 text-neon-cyan'
          : 'text-dark-muted hover:bg-dark-border'
      }`}
    >
      {label}
    </button>
  );
}
