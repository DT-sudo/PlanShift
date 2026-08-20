import { navigateWith } from '../../app/dates.js';
import { getBootstrap } from '../../app/http.js';
import { AppShell } from '../../components/AppShell.jsx';
import { DateRangeFields, ShiftFilterSelects } from '../../components/Field.jsx';
import { ChevronLeft, ChevronRight } from '../../components/Icons.jsx';
import { ShiftStatusBadge } from '../../components/ShiftStatusBadge.jsx';

const COLUMNS = [
  { id: 'date', sort: 'date' },
  { id: 'time', sort: 'time' },
  { id: 'position', sort: 'position' },
  { id: 'workers', sort: 'worker' },
  { id: 'status' },
  { id: 'staffed' },
];

function SearchFilters({ filters, positions, workers }) {
  return (
    <form className="card page-toolbar-card filter-bar" method="get">
      <input
        type="search"
        name="q"
        className="form-input w-auto min-w-64 flex-auto"
        placeholder="Search by position or worker…"
        aria-label="Search shifts"
        defaultValue={filters.q}
      />
      <ShiftFilterSelects filters={filters} positions={positions} workers={workers} />
      <DateRangeFields from={filters.date_from} to={filters.date_to} />
      <input type="hidden" name="sort" defaultValue={filters.sort} />
      <input type="hidden" name="dir" defaultValue={filters.dir} />
      <button className="btn btn-primary" type="submit">
        Search
      </button>
      <a className="btn btn-ghost" href={window.location.pathname}>
        Clear
      </a>
    </form>
  );
}

function SortHeader({ column, filters }) {
  const label = t(`search.${column.id}`);
  if (!column.sort) return <th>{label}</th>;
  const active = filters.sort === column.sort;
  const ascending = filters.dir === 'asc';

  return (
    <th aria-sort={active ? (ascending ? 'ascending' : 'descending') : undefined}>
      <button
        className="sort-button"
        type="button"
        onClick={() => navigateWith({ sort: column.sort, dir: active && ascending ? 'desc' : 'asc', page: '' })}
      >
        {label}
        {active ? <span aria-hidden="true">{ascending ? '▲' : '▼'}</span> : null}
      </button>
    </th>
  );
}

function Pagination({ page, totalPages, total }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2 text-sm text-muted-foreground">
      <span>{(total === 1 ? `${total} result` : `${total} results`)}</span>
      <div className="flex items-center gap-2">
        <button
          className="btn btn-outline btn-icon"
          type="button"
          aria-label="Previous page"
          disabled={page <= 1}
          onClick={() => navigateWith({ page: page - 1 })}
        >
          <ChevronLeft className="rtl:-scale-x-100" />
        </button>
        <span>{`Page ${page} of ${totalPages}`}</span>
        <button
          className="btn btn-outline btn-icon"
          type="button"
          aria-label="Next page"
          disabled={page >= totalPages}
          onClick={() => navigateWith({ page: page + 1 })}
        >
          <ChevronRight className="rtl:-scale-x-100" />
        </button>
      </div>
    </div>
  );
}

export function ManagerShiftSearchPage() {
  const { data } = getBootstrap();
  const { results, filters, urls } = data;

  return (
    <AppShell>
      <main className="p-4 pt-0">
        <SearchFilters filters={filters} positions={data.positions} workers={data.workers} />

        <div className="card mt-3">
          <Pagination page={data.page} totalPages={data.totalPages} total={data.total} />
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  {COLUMNS.map((column) => (
                    <SortHeader key={column.id} column={column} filters={filters} />
                  ))}
                </tr>
              </thead>
              <tbody>
                {results.length === 0 ? (
                  <tr>
                    <td colSpan={COLUMNS.length} className="py-8 text-center text-muted-foreground">
                      No shifts match these filters.
                    </td>
                  </tr>
                ) : (
                  results.map((shift) => (
                    <tr key={shift.id}>
                      <td>
                        <a className="font-medium text-primary hover:underline" href={`${urls.calendar}?date=${shift.date}`} title="Open in calendar">
                          {formatDate(shift.date)}
                        </a>
                      </td>
                      <td>
                        {shift.start_time}-{shift.end_time}
                      </td>
                      <td>
                        <span className="badge badge-default">{shift.position}</span>
                      </td>
                      <td>
                        {shift.workers.map((worker) => worker.name).join(', ') || <span className="text-muted-foreground">Unassigned</span>}
                      </td>
                      <td>
                        <ShiftStatusBadge status={shift.status} />
                      </td>
                      <td>
                        {shift.workers.length}/{shift.capacity}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </AppShell>
  );
}
