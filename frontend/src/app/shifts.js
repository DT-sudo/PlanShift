export const statusOptions = () => [
  { id: 'draft', name: "Draft" },
  { id: 'published', name: "Published" },
];


export function positionPalette(positionId) {
  const hue = (positionId * 47) % 360;
  return {
    '--position-bg': `hsl(${hue} 80% 92%)`,
    '--position-border': `hsl(${hue} 70% 45%)`,
    '--position-fg': `hsl(${hue} 60% 20%)`,
  };
}

// ── Calendar layout ─────────────────────────────────────────────────────────

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

