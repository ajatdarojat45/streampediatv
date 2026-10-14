import type { GoalooPlayerAttribute } from '@/lib/types';

/** The chart box in viewBox units — the SVG scales to whatever width it gets. */
const SIZE = 260;
const CENTER = SIZE / 2;
/** Distance from the centre to the 100 ring; the axis labels sit just outside. */
const RADIUS = 82;
/** Six axes: the first points straight up and the rest run clockwise — the
 *  layout the feed's own radar draws (`getRadarOption`). */
const AXES = 6;
/** Rings drawn under the data: 25/50/75/100% of the radius. */
const LEVELS = [0.25, 0.5, 0.75, 1];

/** A published value clamped to the feed's own 0-100 scale. */
const clamp = (value: number): number => Math.max(0, Math.min(100, value));

/** The point on axis `i` at `ratio` of the full radius. */
function pointAt(i: number, ratio: number): { x: number; y: number } {
  const angle = ((-90 + (360 / AXES) * i) * Math.PI) / 180;
  return {
    x: CENTER + RADIUS * ratio * Math.cos(angle),
    y: CENTER + RADIUS * ratio * Math.sin(angle),
  };
}

/** One ratio per axis, as an SVG `points` string (the six-point outline). */
function hexagon(ratios: number[]): string {
  return ratios
    .map((ratio, i) => {
      const { x, y } = pointAt(i, ratio);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

/** Where an axis label goes: outside the 100 ring, anchored away from the centre
 *  so it never runs back over the polygon. */
function labelAt(i: number): {
  x: number;
  y: number;
  anchor: 'start' | 'middle' | 'end';
  baseline: 'auto' | 'middle' | 'hanging';
} {
  const { x, y } = pointAt(i, 1.13);
  const dx = x - CENTER;
  const dy = y - CENTER;
  return {
    x,
    y,
    anchor: dx > 8 ? 'start' : dx < -8 ? 'end' : 'middle',
    baseline: dy > 8 ? 'hanging' : dy < -8 ? 'auto' : 'middle',
  };
}

/**
 * The six-axis attribute radar the feed publishes for a player (`RadarInfo`):
 * outfield PAC/SHO/PHY/PAS/DEF/DRI, or DIV/HAN/POS/KIC/SPD/REF for a keeper, all
 * on the feed's own 0-100 scale. The axes are labelled on the chart and the same
 * six numbers are listed as bars under it, so every value can be read — and read
 * out to a screen reader — without parsing the polygon.
 */
export function PlayerRadar({
  attribute,
  name,
}: {
  attribute: GoalooPlayerAttribute;
  name: string;
}) {
  const values = attribute.skills.map((skill) => clamp(skill.value));
  const labels = attribute.skills.map((skill, i) => ({ label: skill.label, ...labelAt(i) }));
  const summary = attribute.skills.map((skill) => `${skill.label} ${skill.value}`).join(', ');
  return (
    <div className="flex w-full flex-col items-center gap-3.5">
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="h-[236px] w-[236px] shrink-0"
        role="img"
        aria-label={`${name} — ${attribute.outfield ? 'outfield' : 'goalkeeper'} attribute radar: ${summary}`}
      >
        {LEVELS.map((level) => (
          <polygon
            key={level}
            points={hexagon(Array.from({ length: AXES }, () => level))}
            className="fill-none stroke-border-soft"
            strokeWidth={1}
          />
        ))}
        {attribute.skills.map((skill, i) => {
          const { x, y } = pointAt(i, 1);
          return (
            <line
              key={skill.label}
              x1={CENTER}
              y1={CENTER}
              x2={x}
              y2={y}
              className="stroke-border-soft"
              strokeWidth={1}
            />
          );
        })}
        <polygon
          points={hexagon(values.map((value) => value / 100))}
          className="fill-accent-soft stroke-accent"
          strokeWidth={1.5}
        />
        {attribute.skills.map((skill, i) => {
          const { x, y } = pointAt(i, values[i] / 100);
          return <circle key={skill.label} cx={x} cy={y} r={2.6} className="fill-accent" />;
        })}
        {labels.map((label) => (
          <text
            key={label.label}
            x={label.x}
            y={label.y}
            textAnchor={label.anchor}
            dominantBaseline={label.baseline}
            className="fill-muted text-[11px] font-bold"
          >
            {label.label}
          </text>
        ))}
      </svg>
      {/* The numbers the polygon is drawn from, on the same 0-100 scale: each row
       *  reads label, bar, value, so a rating can be compared with its axis. */}
      <ul className="m-0 grid w-full list-none grid-cols-1 gap-x-4 gap-y-2 p-0 min-[420px]:grid-cols-2">
        {attribute.skills.map((skill, i) => (
          <li key={skill.label} className="flex items-center gap-1.5">
            <span className="w-8 shrink-0 text-[11px] font-bold uppercase tracking-[0.04em] text-muted">
              {skill.label}
            </span>
            <span className="block h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-[#f1f3f4] [[data-theme=dark]_&]:bg-border-soft">
              <span
                className="block h-full rounded-full bg-accent"
                style={{ width: `${values[i]}%` }}
              />
            </span>
            <span className="w-7 shrink-0 text-right text-[12px] font-bold tabular-nums text-text">
              {skill.value}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
