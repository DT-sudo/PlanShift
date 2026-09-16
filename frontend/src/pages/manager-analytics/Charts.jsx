import { useEffect, useRef, useState } from 'react';

import { isRtl, t } from '../../i18n/index.js';

const HEIGHT = 200;
const PAD = { top: 14, right: 14, bottom: 28, left: 36 };
const PLOT_HEIGHT = HEIGHT - PAD.top - PAD.bottom;
const BASELINE = PAD.top + PLOT_HEIGHT;
const MAX_BAR_WIDTH = 48;
const MAX_LABEL_LENGTH = 10;

export function EmptyChart() {
  return <p className="chart-empty">{t('analytics.noData')}</p>;
}

function useWidth() {
  const ref = useRef(null);
  const [width, setWidth] = useState(640);

  useEffect(() => {
    const unit = parseFloat(getComputedStyle(document.documentElement).fontSize) / 16;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(120, Math.round(entry.contentRect.width / unit))));
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return [ref, width];
}

const truncate = (text) => (text.length > MAX_LABEL_LENGTH ? `${text.slice(0, MAX_LABEL_LENGTH - 1)}…` : text);

function usePlot(count, max) {
  const [ref, width] = useWidth();
  const x = isRtl() ? (value) => width - value : (value) => value;
  const slot = (width - PAD.left - PAD.right) / Math.max(1, count);

  return {
    ref,
    width,
    x,
    barWidth: Math.min(slot * 0.65, MAX_BAR_WIDTH),
    center: (index) => x(PAD.left + slot * (index + 0.5)),
    height: (value) => (value / max) * PLOT_HEIGHT,
  };
}

function Axes({ plot, top, labels }) {
  const { x, width } = plot;

  return (
    <>
      {[0, 0.5, 1].map((fraction) => (
        <line key={fraction} className="chart-gridline" x1={x(PAD.left)} x2={x(width - PAD.right)} y1={PAD.top + PLOT_HEIGHT * fraction} y2={PAD.top + PLOT_HEIGHT * fraction} />
      ))}
      <text className="chart-axis-label" x={x(PAD.left - 6)} y={PAD.top + 4} textAnchor="end">
        {top}
      </text>
      <text className="chart-axis-label" x={x(PAD.left - 6)} y={BASELINE} textAnchor="end">
        0
      </text>
      {labels.map(({ at, text }) => (
        <text key={at} className="chart-axis-label" x={at} y={HEIGHT - 8} textAnchor="middle">
          {text}
        </text>
      ))}
    </>
  );
}

function useHover() {
  const [hovered, setHovered] = useState(null);
  return {
    hovered,
    hover: (index) => ({ onMouseEnter: () => setHovered(index), onMouseLeave: () => setHovered(null) }),
    opacity: (index) => (hovered === null || hovered === index ? 1 : 0.55),
  };
}

function ChartFrame({ plot, label, empty, tip, children }) {
  return (
    <div className="chart-wrap" ref={plot.ref}>
      {empty ? (
        <EmptyChart />
      ) : (
        <svg viewBox={`0 0 ${plot.width} ${HEIGHT}`} className="chart-svg" role="img" aria-label={label}>
          {children}
        </svg>
      )}

      {tip ? (
        <div className="chart-tooltip" style={{ left: `${(tip.x / plot.width) * 100}%`, top: `${(tip.y / HEIGHT) * 100}%` }}>
          {tip.children}
        </div>
      ) : null}
    </div>
  );
}

export function LineChart({ label, data, labelKey, valueKey, formatLabel = String, color = 'var(--color-primary)' }) {
  const { hovered, hover } = useHover();
  const max = Math.max(1, ...data.map((item) => item[valueKey]));
  const plot = usePlot(data.length, max);

  const points = data.map((item, index) => ({ x: plot.center(index), y: BASELINE - plot.height(item[valueKey]), item }));
  const ends = points.length < 2 ? points : [points[0], points.at(-1)];
  const line = points.map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`).join(' ');
  const tip = points[hovered];

  return (
    <ChartFrame
      plot={plot}
      label={label}
      empty={data.length === 0}
      tip={
        tip && {
          x: tip.x,
          y: tip.y,
          children: (
            <>
              <div className="font-medium">{formatLabel(tip.item[labelKey])}</div>
              <div>{tip.item[valueKey]}</div>
            </>
          ),
        }
      }
    >
      <Axes plot={plot} top={max} labels={ends.map((point) => ({ at: point.x, text: formatLabel(point.item[labelKey]) }))} />
      {points.length ? (
        <>
          <path d={`${line} L ${points.at(-1).x} ${BASELINE} L ${points[0].x} ${BASELINE} Z`} fill={color} fillOpacity={0.08} />
          <path d={line} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />
        </>
      ) : null}
      {points.map((point, index) => (
        <circle key={index} cx={point.x} cy={point.y} r={hovered === index ? 5 : 3} fill={color} {...hover(index)} />
      ))}
    </ChartFrame>
  );
}

const LEGEND = [
  { color: 'var(--color-shift-past)', label: 'analytics.legalMax' },
  { color: 'var(--color-shift-published)', label: 'analytics.withinLimit' },
  { color: 'var(--color-destructive)', label: 'analytics.overtime' },
];

export function WorkerHoursChart({ label, data, maxHours, formatValue = String }) {
  const { hovered, hover, opacity } = useHover();
  const max = Math.max(1, maxHours, ...data.map((item) => item.hours));
  const plot = usePlot(data.length, max);

  const bars = data.map((item, index) => ({
    item,
    index,
    center: plot.center(index),
    overtime: item.hours > maxHours,
    allowed: plot.height(maxHours),
    worked: plot.height(item.hours),
  }));
  const tip = bars[hovered];

  return (
    <>
      <ChartFrame
        plot={plot}
        label={label}
        empty={data.length === 0}
        tip={
          tip && {
            x: tip.center,
            y: BASELINE - Math.max(tip.allowed, tip.worked),
            children: (
              <>
                <div className="font-medium">{tip.item.worker}</div>
                <div>
                  {formatValue(tip.item.hours)} / {formatValue(maxHours)}
                  {tip.overtime ? ` · ${t('analytics.overtime')}` : ''}
                </div>
              </>
            ),
          }
        }
      >
        <Axes plot={plot} top={formatValue(max)} labels={bars.map((bar) => ({ at: bar.center, text: truncate(bar.item.worker) }))} />

        {bars.map(({ index, center, overtime, allowed, worked }) => (
          <g key={index} opacity={opacity(index)} {...hover(index)}>
            <rect x={center - plot.barWidth / 2} y={BASELINE - allowed} width={plot.barWidth} height={allowed} rx={3} fill="var(--color-shift-past)" />
            <rect
              x={center - plot.barWidth / 2}
              y={BASELINE - worked}
              width={plot.barWidth}
              height={worked}
              rx={3}
              fill={overtime ? 'var(--color-destructive)' : 'var(--color-shift-published)'}
            />
          </g>
        ))}
      </ChartFrame>

      {data.length > 0 ? (
        <ul className="chart-legend chart-legend-row">
          {LEGEND.map(({ color, label: key }) => (
            <li key={key} className="chart-legend-item">
              <span className="chart-legend-swatch" style={{ backgroundColor: color }} aria-hidden="true" />
              {t(key)}
            </li>
          ))}
        </ul>
      ) : null}
    </>
  );
}
