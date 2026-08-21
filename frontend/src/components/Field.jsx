import { getBootstrap } from '../app/http.js';
import { statusOptions } from '../app/shifts.js';

export function CsrfInput() {
  return <input type="hidden" name="csrfmiddlewaretoken" value={getBootstrap().csrfToken} readOnly />;
}

function Label({ id, label, required }) {
  return (
    <label className="form-label" htmlFor={id}>
      {label}
      {required ? <span aria-hidden="true"> *</span> : null}
    </label>
  );
}

export function Field({ id, label, error, hint, required = false, as: Control = 'input', ...inputProps }) {
  const describedBy = [error ? `${id}-error` : null, hint ? `${id}-hint` : null].filter(Boolean).join(' ');

  return (
    <div className="mb-4">
      <Label id={id} label={label} required={required} />
      <Control
        id={id}
        className={`form-input ${error ? 'form-error' : ''}`}
        required={required}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={describedBy || undefined}
        {...inputProps}
      />
      {hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="form-error-text" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

const submitForm = (event) => event.target.form.requestSubmit();

function Options({ emptyLabel, options }) {
  return (
    <>
      <option value="">{emptyLabel}</option>
      {options.map((option) => (
        <option key={option.id} value={option.id}>
          {option.name}
        </option>
      ))}
    </>
  );
}

export function FilterSelect({ id, label, options, ...selectProps }) {
  return (
    <div className="flex items-center gap-2">
      <label className="form-label mb-0" htmlFor={id}>
        {label}
      </label>
      <select id={id} className="form-select w-auto" {...selectProps}>
        <Options emptyLabel="All" options={options} />
      </select>
    </div>
  );
}

export function ShiftFilterSelects({ filters, positions, workers }) {
  return (
    <>
      <FilterSelect id="positionFilter" name="position" label="Position:" options={positions} defaultValue={filters.position} onChange={submitForm} />
      <FilterSelect id="workerFilter" name="worker" label="Worker:" options={workers} defaultValue={filters.worker} onChange={submitForm} />
      <FilterSelect id="statusFilter" name="status" label="Status:" options={statusOptions()} defaultValue={filters.status} onChange={submitForm} />
    </>
  );
}

export function DateRangeFields({ from, to }) {
  return (
    <div className="flex items-center gap-2">
      <label className="form-label mb-0" htmlFor="dateFrom">
        From
      </label>
      <input id="dateFrom" name="date_from" type="date" className="form-input w-auto" defaultValue={from} />
      <label className="form-label mb-0" htmlFor="dateTo">
        to
      </label>
      <input id="dateTo" name="date_to" type="date" className="form-input w-auto" defaultValue={to} />
    </div>
  );
}

export function SelectField({ id, label, placeholder, options, required = false, ...selectProps }) {
  return (
    <div className="mb-4">
      <Label id={id} label={label} required={required} />
      <select id={id} className="form-select" required={required} {...selectProps}>
        <Options emptyLabel={placeholder} options={options} />
      </select>
    </div>
  );
}
