import { useState } from 'react';

import { getBootstrap, submitPost, urlFromTemplate } from '../../app/http.js';
import { AppShell } from '../../components/AppShell.jsx';
import { Plus } from '../../components/Icons.jsx';
import { ConfirmModal } from '../../components/Modal.jsx';
import { CredentialsModal, EmployeeFormModal, PositionsModal } from './EmployeeModals.jsx';

/** "EMP-123456 (maya@example.com)": names the account in a confirmation. */
const accountLabel = (employee) => `${employee.employeeId} (${employee.email})`;

function EmployeeRow({ employee, showRole, onEdit, onResetPassword, onResetTwoFactor, onDelete }) {
  return (
    <tr>
      <td>
        <Avatar name={employee.fullName} src={employee.avatarUrl} />
      </td>
      <td className="text-sm">{employee.employeeId}</td>
      <td>
        <a className="person-name" href={employee.profileUrl}>
          {employee.fullName}
        </a>
        {employee.twoFactor ? (
          <span className="badge badge-success ms-2" title="Two-factor authentication is on">
            2FA
          </span>
        ) : null}
      </td>
      {showRole ? (
        <td>
          <span className="badge badge-outline">{employee.roleLabel}</span>
        </td>
      ) : null}
      <td>{employee.position ? <span className="badge badge-default">{employee.position}</span> : null}</td>
      <td className="text-sm" dir="ltr">
        {employee.email}
      </td>
      <td className="text-end whitespace-nowrap">
        <button className="btn btn-ghost btn-sm" type="button" onClick={() => onEdit(employee)}>
          Edit
        </button>
        <button className="btn btn-ghost btn-sm" type="button" onClick={() => onResetPassword(employee)}>
          Reset password
        </button>
        {employee.twoFactor ? (
          <button className="btn btn-ghost btn-sm" type="button" onClick={() => onResetTwoFactor(employee)}>
            Reset 2FA
          </button>
        ) : null}
        <button className="btn btn-ghost btn-sm btn-icon-destructive" type="button" onClick={() => onDelete(employee)}>
          Delete
        </button>
      </td>
    </tr>
  );
}

/** The Team page. Admins get every other account plus a role column and picker (`roles`); managers get employees. */
export function ManagerEmployeesPage() {
  const { data } = getBootstrap();
  const { employees, roles, positions, credentials, urls } = data;
  const isUsers = Boolean(roles);

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
              {isUsers ? "Add user" : "Add employee"}
            </button>
            <button className="btn btn-outline" type="button" onClick={() => setShowPositions(true)}>
              Manage positions
            </button>
          </div>
        </div>

        <div className="card mt-3">
          <table className="table" aria-label={isUsers ? "User list" : "Employee list"}>
            <thead>
              <tr>
                <th>Avatar</th>
                <th>Employee ID</th>
                <th>Full name</th>
                {roles ? <th>Role</th> : null}
                <th>Position</th>
                <th>Email</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {employees.length === 0 ? (
                <tr>
                  <td colSpan={roles ? 7 : 6} className="p-8 text-center text-sm text-muted-foreground">
                    No employees yet. Add your first employee to start assigning shifts.
                  </td>
                </tr>
              ) : (
                employees.map((employee) => (
                  <EmployeeRow
                    key={employee.id}
                    employee={employee}
                    showRole={isUsers}
                    onEdit={(target) => setEmployeeForm({ employee: target, action: urlFromTemplate(urls.update, target.id) })}
                    onResetPassword={setPendingReset}
                    onResetTwoFactor={setPendingTwoFactorReset}
                    onDelete={setPendingDelete}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </main>

      {employeeForm ? (
        <EmployeeFormModal
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
          title="Reset password"
          message="Are you sure you want to reset the password for:"
          detail={accountLabel(pendingReset)}
          onCancel={() => setPendingReset(null)}
          onConfirm={() => submitPost(urlFromTemplate(urls.resetPassword, pendingReset.id))}
        />
      ) : null}

      {pendingTwoFactorReset ? (
        <ConfirmModal
          title="Reset two-factor authentication"
          message="Turn off two-factor authentication for:"
          detail={accountLabel(pendingTwoFactorReset)}
          footnote="Only do this for someone who lost both their phone and their recovery codes. They will be told by email and can turn it on again."
          confirmText="Yes, reset"
          destructive
          onCancel={() => setPendingTwoFactorReset(null)}
          onConfirm={() => submitPost(urlFromTemplate(urls.resetTwoFactor, pendingTwoFactorReset.id))}
        />
      ) : null}

      {pendingDelete ? (
        <ConfirmModal
          title={isUsers ? "Delete user" : "Delete employee"}
          message={isUsers ? "Are you sure you want to delete this user?" : "Are you sure you want to delete this employee?"}
          detail={accountLabel(pendingDelete)}
          footnote={isUsers ? "This will remove the user and their assignments." : "This will remove the employee and their assignments."}
          confirmText="Yes, delete"
          destructive
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => submitPost(urlFromTemplate(urls.delete, pendingDelete.id))}
        />
      ) : null}
    </AppShell>
  );
}
