import { useRef, useState } from 'react';

import { formatDayMonthYear, formatMonthYear, parseDayMonthYear, parseMonthYear } from '../app/dates.js';
import { getBootstrap } from '../app/http.js';
import { statusOptions } from '../app/shifts.js';
import { t } from '../i18n/index.js';
import { CalendarIcon } from './Icons.jsx';

export function PostForm({ fields = {}, children, ...formProps }) {
  return (
    <form method="post" {...formProps}>
      <input type="hidden" name="csrfmiddlewaretoken" value={getBootstrap().csrfToken} readOnly />
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} readOnly />
      ))}
      {children}
    </form>
  );
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
      <ErrorText id={`${id}-error`} message={error} />
    </div>
  );
}

export function ErrorText({ id, message }) {
  if (!message) return null;
  return (
    <p id={id} className="form-error-text" role="alert">
      {message}
    </p>
  );
}

export function FullNameField(props) {
  return <Field name="full_name" label={t('signup.fullName')} autoComplete="name" required minLength={2} maxLength={150} {...props} />;
}

export function EmailField(props) {
  return <Field name="email" type="email" dir="ltr" label={t('login.email')} autoComplete="email" required {...props} />;
}

export function PasswordChangeFields({ errors, currentLabel = t('settings.currentPassword') }) {
  return (
    <>
      <Field
        id="oldPassword"
        name="old_password"
        type="password"
        label={currentLabel}
        autoComplete="current-password"
        required
        error={errors.old_password}
      />
      <Field
        id="newPassword1"
        name="new_password1"
        type="password"
        label={t('settings.newPassword')}
        autoComplete="new-password"
        hint={t('signup.passwordHint')}
        required
        minLength={8}
        error={errors.new_password1}
      />
      <Field
        id="newPassword2"
        name="new_password2"
        type="password"
        label={t('settings.confirmNewPassword')}
        autoComplete="new-password"
        required
        minLength={8}
        error={errors.new_password2}
      />
    </>
  );
}

const TYPED = {
  date: { picker: 'date', length: 10, format: formatDayMonthYear, parse: parseDayMonthYear, words: 'dates' },
  month: { picker: 'month', length: 7, format: formatMonthYear, parse: parseMonthYear, words: 'months' },
};

function TypedDateInput({ kind, id, name, defaultValue = '', onChange, required = false, className = '' }) {
  const { picker: pickerType, length, format, parse, words } = TYPED[kind];
  const [iso, setIso] = useState(defaultValue);
  const [text, setText] = useState(() => format(defaultValue));
  const textInput = useRef(null);
  const picker = useRef(null);

  const commit = (nextText, nextIso) => {
    setText(nextText);
    setIso(nextIso);
    textInput.current.setCustomValidity(nextText && !nextIso ? t(`${words}.format`) : '');
    onChange?.(nextIso);
  };

  const openPicker = () => {
    try {
      picker.current.showPicker();
    } catch {
      textInput.current.focus();
    }
  };

  return (
    <div className={`date-input ${className}`}>
      <input
        ref={textInput}
        id={id}
        className="form-input"
        type="text"
        dir="ltr"
        inputMode="numeric"
        placeholder={t(`${words}.placeholder`)}
        title={t(`${words}.format`)}
        maxLength={length}
        autoComplete="off"
        required={required}
        value={text}
        onChange={(event) => commit(event.target.value, parse(event.target.value))}
      />
      <button className="date-input-button" type="button" aria-label={t(`${words}.pick`)} onClick={openPicker}>
        <CalendarIcon />
      </button>
      <input
        ref={picker}
        className="date-input-picker"
        type={pickerType}
        tabIndex={-1}
        aria-hidden="true"
        value={iso}
        onChange={(event) => commit(format(event.target.value), event.target.value)}
      />
      <input type="hidden" name={name} value={iso} />
    </div>
  );
}

const DateInput = (props) => <TypedDateInput kind="date" {...props} />;
const MonthInput = (props) => <TypedDateInput kind="month" {...props} />;

export function DateField({ id, label, required = false, ...inputProps }) {
  return (
    <div className="mb-4">
      <Label id={id} label={label} required={required} />
      <DateInput id={id} required={required} {...inputProps} />
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
        <Options emptyLabel={t('common.all')} options={options} />
      </select>
    </div>
  );
}

export function ShiftFilterSelects({ filters, positions, workers, withStatus = false }) {
  return (
    <>
      <FilterSelect id="positionFilter" name="position" label={t('filters.position')} options={positions} defaultValue={filters.position} onChange={submitForm} />
      <FilterSelect id="workerFilter" name="worker" label={t('filters.worker')} options={workers} defaultValue={filters.worker} onChange={submitForm} />
      {withStatus ? (
        <FilterSelect id="statusFilter" name="status" label={t('filters.status')} options={statusOptions()} defaultValue={filters.status} onChange={submitForm} />
      ) : null}
    </>
  );
}

export function DateRangeFields({ from, to }) {
  return <RangeFields Input={DateInput} from={from} to={to} width="w-36" />;
}

export function MonthRangeFields({ from, to }) {
  return <RangeFields Input={MonthInput} from={from} to={to} width="w-28" />;
}

function RangeFields({ Input, from, to, width }) {
  return (
    <div className="flex items-center gap-2">
      <label className="form-label mb-0" htmlFor="dateFrom">
        {t('filters.from')}
      </label>
      <Input id="dateFrom" name="date_from" className={width} defaultValue={from} />
      <label className="form-label mb-0" htmlFor="dateTo">
        {t('filters.to')}
      </label>
      <Input id="dateTo" name="date_to" className={width} defaultValue={to} />
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
