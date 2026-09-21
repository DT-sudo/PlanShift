import { useRef, useState } from 'react';

import { endMinutesOf, minutesOf, todayISO } from '../../app/dates.js';
import { postForm } from '../../app/http.js';
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

export function ShiftFormModal({ shift, action, positions, employees, availability, editors, onClose }) {
  const isEdit = Boolean(shift.id);
  const [date, setDate] = useState(shift.date);
  const [positionId, setPositionId] = useState(String(shift.position_id ?? ''));
  const staff = employees
    .filter((employee) => String(employee.position_id) === positionId)
    .sort((a, b) => a.name.localeCompare(b.name, intlLocale()));

  const flagged = useRef(null);
  const flag = (control, message) => {
    control.setCustomValidity(message);
    control.reportValidity();
    flagged.current = control;
  };
  const unflag = () => {
    flagged.current?.setCustomValidity('');
    flagged.current = null;
  };

  const submit = async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const { start_time: start, end_time: end } = form.elements;
    if (endMinutesOf(end.value) <= minutesOf(start.value)) {
      flag(end, t('shifts.endAfterStart'));
      return;
    }
    if (date && new Date(`${date}T${start.value}`) <= new Date()) {
      flag(date < todayISO() ? form.querySelector('#shiftDate') : start, t('shifts.inPast'));
      return;
    }
    try {
      const { redirect } = await postForm(action, new FormData(form));
      window.location.assign(redirect);
    } catch (error) {
      const { field, employee } = error.payload ?? {};
      flag(controlFor(form, field, employee), requestError(error));
    }
  };

  return (
    <Modal
      title={isEdit ? t('shifts.editTitle') : t('shifts.create')}
      onClose={onClose}
      maxWidth="45rem"
      footer={<FormFooter form="shiftForm" submitLabel={isEdit ? t('common.save') : t('shifts.create')} onCancel={onClose} />}
    >
      <PostForm
        id="shiftForm"
        className="modal-body"
        action={action}
        fields={isEdit ? { version: shift.version } : {}}
        onSubmit={submit}
        onInput={unflag}
        onChange={unflag}
      >
        {editors.length ? (
          <p className="mb-3 text-sm text-muted-foreground" role="status">
            {t('shifts.alsoEditing', { names: editors.join(', '), count: editors.length })}
          </p>
        ) : null}

        <div className="grid grid-cols-2 gap-x-4">
          <DateField id="shiftDate" name="date" label={t('shifts.date')} required defaultValue={shift.date} onChange={setDate} />
          <Field id="shiftCapacity" name="capacity" type="number" min="1" label={t('shifts.capacity')} required defaultValue={shift.capacity} />
          <Field id="shiftStart" name="start_time" label={t('shifts.startTime')} required defaultValue={shift.start_time} {...timeInput()} />
          <Field id="shiftEnd" name="end_time" label={t('shifts.endTime')} required defaultValue={shift.end_time} {...timeInput({ end: true })} />
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
      </PostForm>
    </Modal>
  );
}
