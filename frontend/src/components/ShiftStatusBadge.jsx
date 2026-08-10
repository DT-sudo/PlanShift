import { statusOptions } from '../app/shifts.js';

export function ShiftStatusBadge({ status }) {
  const label = statusOptions().find((option) => option.id === status)?.name ?? status;
  return <span className={`badge ${status === 'draft' ? 'badge-outline' : 'badge-success'}`}>{label}</span>;
}
