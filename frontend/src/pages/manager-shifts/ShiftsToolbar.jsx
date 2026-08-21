import { navigateWith } from '../../app/dates.js';
import { statusOptions } from '../../app/shifts.js';
import { CalendarNav } from '../../components/Calendar.jsx';
import { CsrfInput, FilterSelect } from '../../components/Field.jsx';
import { Plus } from '../../components/Icons.jsx';

const filterBy = (param) => (event) => navigateWith({ [param]: event.target.value });

export function ShiftsToolbar({ data, onCreateShift }) {
  const { view, anchor, start, end, today, positions, filters, urls } = data;
  const views = [
    { id: 'week', name: "Week" },
    { id: 'month', name: "Month" },
  ];

  return (
    <div className="card page-toolbar-card">
      <div className="shifts-toolbar">
        <div className="shifts-toolbar-left flex min-w-0 flex-wrap items-center gap-3 justify-self-start">
          <FilterSelect id="positionFilter" label="Position:" options={positions} value={filters.position} onChange={filterBy('position')} />
          <FilterSelect id="statusFilter" label="Status:" options={statusOptions()} value={filters.status} onChange={filterBy('status')} />
          <FilterSelect
            id="showFilter"
            label="Show:"
            options={[{ id: 'understaffed', name: "Understaffed" }]}
            value={filters.understaffed ? 'understaffed' : ''}
            onChange={filterBy('show')}
          />
        </div>

        <div className="shifts-toolbar-center min-w-0 justify-self-center">
          <div className="calendar-period">
            {view === 'week' ? `${formatDate(start, { year: false })} – ${formatDate(end)}` : formatMonth(anchor)}
          </div>
        </div>

        <div className="shifts-toolbar-right flex min-w-0 flex-wrap items-center justify-end gap-3 justify-self-end">
          <div className="flex gap-1" role="group" aria-label="Calendar view">
            {views.map((option) => (
              <button
                key={option.id}
                className={`btn btn-sm ${view === option.id ? 'btn-primary' : 'btn-outline'}`}
                type="button"
                aria-pressed={view === option.id}
                onClick={() => navigateWith({ view: option.id, date: anchor })}
              >
                {option.name}
              </button>
            ))}
          </div>

          <CalendarNav anchorISO={anchor} todayISO={today} view={view} />

          <button className="btn btn-primary" type="button" onClick={onCreateShift}>
            <Plus size={16} />
            Add
          </button>

          <form method="post" action={urls.publishAll} className="flex">
            <CsrfInput />
            <input type="hidden" name="view" value={view} readOnly />
            <input type="hidden" name="date" value={anchor} readOnly />
            <button className="btn btn-outline" type="submit">
              Publish all
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
