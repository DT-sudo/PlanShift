import { t } from '../i18n/index.js';
import { minutesOf, shiftDurationMinutes } from './dates.js';

export const statusOptions = () => [
  { id: 'draft', name: t('status.draft') },
  { id: 'published', name: t('status.published') },
];

export const shiftTimes = (shift) => `${shift.start_time}-${shift.end_time}`;

export const shiftTimeClass = (shift) => (shift.is_past ? 'shift-chip-past' : 'shift-chip-future');

export function positionPalette(positionId) {
  const hue = (positionId * 47) % 360;
  return {
    '--position-bg': `hsl(${hue} 80% 92%)`,
    '--position-border': `hsl(${hue} 70% 45%)`,
    '--position-fg': `hsl(${hue} 60% 20%)`,
  };
}

export function availabilityFromPayload(payload) {
  return new Map(Object.entries(payload).map(([id, days]) => [id, new Set(days)]));
}

export function withDay(days, date, unavailable) {
  const next = new Set(days);
  if (unavailable) next.add(date);
  else next.delete(date);
  return next;
}

export function withAvailabilityChange(availability, { employeeId, date, unavailable }) {
  return new Map(availability).set(String(employeeId), withDay(availability.get(String(employeeId)), date, unavailable));
}

export function isUnavailable(availability, employeeId, date) {
  return availability.get(String(employeeId))?.has(date) ?? false;
}

export function groupShiftsByDate(shifts) {
  const byDate = new Map();
  for (const shift of shifts) {
    if (!byDate.has(shift.date)) byDate.set(shift.date, []);
    byDate.get(shift.date).push(shift);
  }
  for (const list of byDate.values()) {
    list.sort((a, b) => a.start_time.localeCompare(b.start_time) || a.end_time.localeCompare(b.end_time) || a.id - b.id);
  }
  return byDate;
}

export function computeLaneLayout(shifts) {
  const laneEnds = [];
  const laneById = new Map();
  for (const shift of shifts) {
    const start = minutesOf(shift.start_time);
    let lane = laneEnds.findIndex((end) => start >= end);
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = minutesOf(shift.end_time);
    laneById.set(shift.id, lane);
  }
  return { laneById, laneCount: Math.max(1, laneEnds.length) };
}

const LANE_GAP = '0.25rem';

export function timedChipStyle(shift, lane, laneCount, hourHeightPx) {
  const width = 100 / laneCount;
  return {
    top: `${(minutesOf(shift.start_time) / 60) * hourHeightPx}px`,
    height: `${Math.max(18, (shiftDurationMinutes(shift) / 60) * hourHeightPx)}px`,
    insetInlineStart: `calc(${lane * width}% + ${LANE_GAP})`,
    width: `calc(${width}% - 2 * ${LANE_GAP})`,
  };
}
