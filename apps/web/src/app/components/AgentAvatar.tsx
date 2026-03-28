'use client';

import { useId } from 'react';
import { Department, departmentColors } from '../data/agents';

/* ---------------------------------------------------------------------------
 * Keyframes injected once via a <style> tag scoped by a data-attribute.
 * This avoids inline style blocks per-instance while keeping the component
 * self-contained (no external CSS file dependency).
 * -------------------------------------------------------------------------*/
const KEYFRAMES = `
@keyframes aa-breathe {
  0%, 100% { transform: translateY(0); }
  50%      { transform: translateY(-3px); }
}
@keyframes aa-float-slow {
  0%, 100% { transform: translateY(0) scale(1); opacity: 0.5; }
  50%      { transform: translateY(-4px) scale(1.15); opacity: 0.8; }
}
@keyframes aa-float-fast {
  0%, 100% { transform: translateY(0) scale(1); opacity: 0.6; }
  50%      { transform: translateY(-6px) scale(1.2); opacity: 1; }
}
@keyframes aa-ring-pulse {
  0%, 100% { box-shadow: 0 0 0 0 var(--aa-ring-color); }
  50%      { box-shadow: 0 0 8px 3px var(--aa-ring-color); }
}
@keyframes aa-ring-spin {
  0%   { box-shadow: 3px 0 8px -1px var(--aa-ring-color); }
  25%  { box-shadow: 0 3px 8px -1px var(--aa-ring-color); }
  50%  { box-shadow: -3px 0 8px -1px var(--aa-ring-color); }
  75%  { box-shadow: 0 -3px 8px -1px var(--aa-ring-color); }
  100% { box-shadow: 3px 0 8px -1px var(--aa-ring-color); }
}
@keyframes aa-ring-fast-pulse {
  0%, 100% { box-shadow: 0 0 0 0 var(--aa-ring-color); }
  50%      { box-shadow: 0 0 12px 4px var(--aa-ring-color); }
}
@keyframes aa-glitch {
  0%  { transform: translate(0); filter: none; }
  20% { transform: translate(-2px, 1px); filter: hue-rotate(90deg); }
  40% { transform: translate(2px, -1px); filter: brightness(1.5); }
  60% { transform: translate(-1px, -1px); filter: hue-rotate(-90deg); }
  80% { transform: translate(1px, 2px); filter: brightness(0.8); }
  100%{ transform: translate(0); filter: none; }
}
@keyframes aa-warn-pulse {
  0%, 100% { opacity: 0.4; }
  50%      { opacity: 0.8; }
}
@keyframes aa-code-float {
  0%   { transform: translateY(0) rotate(0deg); opacity: 0; }
  20%  { opacity: 1; }
  80%  { opacity: 1; }
  100% { transform: translateY(-20px) rotate(15deg); opacity: 0; }
}
`;

let keyframesInjected = false;

function ensureKeyframes() {
  if (typeof window === 'undefined') return;
  if (keyframesInjected) return;
  keyframesInjected = true;
  const style = document.createElement('style');
  style.setAttribute('data-agent-avatar', '');
  style.textContent = KEYFRAMES;
  document.head.appendChild(style);
}

/* ---------------------------------------------------------------------------
 * Types
 * -------------------------------------------------------------------------*/
type AnimationState = 'idle' | 'working' | 'warning' | 'paused' | 'error';
type Size = 'xs' | 'sm' | 'md' | 'lg';

interface AgentAvatarProps {
  name: string;
  department: Department;
  status?: AnimationState;
  size?: Size;
  showRing?: boolean;
  className?: string;
}

/* ---------------------------------------------------------------------------
 * Size maps
 * -------------------------------------------------------------------------*/
const SIZE_PX: Record<Size, number> = { xs: 32, sm: 48, md: 64, lg: 160 };

const SIZE_CLASSES: Record<Size, string> = {
  xs: 'w-8 h-8',
  sm: 'w-12 h-12',
  md: 'w-16 h-16',
  lg: 'w-[160px] h-[160px]',
};

const FONT_SIZE: Record<Size, string> = {
  xs: '0.625rem',
  sm: '0.75rem',
  md: '1rem',
  lg: '3rem',
};

const RING_WIDTH: Record<Size, string> = {
  xs: 'ring-[1.5px]',
  sm: 'ring-2',
  md: 'ring-2',
  lg: 'ring-[3px]',
};

const DOT_SIZE: Record<Size, string> = {
  xs: 'w-2 h-2',
  sm: 'w-3 h-3',
  md: 'w-3 h-3',
  lg: 'w-5 h-5',
};

/* ---------------------------------------------------------------------------
 * Status colour tokens
 * -------------------------------------------------------------------------*/
const RING_COLORS: Record<AnimationState, string> = {
  idle: '#6B7280',
  working: '#10B981',
  warning: '#F59E0B',
  paused: '#6B7280',
  error: '#F43F5E',
};

const DOT_COLORS: Record<AnimationState, string> = {
  idle: '#6B7280',
  working: '#10B981',
  warning: '#F59E0B',
  paused: '#6B7280',
  error: '#F43F5E',
};

/* ---------------------------------------------------------------------------
 * Particle helpers
 * -------------------------------------------------------------------------*/
interface Particle {
  top: string;
  left: string;
  size: number;
  delay: string;
  animation: string;
  content?: string;
}

function makeParticles(status: AnimationState, size: Size): Particle[] {
  const px = SIZE_PX[size];
  if (px < 48) return []; // too small for particles

  const count = size === 'lg' ? 8 : size === 'md' ? 4 : 3;

  if (status === 'paused') return []; // frozen = no particles

  const particles: Particle[] = [];

  for (let i = 0; i < count; i++) {
    const top = `${15 + Math.round((i * 70) / count)}%`;
    const left = `${10 + ((i * 37 + 13) % 80)}%`;
    const delay = `${(i * 0.4).toFixed(1)}s`;
    const dotSize = size === 'lg' ? 3 : 1.5;

    if (status === 'idle') {
      particles.push({
        top, left, size: dotSize, delay,
        animation: `aa-float-slow ${3 + i * 0.5}s ease-in-out ${delay} infinite`,
      });
    } else if (status === 'working') {
      // Code-bracket particles for working state
      if (i < 2 && size !== 'sm') {
        particles.push({
          top, left, size: 0, delay,
          animation: `aa-code-float ${2 + i * 0.3}s ease-out ${delay} infinite`,
          content: i % 2 === 0 ? '</' : '{}',
        });
      } else {
        particles.push({
          top, left, size: dotSize, delay,
          animation: `aa-float-fast ${1.5 + i * 0.3}s ease-in-out ${delay} infinite`,
        });
      }
    } else if (status === 'warning') {
      particles.push({
        top, left, size: dotSize, delay,
        animation: `aa-warn-pulse ${1 + i * 0.2}s ease-in-out ${delay} infinite`,
      });
    } else if (status === 'error') {
      particles.push({
        top, left, size: dotSize, delay,
        animation: `aa-float-fast 0.8s ease-in-out ${delay} infinite`,
      });
    }
  }

  return particles;
}

/* ---------------------------------------------------------------------------
 * Component
 * -------------------------------------------------------------------------*/
export function AgentAvatar({
  name,
  department,
  status = 'idle',
  size = 'md',
  showRing = true,
  className,
}: AgentAvatarProps) {
  // Inject keyframes on first render (client only)
  if (typeof window !== 'undefined') ensureKeyframes();

  const uid = useId();
  const initials = name?.slice(0, 2).toUpperCase() || '??';
  const deptColor = departmentColors[department] || '#6B7280';
  const ringColor = RING_COLORS[status];
  const particles = makeParticles(status, size);

  // Resolve the effective accent colour (warning/error override dept colour)
  const accentColor =
    status === 'warning' ? '#F59E0B' :
    status === 'error' ? '#F43F5E' :
    deptColor;

  // Paused = desaturated
  const isPaused = status === 'paused';

  /* --- Ring animation style --- */
  const ringAnimation =
    status === 'idle'    ? 'aa-ring-pulse 3s ease-in-out infinite' :
    status === 'working' ? 'aa-ring-spin 1.5s linear infinite' :
    status === 'warning' ? 'aa-ring-pulse 1.5s ease-in-out infinite' :
    status === 'error'   ? 'aa-ring-fast-pulse 0.6s ease-in-out infinite' :
    'none'; // paused

  /* --- Avatar body animation --- */
  const bodyAnimation =
    status === 'idle'  ? 'aa-breathe 3s ease-in-out infinite' :
    status === 'error' ? 'aa-glitch 0.4s steps(5) infinite' :
    'none';

  return (
    <div
      className={`relative inline-flex items-center justify-center${className ? ` ${className}` : ''}`}
    >
      {/* Ring wrapper — separate element so ring animation is independent */}
      <div
        className={`${SIZE_CLASSES[size]} rounded-full ${showRing ? `${RING_WIDTH[size]}` : ''}`}
        style={{
          '--aa-ring-color': ringColor,
          ringColor: showRing ? ringColor : 'transparent',
          animation: showRing ? ringAnimation : 'none',
          // Tailwind ring utility via inline ring-color + ring-width class
          boxShadow: showRing
            ? `0 0 0 ${size === 'lg' ? '3px' : '2px'} ${ringColor}`
            : 'none',
        } as React.CSSProperties}
      >
        {/* Inner circle */}
        <div
          className={`w-full h-full rounded-full flex items-center justify-center relative overflow-hidden`}
          style={{
            background: isPaused
              ? 'linear-gradient(135deg, #6B728040 0%, #6B728020 100%)'
              : `linear-gradient(135deg, ${accentColor}40 0%, ${accentColor}20 100%)`,
            boxShadow: isPaused
              ? 'none'
              : `0 0 ${size === 'lg' ? '40px' : '20px'} ${accentColor}40`,
            animation: bodyAnimation,
            filter: isPaused ? 'grayscale(0.8) brightness(0.6)' : 'none',
            transition: 'filter 0.4s ease, background 0.4s ease, box-shadow 0.4s ease',
          }}
        >
          {/* Holographic / glow layer */}
          <div
            className="absolute inset-0"
            style={{
              opacity: isPaused ? 0.1 : 0.3,
              background: status === 'warning'
                ? 'radial-gradient(circle at 30% 30%, #F59E0B80, transparent 60%)'
                : status === 'error'
                ? 'radial-gradient(circle at 30% 30%, #F43F5E80, transparent 60%)'
                : `radial-gradient(circle at 30% 30%, ${deptColor}80, transparent 60%)`,
            }}
          />

          {/* Initials */}
          <span
            className="relative z-10 font-semibold select-none"
            style={{
              fontSize: FONT_SIZE[size],
              color: isPaused ? '#9CA3AF' : accentColor,
              letterSpacing: size === 'lg' ? '0.05em' : undefined,
              transition: 'color 0.4s ease',
            }}
          >
            {initials}
          </span>

          {/* Particles layer */}
          <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
            {particles.map((p, i) => (
              p.content ? (
                // Code bracket / symbol particle
                <span
                  key={`${uid}-p-${i}`}
                  className="absolute font-mono"
                  style={{
                    top: p.top,
                    left: p.left,
                    fontSize: size === 'lg' ? '0.75rem' : '0.5rem',
                    color: accentColor,
                    animation: p.animation,
                    opacity: 0,
                  }}
                >
                  {p.content}
                </span>
              ) : (
                <div
                  key={`${uid}-p-${i}`}
                  className="absolute rounded-full"
                  style={{
                    top: p.top,
                    left: p.left,
                    width: p.size,
                    height: p.size,
                    background: status === 'error' ? '#F43F5E' : accentColor,
                    animation: p.animation,
                  }}
                />
              )
            ))}
          </div>
        </div>
      </div>

      {/* Status indicator dot */}
      {showRing && size !== 'xs' && (
        <div
          className={`absolute bottom-0 right-0 ${DOT_SIZE[size]} rounded-full border-2 border-card`}
          style={{ backgroundColor: DOT_COLORS[status] }}
        >
          {status === 'working' && (
            <span
              className="absolute inset-0 rounded-full opacity-75"
              style={{ backgroundColor: DOT_COLORS[status], animation: 'ping 1s cubic-bezier(0,0,0.2,1) infinite' }}
            />
          )}
          {status === 'error' && (
            <span
              className="absolute inset-0 rounded-full opacity-75"
              style={{ backgroundColor: DOT_COLORS[status], animation: 'ping 0.6s cubic-bezier(0,0,0.2,1) infinite' }}
            />
          )}
        </div>
      )}
    </div>
  );
}
