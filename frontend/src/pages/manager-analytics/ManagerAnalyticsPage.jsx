import { formatHours } from '../../app/dates.js';
import { getBootstrap } from '../../app/http.js';
import { statusOptions } from '../../app/shifts.js';
import { AppShell } from '../../components/AppShell.jsx';
import { DateRangeFields, ShiftFilterSelects } from '../../components/Field.jsx';
import { ChevronDown } from '../../components/Icons.jsx';
import { Dropdown } from '../../components/Menus.jsx';
import { DonutChart, EmptyChart, XYChart } from './Charts.jsx';

const KPIS = [
  { key: 'shifts', label: 'analytics.shifts', accent: 'var(--color-primary)' },
  { key: 'workers', label: 'analytics.workers', accent: 'var(--color-info)' },
  { key: 'hours', label: 'analytics.hours', accent: 'var(--color-shift-published)', format: formatHours },
  { key: 'open_shifts', label: 'analytics.openShifts', accent: 'var(--color-warning)' },
];

const STATUS_COLORS = { draft: 'var(--color-shift-past)', published: 'var(--color-shift-published)' };

const shiftCount = (count) => (count === 1 ? `${count} shift` : `${count} shifts`);

const nameOf = (options, id) => options.find((option) => String(option.id) === id)?.name ?? "All";

function ChartCard({ title, wide = false, children }) {
  return (
    <section className={`card chart-card ${wide ? 'chart-card-wide' : ''}`}>
      <h2 className="chart-card-title">{title}</h2>
      {children}
    </section>
  );
}

function TopList({ items, name, detail }) {
  if (!items.length) return <EmptyChart />;
  return (
    <ol className="flex flex-col gap-1.5">
      {items.map((item, index) => (
        <li key={index} className="flex items-center justify-between gap-2 text-sm">
          <span className="truncate">
            <span className="me-1.5 text-muted-foreground">{index + 1}.</span>
            {item[name]}
          </span>
          <span className="badge badge-default shrink-0">{detail(item)}</span>
        </li>
      ))}
    </ol>
  );
}

export function ManagerAnalyticsPage() {
  const { positions, workers, filters, urls, analytics } = useLivePageData(getBootstrap().data);

  const topPositions = [...analytics.by_position].sort((a, b) => b.count - a.count).slice(0, 5);
  const statuses = statusOptions();

  return (
    <AppShell>
      <main className="p-4 pt-0">
        <form className="card page-toolbar-card filter-bar no-print" method="get">
          <DateRangeFields from={filters.date_from} to={filters.date_to} />
          <ShiftFilterSelects filters={filters} positions={positions} workers={workers} />
          <button className="btn btn-primary" type="submit">
            Apply
          </button>

          <div className="ms-auto">
            <Dropdown
              trigger={({ toggle }) => (
                <button className="btn btn-outline" type="button" onClick={toggle} aria-haspopup="menu">
                  Export
                  <ChevronDown />
                </button>
              )}
            >
              {/* The CSV is an attachment, so the page stays; the browser's print dialog saves the PDF. */}
              <button className="dropdown-item" type="button" onClick={() => window.location.assign(`${urls.exportCsv}${window.location.search}`)}>
                CSV (raw data)
              </button>
              <button className="dropdown-item" type="button" onClick={() => window.print()}>
                PDF (report)
              </button>
            </Dropdown>
          </div>
        </form>

        <div className="print-only mb-4">
          <h1 className="text-xl font-semibold">Workforce Analytics Report</h1>
          <p className="text-sm text-muted-foreground">
            {`${formatDate(filters.date_from)} – ${formatDate(filters.date_to)} · Position: ${nameOf(positions, filters.position)} · Worker: ${nameOf(workers, filters.worker)} · Status: ${nameOf(statuses, filters.status)}`}
          </p>
          <p className="text-xs text-muted-foreground">{`Generated ${formatNow()}`}</p>
        </div>

        <div className="kpi-grid mt-3">
          {KPIS.map((kpi) => (
            <div key={kpi.key} className="kpi-card" style={{ '--kpi-accent': kpi.accent }}>
              <div className="kpi-card-label">{t(kpi.label)}</div>
              <div className="kpi-card-value">{kpi.format ? kpi.format(analytics.kpis[kpi.key]) : analytics.kpis[kpi.key]}</div>
            </div>
          ))}
        </div>

        <div className="analytics-grid mt-3">
          <ChartCard title="Shifts over time" wide>
            <XYChart
              kind="line"
              label="Shifts over time"
              data={analytics.by_date}
              labelKey="date"
              valueKey="count"
              formatLabel={(iso) => formatDate(iso, { year: false })}
            />
          </ChartCard>

          <ChartCard title="Shifts by position">
            <XYChart kind="bar" label="Shifts by position" data={analytics.by_position} labelKey="position" valueKey="count" />
          </ChartCard>

          <ChartCard title="Shift status">
            <DonutChart
              label="Shift status"
              segments={analytics.by_status.map(({ status, count }) => ({
                label: nameOf(statuses, status),
                value: count,
                color: STATUS_COLORS[status],
              }))}
            />
          </ChartCard>

          <ChartCard title="Hours per worker" wide>
            <XYChart
              kind="bar"
              label="Hours per worker"
              data={analytics.top_workers}
              labelKey="worker"
              valueKey="hours"
              formatValue={formatHours}
              color="var(--color-shift-published)"
            />
          </ChartCard>

          <ChartCard title="Top workers">
            <TopList items={analytics.top_workers.slice(0, 5)} name="worker" detail={(w) => `${formatHours(w.hours)} · ${shiftCount(w.shifts)}`} />
          </ChartCard>

          <ChartCard title="Top positions">
            <TopList items={topPositions} name="position" detail={(p) => shiftCount(p.count)} />
          </ChartCard>
        </div>
      </main>
    </AppShell>
  );
}
