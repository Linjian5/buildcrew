interface VerticalProgressProps {
  value: number;
  height?: number;
  width?: number;
  color?: string;
  className?: string;
}

/**
 * Vertical progress bar — track color matches page background,
 * making it visually "invisible" so only the fill is seen.
 */
export function VerticalProgress({
  value,
  height = 80,
  width = 8,
  color,
  className,
}: VerticalProgressProps) {
  const pct = Math.max(0, Math.min(100, value));
  const fillColor =
    color ?? (pct >= 90 ? '#F43F5E' : pct >= 70 ? '#F59E0B' : '#3B82F6');
  const r = width / 2;

  return (
    <svg
      width={width}
      height={height}
      className={className}
      style={{ display: 'block', flexShrink: 0 }}
    >
      {/* Track — uses CSS variable so it follows dark/light theme */}
      <rect
        x={0} y={0}
        width={width} height={height}
        rx={r} ry={r}
        style={{ fill: 'var(--background)' }}
      />
      {pct > 0 && (
        <rect
          x={0}
          y={height - (height * pct) / 100}
          width={width}
          height={(height * pct) / 100}
          rx={r} ry={r}
          fill={fillColor}
          style={{
            filter: `drop-shadow(0 0 4px ${fillColor}80)`,
            transition: 'y 0.5s ease, height 0.5s ease',
          }}
        />
      )}
    </svg>
  );
}
