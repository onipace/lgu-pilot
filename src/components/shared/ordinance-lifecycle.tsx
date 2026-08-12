'use client';

const STAGES = [
  { num: 1, label: 'Research', color: '#5B69F5', module: 'E.L.L.A.', icon: 'research' },
  { num: 2, label: 'Drafting', color: '#28C47B', module: 'O.B.R.A.', icon: 'draft' },
  { num: 3, label: 'Compliance', color: '#F5A623', module: 'O.B.R.A.', icon: 'compliance' },
  { num: 4, label: 'Digitization', color: '#E85D26', module: 'L.I.K.H.A.', icon: 'archive' },
  { num: 5, label: 'Codification', color: '#1BA3D9', module: 'L.I.N.A.W.', icon: 'codify' },
  { num: 6, label: 'Tracking', color: '#5B69F5', module: 'L.I.N.A.W.', icon: 'lineage' },
  { num: 7, label: 'Insighting', color: '#17A97D', module: 'Platform', icon: 'insights' },
];

function StageIcon({ type, color, size = 48 }: { type: string; color: string; size?: number }) {
  const s = size;
  const half = s / 2;
  const r = s * 0.38;
  const sw = 1.5;

  switch (type) {
    case 'research':
      return (
        <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}>
          <circle cx={half} cy={half} r={r} fill="none" stroke={color} strokeWidth={sw} />
          <circle cx={half} cy={half * 0.75} r={r * 0.35} fill="none" stroke={color} strokeWidth={sw} />
          <line x1={half} y1={half * 1.1} x2={half} y2={half * 1.45} stroke={color} strokeWidth={sw} />
          <line x1={half * 0.82} y1={half * 1.3} x2={half * 1.18} y2={half * 1.3} stroke={color} strokeWidth={sw} />
          <circle cx={half * 1.35} cy={half * 0.6} r={r * 0.12} fill="#F5A623" opacity={0.8} />
        </svg>
      );
    case 'draft':
      return (
        <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}>
          <rect x={half * 0.72} y={half * 0.55} width={r * 0.7} height={r * 1.1} rx={2} fill="none" stroke={color} strokeWidth={sw} />
          <line x1={half * 0.82} y1={half * 0.8} x2={half * 1.18} y2={half * 0.8} stroke={color} strokeWidth={sw * 0.8} />
          <line x1={half * 0.82} y1={half * 0.95} x2={half * 1.18} y2={half * 0.95} stroke={color} strokeWidth={sw * 0.8} />
          <line x1={half * 0.82} y1={half * 1.1} x2={half * 1.08} y2={half * 1.1} stroke={color} strokeWidth={sw * 0.8} />
          <line x1={half * 1.15} y1={half * 1.2} x2={half * 1.32} y2={half * 1.02} stroke="#F5A623" strokeWidth={sw} strokeLinecap="round" />
        </svg>
      );
    case 'compliance':
      return (
        <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}>
          <path d={`M${half} ${half * 0.55} L${half * 1.35} ${half * 1.35} L${half * 0.65} ${half * 1.35} Z`} fill="none" stroke={color} strokeWidth={sw} strokeLinejoin="round" />
          <line x1={half} y1={half * 0.85} x2={half} y2={half * 1.05} stroke={color} strokeWidth={sw} strokeLinecap="round" />
          <circle cx={half} cy={half * 1.18} r={r * 0.06} fill={color} />
        </svg>
      );
    case 'archive':
      return (
        <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}>
          <rect x={half * 0.7} y={half * 0.75} width={r * 0.85} height={r * 0.7} rx={2} fill="none" stroke={color} strokeWidth={sw} />
          <rect x={half * 0.82} y={half * 0.6} width={r * 0.55} height={r * 0.22} rx={1} fill="none" stroke={color} strokeWidth={sw * 0.8} />
          <line x1={half * 0.82} y1={half * 0.95} x2={half * 1.18} y2={half * 0.95} stroke={color} strokeWidth={sw * 0.7} />
          <line x1={half * 0.82} y1={half * 1.08} x2={half * 1.12} y2={half * 1.08} stroke={color} strokeWidth={sw * 0.7} />
          <line x1={half * 0.82} y1={half * 1.21} x2={half * 1.05} y2={half * 1.21} stroke={color} strokeWidth={sw * 0.7} />
        </svg>
      );
    case 'codify':
      return (
        <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}>
          <rect x={half * 0.7} y={half * 0.55} width={r * 0.85} height={r * 1.2} rx={2} fill="none" stroke={color} strokeWidth={sw} />
          <line x1={half * 0.82} y1={half * 0.8} x2={half * 1.18} y2={half * 0.8} stroke={color} strokeWidth={sw * 0.8} />
          <line x1={half * 0.82} y1={half * 0.95} x2={half * 1.18} y2={half * 0.95} stroke={color} strokeWidth={sw * 0.8} />
          <line x1={half * 0.82} y1={half * 1.1} x2={half * 1.18} y2={half * 1.1} stroke={color} strokeWidth={sw * 0.8} />
          <line x1={half * 0.82} y1={half * 1.25} x2={half * 1.0} y2={half * 1.25} stroke={color} strokeWidth={sw * 0.8} />
          <polyline points={`${half * 1.12},${half * 1.18} ${half * 1.24},${half * 1.3} ${half * 1.42},${half * 1.05}`} fill="none" stroke="#17A97D" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'lineage':
      return (
        <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}>
          <circle cx={half * 0.72} cy={half * 0.85} r={r * 0.22} fill="none" stroke={color} strokeWidth={sw} />
          <circle cx={half * 1.28} cy={half * 0.85} r={r * 0.22} fill="none" stroke={color} strokeWidth={sw} />
          <circle cx={half} cy={half * 1.25} r={r * 0.22} fill="none" stroke={color} strokeWidth={sw} />
          <line x1={half * 0.82} y1={half * 1.0} x2={half * 0.92} y2={half * 1.15} stroke={color} strokeWidth={sw * 0.8} />
          <line x1={half * 1.18} y1={half * 1.0} x2={half * 1.08} y2={half * 1.15} stroke={color} strokeWidth={sw * 0.8} />
          <line x1={half * 0.88} y1={half * 0.85} x2={half * 1.12} y2={half * 0.85} stroke={color} strokeWidth={sw * 0.8} />
        </svg>
      );
    case 'insights':
      return (
        <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}>
          <rect x={half * 0.7} y={half * 0.7} width={r * 0.85} height={r * 0.7} rx={2} fill="none" stroke={color} strokeWidth={sw} />
          <polyline points={`${half * 0.82},${half * 1.2} ${half * 0.95},${half * 0.95} ${half * 1.08},${half * 1.08} ${half * 1.28},${half * 0.78}`} fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
          <circle cx={half * 1.28} cy={half * 0.78} r={r * 0.08} fill={color} />
        </svg>
      );
    default:
      return null;
  }
}

export default function OrdinanceLifecycle() {
  return (
    <div className="rounded-2xl border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface))] p-6 md:p-10">
      {/* Badge */}
      <div className="mb-8 md:mb-12 flex justify-center">
        <div className="inline-flex items-center rounded-full border border-[hsl(38_95%_55%/0.3)] bg-[hsl(38_95%_55%/0.1)] px-5 py-2 text-sm font-bold text-[hsl(38_95%_55%)]">
          AI-Assisted at Every Stage of the Ordinance Lifecycle
        </div>
      </div>

      {/* Desktop: horizontal flow */}
      <div className="hidden md:flex items-start justify-center gap-2">
        {STAGES.map((stage, i) => (
          <div key={stage.num} className="flex items-start">
            <div className="flex flex-col items-center" style={{ minWidth: 120 }}>
              {/* Module label */}
              <span className="mb-3 text-[10px] font-semibold uppercase tracking-wider opacity-40" style={{ color: stage.color }}>
                {stage.module}
              </span>
              {/* Icon circle */}
              <div
                className="flex h-20 w-20 items-center justify-center rounded-full border-2 mb-3 transition-transform hover:scale-105"
                style={{
                  borderColor: `${stage.color}40`,
                  background: `${stage.color}12`,
                }}
              >
                <StageIcon type={stage.icon} color={stage.color} size={44} />
              </div>
              {/* Label */}
              <span className="text-sm font-bold" style={{ color: stage.color }}>
                {stage.num}. {stage.label}
              </span>
            </div>
            {/* Arrow */}
            {i < STAGES.length - 1 && (
              <div className="flex items-center pt-10 px-1">
                <svg width="20" height="12" viewBox="0 0 20 12">
                  <polygon points="0,2 14,2 14,0 20,6 14,12 14,10 0,10" fill={stage.color} opacity="0.5" />
                </svg>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Mobile: vertical flow */}
      <div className="flex md:hidden flex-col items-center gap-0">
        {STAGES.map((stage, i) => (
          <div key={stage.num} className="flex flex-col items-center">
            <div className="flex flex-col items-center">
              {/* Module label */}
              <span className="mb-2 text-[10px] font-semibold uppercase tracking-wider opacity-40" style={{ color: stage.color }}>
                {stage.module}
              </span>
              {/* Icon circle */}
              <div
                className="flex h-16 w-16 items-center justify-center rounded-full border-2 mb-2"
                style={{
                  borderColor: `${stage.color}40`,
                  background: `${stage.color}12`,
                }}
              >
                <StageIcon type={stage.icon} color={stage.color} size={36} />
              </div>
              {/* Label */}
              <span className="text-sm font-bold" style={{ color: stage.color }}>
                {stage.num}. {stage.label}
              </span>
            </div>
            {/* Arrow down */}
            {i < STAGES.length - 1 && (
              <div className="py-2">
                <svg width="12" height="20" viewBox="0 0 12 20">
                  <polygon points="2,0 2,14 0,14 6,20 12,14 10,14 10,0" fill={stage.color} opacity="0.5" />
                </svg>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
