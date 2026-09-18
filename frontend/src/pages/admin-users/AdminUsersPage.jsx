import { useState } from 'react';

import { getBootstrap, submitPost, urlFromTemplate } from '../../app/http.js';
import { DIRECTORY_CHANGED, useLivePageData } from '../../app/live.js';
import { AppShell } from '../../components/AppShell.jsx';
import { Avatar } from '../../components/Avatar.jsx';
import { ListTable } from '../../components/ListTable.jsx';
import { Plus } from '../../components/Icons.jsx';
import { ConfirmModal } from '../../components/Modal.jsx';
import { t } from '../../i18n/index.js';
import { CredentialsModal, UserFormModal, PositionsModal } from './UserModals.jsx';

const accountLabel = (employee) => `${employee.employeeId} (${employee.email})`;

function UserRow({ employee, onEdit, onResetPassword, onResetTwoFactor, onDelete }) {
  return (
    <tr>
      <td>
        <Avatar name={employee.fullName} src={employee.avatarUrl} />
      </td>
      <td className="text-sm whitespace-nowrap">{employee.employeeId}</td>
      <td>
        <a className="person-name" href={employee.profileUrl}>
          {employee.fullName}
        </a>
        {employee.twoFactor ? (
          <span className="badge badge-success ms-2" title={t('team.twoFactorOn')}>
            2FA
          </span>
        ) : null}
      </td>
      <td>
        <span className="badge badge-outline">{employee.roleLabel}</span>
      </td>
      <td>{employee.position ? <span className="badge badge-default">{employee.position}</span> : null}</td>
      <td className="text-sm" dir="ltr">
        {employee.email}
      </td>
      <td className="cell-actions">
        <button className="btn btn-ghost btn-sm" type="button" onClick={() => onEdit(employee)}>
          {t('common.edit')}
        </button>
        <button className="btn btn-ghost btn-sm" type="button" onClick={() => onResetPassword(employee)}>
          {t('team.resetPassword')}
        </button>
        {employee.twoFactor ? (
          <button className="btn btn-ghost btn-sm" type="button" onClick={() => onResetTwoFactor(employee)}>
            {t('team.resetTwoFactor')}
          </button>
        ) : null}
        <button className="btn btn-ghost btn-sm btn-icon-destructive" type="button" onClick={() => onDelete(employee)}>
          {t('common.delete')}
        </button>
      </td>
    </tr>
  );
}

export function AdminUsersPage() {
  const [credentials] = useState(() => getBootstrap().data.credentials);
  const { employees, roles, positions, urls } = useLivePageData([DIRECTORY_CHANGED]);

  const [employeeForm, setEmployeeForm] = useState(null);
  const [showPositions, setShowPositions] = useState(false);
  const [showCredentials, setShowCredentials] = useState(Boolean(credentials));
  const [pendingReset, setPendingReset] = useState(null);
  const [pendingTwoFactorReset, setPendingTwoFactorReset] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);

  return (
    <AppShell>
      <main className="p-4 pt-0">
        <div className="card page-toolbar-card">
          <div className="flex flex-wrap items-center gap-4">
            <button
              className="btn btn-primary"
              type="button"
              onClick={() => setEmployeeForm({ employee: {}, action: urls.create })}
            >
              <Plus size={16} />
              {t('team.addUser')}
            </button>
            <button className="btn btn-outline" type="button" onClick={() => setShowPositions(true)}>
              {t('team.managePositions')}
            </button>
          </div>
        </div>

        <ListTable
          label={t('team.userList')}
          columns={[t('team.avatar'), t('team.employeeId'), t('signup.fullName'), t('team.role'), t('shifts.position'), t('login.email')]}
          empty={t('team.empty')}
        >
          {employees.map((employee) => (
            <UserRow
              key={employee.id}
              employee={employee}
              onEdit={(target) => setEmployeeForm({ employee: target, action: urlFromTemplate(urls.update, target.id) })}
              onResetPassword={setPendingReset}
              onResetTwoFactor={setPendingTwoFactorReset}
              onDelete={setPendingDelete}
            />
          ))}
        </ListTable>
      </main>

      {employeeForm ? (
        <UserFormModal
          employee={employeeForm.employee}
          action={employeeForm.action}
          roles={roles}
          positions={positions}
          onClose={() => setEmployeeForm(null)}
        />
      ) : null}

      {showPositions ? (
        <PositionsModal positions={positions} urls={urls} onClose={() => setShowPositions(false)} />
      ) : null}

      {showCredentials && credentials ? (
        <CredentialsModal credentials={credentials} onClose={() => setShowCredentials(false)} />
      ) : null}

      {pendingReset ? (
        <ConfirmModal
          title={t('team.resetPassword')}
          message={t('team.resetPasswordMessage')}
          detail={accountLabel(pendingReset)}
          onCancel={() => setPendingReset(null)}
          onConfirm={() => submitPost(urlFromTemplate(urls.resetPassword, pendingReset.id))}
        />
      ) : null}

      {pendingTwoFactorReset ? (
        <ConfirmModal
          title={t('team.resetTwoFactorTitle')}
          message={t('team.resetTwoFactorMessage')}
          detail={accountLabel(pendingTwoFactorReset)}
          footnote={t('team.resetTwoFactorNote')}
          confirmText={t('team.yesReset')}
          destructive
          onCancel={() => setPendingTwoFactorReset(null)}
          onConfirm={() => submitPost(urlFromTemplate(urls.resetTwoFactor, pendingTwoFactorReset.id))}
        />
      ) : null}

      {pendingDelete ? (
        <DeleteConfirmModal
          title={t('team.deleteUser')}
          message={t('team.deleteUserMessage')}
          detail={accountLabel(pendingDelete)}
          footnote={t('team.deleteUserNote')}
          action={urlFromTemplate(urls.delete, pendingDelete.id)}
          onCancel={() => setPendingDelete(null)}
        />
      ) : null}
    </AppShell>
  );
}
