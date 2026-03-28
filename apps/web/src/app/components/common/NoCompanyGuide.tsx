import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Building2, ArrowRight } from 'lucide-react';

/**
 * All available agents. Inner ring takes the first 5, outer ring gets the rest.
 * To add new agents: just append to this array.
 */
const ALL_AGENTS = [
  // Inner ring (first 5)
  { name: 'aria', label: 'Aria' },
  { name: 'atlas', label: 'Atlas' },
  { name: 'nova', label: 'Nova' },
  { name: 'echo', label: 'Echo' },
  { name: 'sentinel', label: 'Sentinel' },
  // Outer ring (the rest)
  { name: 'vector', label: 'Vector' },
  { name: 'sage', label: 'Sage' },
  { name: 'pixel', label: 'Pixel' },
  { name: 'scout', label: 'Scout' },
  { name: 'generic-male', label: '' },
  { name: 'generic-female', label: '' },
  { name: 'generic-neutral', label: '' },
];

const INNER_COUNT = 5;
const innerAgents = ALL_AGENTS.slice(0, INNER_COUNT);
const outerAgents = ALL_AGENTS.slice(INNER_COUNT);

function pngSrc(n: string) {
  return n === 'aria' ? '/avatars/aria/Aria.png' : `/avatars/${n}/${n}.png`;
}

/**
 * Orbiting ring of avatars.
 * Each avatar is placed at a fixed angle on the ring.
 * The entire ring rotates via CSS animation; each avatar counter-rotates to stay upright.
 */
function OrbitRing({
  agents,
  size,
  animClass,
  counterAnimClass,
}: {
  agents: { name: string; label: string }[];
  size: number;
  animClass: string;
  counterAnimClass: string;
}) {
  const radius = size / 2;

  return (
    <div
      className={`absolute ${animClass}`}
      style={{ width: size, height: size }}
    >
      {agents.map((a, i) => {
        const angle = ((2 * Math.PI) / agents.length) * i - Math.PI / 2;
        const x = radius + radius * Math.cos(angle);
        const y = radius + radius * Math.sin(angle);

        return (
          <div
            key={a.name}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: x, top: y }}
          >
            <div className={counterAnimClass}>
              <div className="flex flex-col items-center">
                <div
                  className="overflow-hidden rounded-full border-2 border-primary/30 shadow-lg shadow-primary/20 transition-transform hover:scale-110 hover:border-primary/60"
                  style={{ width: 64, height: 64 }}
                >
                  <img
                    src={pngSrc(a.name)}
                    alt={a.label || a.name}
                    className="h-full w-full object-cover"
                  />
                </div>
                {a.label && (
                  <span className="mt-0.5 hidden text-[10px] text-muted-foreground md:block">
                    {a.label}
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function NoCompanyGuide({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  if (compact) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-dashed border-border bg-card p-4">
        <Building2 className="h-5 w-5 shrink-0 text-muted-foreground" />
        <p className="flex-1 text-sm text-muted-foreground">{t('empty.noCompanyDesc')}</p>
        <button onClick={() => navigate('/onboarding')} className="flex shrink-0 items-center gap-1 text-sm font-medium text-primary hover:underline">
          {t('empty.createFirst')} <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  const outerSize = 700;
  const innerSize = 460;

  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden">
      {/* Track circles */}
      <div className="pointer-events-none absolute rounded-full border border-primary/15" style={{ width: outerSize, height: outerSize }} />
      <div className="pointer-events-none absolute rounded-full border border-primary/10" style={{ width: innerSize, height: innerSize }} />

      {/* Outer ring */}
      <OrbitRing
        agents={outerAgents}
        size={outerSize}
        animClass="animate-orbit-outer"
        counterAnimClass="animate-orbit-outer-reverse"
      />

      {/* Inner ring */}
      <OrbitRing
        agents={innerAgents}
        size={innerSize}
        animClass="animate-orbit-inner"
        counterAnimClass="animate-orbit-inner-reverse"
      />

      {/* Center card */}
      <div className="relative z-10 rounded-2xl border border-border bg-card/90 p-6 text-center shadow-2xl backdrop-blur-sm md:p-8">
        <Building2 className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
        <h2 className="mb-2 text-lg font-bold text-foreground md:text-xl">{t('empty.noCompany')}</h2>
        <p className="mx-auto mb-5 max-w-xs text-sm text-muted-foreground">{t('empty.noCompanyDesc')}</p>
        <button
          onClick={() => navigate('/onboarding')}
          className="mx-auto flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white hover:bg-primary/90"
        >
          {t('empty.createCompany')} <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
