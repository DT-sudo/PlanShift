import { useRef, useState } from 'react';

import { isUnavailable } from '../../app/shifts.js';
import { DateField, Field, PostForm, SelectField } from '../../components/Field.jsx';
import { FormFooter, Modal } from '../../components/Modal.jsx';
import { intlLocale, t } from '../../i18n/index.js';

const timeInput = ({ end = false } = {}) => ({
  type: 'text',
  dir: 'ltr',
  inputMode: 'numeric',
  pattern: end ? '([01][0-9]|2[0-3]):[0-5][0-9]|24:00' : '([01][0-9]|2[0-3]):[0-5][0-9]',
  placeholder: 'HH:MM',
  maxLength: 5,
  title: end ? t('shifts.endTimeFormat') : t('shifts.timeFormat'),
  autoComplete: 'off',
});

function controlFor(form, field, employeeId) {
  let control = null;
  if (employeeId) control = form.querySelector(`input[name="employee_ids"][value="${employeeId}"]`);
  else if (field === 'date') control = form.querySelector('#shiftDate');
  else if (field) control = form.elements[field];
  return control || document.querySelector(`[type="submit"][form="${form.id}"]`);
}

export function ShiftFormModal({ shift, action, positions, employees, availability, stale, editors, onClose }) {
  const isEdit = Boolean(shift.id);
  const [date, setDate] = useState(shift.date);
  const [positionId, setPositionId] = useState(String(shift.position_id));
  const staff = employees.filter((employee) => String(employee.position_id) === positionId);

  return (
    <Modal
      title={isEdit ? t('shifts.editTitle') : t('shifts.createTitle')}
      onClose={onClose}
      maxWidth="720px"
      footer={
        <>
          <button className="btn btn-outline" type="button" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button className="btn btn-primary" type="submit" form="shiftForm">
            {isEdit ? t('common.save') : t('shifts.create')}
          </button>
        </>
      }
    >
      <form id="shiftForm" className="modal-body" method="post" action={action}>
        <CsrfInput />
        {isEdit ? <input type="hidden" name="version" value={shift.version} readOnly /> : null}

        {stale ? (
          <p className="mb-3 text-sm text-destructive" role="alert">
            {t('shifts.stale')}
          </p>
        ) : editors.length ? (
          <p className="mb-3 text-sm text-muted-foreground" role="status">
            {t('shifts.alsoEditing', { names: editors.join(', '), count: editors.length })}
          </p>
        ) : null}

        <div className="grid grid-cols-2 gap-x-4">
          <Field id="shiftDate" name="date" type="date" label={t('shifts.date')} required value={date} onChange={(event) => setDate(event.target.value)} />
          <Field id="shiftCapacity" name="capacity" type="number" min="1" label={t('shifts.capacity')} required defaultValue={shift.capacity} />
          <Field id="shiftStart" name="start_time" label={t('shifts.startTime')} required defaultValue={shift.start_time} {...timeInput()} />
          <Field id="shiftEnd" name="end_time" label={t('shifts.endTime')} required defaultValue={shift.end_time} {...timeInput()} />
        </div>

        <SelectField
          id="shiftPosition"
          name="position"
          label={t('shifts.position')}
          placeholder={t('shifts.selectPosition')}
          required
          options={positions}
          value={positionId}
          onChange={(event) => setPositionId(event.target.value)}
        />

        <fieldset>
          <legend className="form-label">{t('shifts.assignEmployees')}</legend>
          {staff.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {positionId ? t('shifts.noStaff') : t('shifts.selectPositionFirst')}
            </p>
          ) : (
            <div className="max-h-56 overflow-y-auto rounded-card border border-border p-1">
              {staff.map((employee) => {
                const assigned = shift.assigned_employee_ids.includes(employee.id);
                const unavailable = isUnavailable(availability, employee.id, date);
                return (
                  <label className="multiselect-item" key={employee.id}>
                    <input type="checkbox" name="employee_ids" value={employee.id} defaultChecked={assigned} disabled={unavailable && !assigned} />
                    <span className="min-w-0 flex-auto truncate">{employee.name}</span>
                    {unavailable ? <span className="availability-flag">{t('shifts.unavailable')}</span> : null}
                  </label>
                );
              })}
            </div>
          )}
        </fieldset>
      </form>
    </Modal>
  );
}
