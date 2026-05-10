import { ReactNode } from 'react';

interface Props {
  label: string;
  value: ReactNode;
  unit?: string;
  hint?: string;
  icon?: ReactNode;
  accent?: 'blue' | 'purple' | 'green' | 'orange' | 'cyan';
}

const accentStyle: Record<NonNullable<Props['accent']>, string> = {
  blue: 'from-neon-blue/30 to-neon-blue/5 text-neon-blue',
  purple: 'from-neon-purple/30 to-neon-purple/5 text-neon-purple',
  green: 'from-neon-green/30 to-neon-green/5 text-neon-green',
  orange: 'from-neon-orange/30 to-neon-orange/5 text-neon-orange',
  cyan: 'from-neon-cyan/30 to-neon-cyan/5 text-neon-cyan',
};

export default function StatCard({ label, value, unit, hint, icon, accent = 'blue' }: Props) {
  return (
    <div className="card p-5 relative overflow-hidden">
      <div
        className={`absolute -right-6 -top-6 w-24 h-24 rounded-full bg-gradient-to-br ${accentStyle[accent]} opacity-70`}
      />
      <div className="relative">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-medium text-dark-muted tracking-wide">{label}</span>
          {icon}
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className={`text-2xl font-semibold tabular-nums ${accentStyle[accent].split(' ').pop()}`}>{value}</span>
          {unit && <span className="text-xs text-dark-muted">{unit}</span>}
        </div>
        {hint && <p className="mt-1 text-xs text-dark-muted/80">{hint}</p>}
      </div>
    </div>
  );
}
