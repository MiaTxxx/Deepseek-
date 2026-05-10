import { ReactNode } from 'react';

interface Props {
  label: string;
  value: ReactNode;
  unit?: string;
  hint?: string;
  icon?: ReactNode;
  accent?: 'peach' | 'sage' | 'dusty' | 'terracotta';
}

const accentStyle: Record<NonNullable<Props['accent']>, string> = {
  peach: 'from-accent-peach/30 to-accent-peach/5 text-accent-terracotta',
  sage: 'from-accent-sage/30 to-accent-sage/5 text-[#5a6b4f]',
  dusty: 'from-accent-dusty/30 to-accent-dusty/5 text-warm-700',
  terracotta: 'from-accent-terracotta/30 to-accent-terracotta/5 text-accent-terracotta',
};

export default function StatCard({ label, value, unit, hint, icon, accent = 'peach' }: Props) {
  return (
    <div className="card p-5 relative overflow-hidden">
      <div
        className={`absolute -right-6 -top-6 w-24 h-24 rounded-full bg-gradient-to-br ${accentStyle[accent]} opacity-70`}
      />
      <div className="relative">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-medium text-warm-600 tracking-wide">{label}</span>
          {icon}
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl font-semibold text-warm-800 tabular-nums">{value}</span>
          {unit && <span className="text-xs text-warm-600">{unit}</span>}
        </div>
        {hint && <p className="mt-1 text-xs text-warm-600/80">{hint}</p>}
      </div>
    </div>
  );
}
