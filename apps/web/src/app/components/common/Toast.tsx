/**
 * BuildCrew Toast — wraps sonner with project-specific variants.
 *
 * Usage:
 *   import { bcToast } from '../components/common/Toast';
 *   bcToast.success('Agent hired', 'Atlas (CTO) joined the team');
 *   bcToast.error('Task failed', 'WebSocket integration timed out');
 *   bcToast.warning('Budget alert', 'Echo at 78% budget');
 *   bcToast.info('System update', 'BuildCrew v1.2.0 available');
 *   bcToast.progress('Deploying...', 60); // 60% progress
 */

import { toast } from 'sonner';
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Info,
  X,
} from 'lucide-react';
import type { ReactNode } from 'react';

// ---------------------------------------------------------------------------
// Variant config
// ---------------------------------------------------------------------------

interface VariantConfig {
  borderColor: string;
  icon: ReactNode;
  duration: number | typeof Infinity;
}

const variants: Record<string, VariantConfig> = {
  success: {
    borderColor: '#10B981',
    icon: <CheckCircle size={18} color="#10B981" />,
    duration: 5000,
  },
  error: {
    borderColor: '#F43F5E',
    icon: <XCircle size={18} color="#F43F5E" />,
    duration: Infinity,
  },
  warning: {
    borderColor: '#F59E0B',
    icon: <AlertTriangle size={18} color="#F59E0B" />,
    duration: 8000,
  },
  info: {
    borderColor: '#3B82F6',
    icon: <Info size={18} color="#3B82F6" />,
    duration: 4000,
  },
  progress: {
    borderColor: '#3B82F6',
    icon: <Info size={18} color="#3B82F6" />,
    duration: Infinity,
  },
};

// ---------------------------------------------------------------------------
// Shared render helper
// ---------------------------------------------------------------------------

function renderToast(
  id: string | number,
  variant: string,
  title: string,
  description?: string,
  progressPercent?: number,
) {
  const cfg = variants[variant]!;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        padding: '12px 16px',
        borderLeft: `4px solid ${cfg.borderColor}`,
        background: 'var(--card, #1c1c1e)',
        border: '1px solid var(--border, #2e2e30)',
        borderLeftWidth: 4,
        borderLeftColor: cfg.borderColor,
        borderRadius: 8,
        color: 'var(--foreground, #f5f5f5)',
        minWidth: 320,
        maxWidth: 420,
        boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
        position: 'relative',
      }}
    >
      {/* Icon */}
      <div style={{ flexShrink: 0, marginTop: 2 }}>{cfg.icon}</div>

      {/* Body */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 600,
            lineHeight: '20px',
          }}
        >
          {title}
        </div>
        {description && (
          <div
            style={{
              fontSize: 13,
              color: 'var(--muted-foreground, #a1a1aa)',
              lineHeight: '18px',
              marginTop: 2,
            }}
          >
            {description}
          </div>
        )}

        {/* Progress bar (progress variant only) */}
        {variant === 'progress' && typeof progressPercent === 'number' && (
          <div
            style={{
              marginTop: 8,
              height: 4,
              borderRadius: 2,
              background: 'var(--border, #2e2e30)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${Math.min(Math.max(progressPercent, 0), 100)}%`,
                background: cfg.borderColor,
                borderRadius: 2,
                transition: 'width 0.3s ease',
              }}
            />
          </div>
        )}
      </div>

      {/* Close button */}
      <button
        type="button"
        onClick={() => toast.dismiss(id)}
        aria-label="Close notification"
        style={{
          flexShrink: 0,
          background: 'none',
          border: 'none',
          color: 'var(--muted-foreground, #a1a1aa)',
          cursor: 'pointer',
          padding: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 4,
        }}
      >
        <X size={14} />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

function showVariant(
  variant: string,
  title: string,
  description?: string,
): string | number {
  const cfg = variants[variant]!;
  const duration = cfg.duration === Infinity ? undefined : cfg.duration;

  const id = toast.custom(
    (toastId) => renderToast(toastId, variant, title, description),
    { duration },
  );
  return id;
}

export const bcToast = {
  /** Green success toast, auto-dismiss 5 s */
  success(title: string, description?: string): string | number {
    return showVariant('success', title, description);
  },

  /** Red error toast, NO auto-dismiss */
  error(title: string, description?: string): string | number {
    return showVariant('error', title, description);
  },

  /** Amber warning toast, auto-dismiss 8 s */
  warning(title: string, description?: string): string | number {
    return showVariant('warning', title, description);
  },

  /** Blue info toast, auto-dismiss 4 s */
  info(title: string, description?: string): string | number {
    return showVariant('info', title, description);
  },

  /**
   * Progress toast with a thin bar. No auto-dismiss.
   * Call again with the returned id to update:
   *   const id = bcToast.progress('Deploying...', 30);
   *   bcToast.updateProgress(id, 'Deploying...', 80);
   *   toast.dismiss(id); // done
   */
  progress(title: string, percent: number, description?: string): string | number {
    const id = toast.custom(
      (toastId) => renderToast(toastId, 'progress', title, description, percent),
      { duration: undefined },
    );
    return id;
  },

  /** Update an existing progress toast */
  updateProgress(
    id: string | number,
    title: string,
    percent: number,
    description?: string,
  ): void {
    toast.custom(
      (toastId) => renderToast(toastId, 'progress', title, description, percent),
      { id, duration: undefined },
    );
  },

  /** Programmatically dismiss any toast by id */
  dismiss(id: string | number): void {
    toast.dismiss(id);
  },
};

export default bcToast;
