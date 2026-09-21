import { useState } from 'react';

import { urlFromTemplate } from '../../app/http.js';
import { EmailField, FullNameField, PostForm, SelectField } from '../../components/Field.jsx';
import { Trash } from '../../components/Icons.jsx';
import { FormFooter, Modal } from '../../components/Modal.jsx';
import { t, tx } from '../../i18n/index.js';

export function UserFormModal({ employee, action, roles, positions, onClose }) {
  const isEdit = Boolean(employee.id);

  return (
    <Modal
      title={isEdit ? t('team.editUser') : t('team.newUser')}
      onClose={onClose}
      footer={<FormFooter form="employeeForm" submitLabel={isEdit ? t('common.save') : t('team.createUser')} onCancel={onClose} />}
    >
      <PostForm id="employeeForm" className="modal-body" action={action}>

        <FullNameField id="employeeFullName" label={t('signup.fullName')} placeholder={t('team.fullNamePlaceholder')} autoComplete="off" defaultValue={employee.fullName} />
        <EmailField id="employeeEmail" label={t('team.emailLogin')} placeholder={t('team.emailPlaceholder')} autoComplete="off" defaultValue={employee.email} />
        <RoleAndPositionFields
          idPrefix="employee"
          roles={roles}
          positions={positions}
          initialRole={employee.role}
          positionId={employee.positionId}
        />

        {isEdit ? null : (
          <p className="text-sm text-muted-foreground">
            {tx('team.passwordNote', { once: <strong>{t('team.onlyOnce')}</strong> })}
          </p>
        )}
      </PostForm>
    </Modal>
  );
}

export function RoleAndPositionFields({ idPrefix, roles, positions, initialRole = 'employee', positionId = '' }) {
  const [role, setRole] = useState(initialRole);

  return (
    <>
      <SelectField
        id={`${idPrefix}Role`}
        name="role"
        label={t('team.role')}
        placeholder={t('team.selectRole')}
        required
        options={roles}
        value={role}
        onChange={(event) => setRole(event.target.value)}
      />
      {role === 'employee' ? (
        <SelectField
          id={`${idPrefix}Position`}
          name="position"
          label={t('shifts.position')}
          placeholder={t('shifts.selectPosition')}
          required
          options={positions}
          defaultValue={positionId ?? ''}
        />
      ) : null}
    </>
  );
}

export function CredentialsModal({ credentials, onClose }) {
  return (
    <Modal
      title={t('team.credentialsTitle')}
      onClose={onClose}
      closeLabel={t('common.done')}
    >
      <div className="modal-body">
        <p className="text-sm text-muted-foreground">{t('team.login')}</p>
        <p dir="ltr" className="font-medium break-all">
          {credentials.login}
        </p>
        <p className="mt-3 text-sm text-muted-foreground">{t('login.password')}</p>
        <p dir="ltr" className="font-medium break-all">
          {credentials.password}
        </p>
        <p className="mt-4 text-sm text-muted-foreground">{t('team.credentialsNote')}</p>
      </div>
    </Modal>
  );
}

export function PositionsModal({ positions, urls, onClose }) {
  const [pendingDelete, setPendingDelete] = useState(null);

  return (
    <>
      <Modal
        title={t('team.managePositions')}
        onClose={onClose}
        maxWidth="45rem"
        closeLabel={t('common.done')}
      >
        <div className="modal-body">
          <PostForm className="flex gap-2" action={urls.positionCreate}>
            <input className="form-input" name="name" placeholder={t('team.newPosition')} aria-label={t('team.newPosition')} maxLength={25} required />
            <button className="btn btn-primary btn-sm" type="submit">
              {t('team.addPosition')}
            </button>
          </PostForm>

          <table className="table mt-4" aria-label={t('team.positionList')}>
            <thead>
              <tr>
                <th>{t('shifts.position')}</th>
                <th className="w-45 cell-actions">{t('team.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {positions.length === 0 ? (
                <tr>
                  <td colSpan={2} className="text-sm text-muted-foreground">
                    {t('team.noPositions')}
                  </td>
                </tr>
              ) : (
                positions.map((position) => (
                  <tr key={position.id}>
                    <td>{position.name}</td>
                    <td className="cell-actions">
                      <button
                        className="btn btn-ghost btn-icon btn-icon-destructive ms-1"
                        type="button"
                        aria-label={t('team.deletePositionLabel', { name: position.name })}
                        title={t('common.delete')}
                        onClick={() => setPendingDelete(position)}
                      >
                        <Trash />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Modal>

      {pendingDelete ? (
        <DeleteConfirmModal
          title={t('team.deletePosition')}
          message={t('team.deletePositionMessage')}
          detail={pendingDelete.name}
          footnote={t('team.deletePositionNote')}
          action={urlFromTemplate(urls.positionDelete, pendingDelete.id)}
          onCancel={() => setPendingDelete(null)}
        />
      ) : null}
    </>
  );
}
