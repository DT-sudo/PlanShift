import { useState } from 'react';

import { timeAgo } from '../../app/dates.js';
import { submitPost, urlFromTemplate } from '../../app/http.js';
import { DIRECTORY_CHANGED, useLivePageData } from '../../app/live.js';
import { AppShell } from '../../components/AppShell.jsx';
import { Avatar } from '../../components/Avatar.jsx';
import { ListTable } from '../../components/ListTable.jsx';
import { PostForm } from '../../components/Field.jsx';
import { UserIcon } from '../../components/Icons.jsx';
import { ConfirmModal, Modal } from '../../components/Modal.jsx';
import { t, tx } from '../../i18n/index.js';
import { RoleAndPositionFields } from '../admin-users/UserModals.jsx';

function ApproveModal({ request, roles, positions, action, onClose }) {
  return (
    <Modal
      title={t('requests.approveTitle')}
      onClose={onClose}
      footer={<FormFooter form="approveForm" submitLabel={t('requests.approve')} onCancel={onClose} />}
    >
      <PostForm id="approveForm" className="modal-body" action={action}>
        <p className="mb-4 text-sm">{tx('requests.approveMessage', { name: <strong>{request.fullName}</strong> })}</p>
        <RoleAndPositionFields idPrefix="approve" roles={roles} positions={positions} />
      </PostForm>
    </Modal>
  );
}

export function RegistrationRequestsPage() {
  const { requests, roles, positions, urls } = useLivePageData([DIRECTORY_CHANGED]);
  const [approving, setApproving] = useState(null);
  const [declining, setDeclining] = useState(null);

  return (
    <AppShell>
      <main className="p-4 pt-0">
        <PageHeader icon={UserIcon} title={t('requests.title')} subtitle={t('requests.subtitle')} />

        <ListTable
          label={t('requests.title')}
          columns={[t('team.avatar'), t('signup.fullName'), t('login.email'), t('requests.requested')]}
          empty={t('requests.empty')}
        >
          {requests.map((request) => (
            <tr key={request.id}>
              <td>
                <Avatar name={request.fullName} src={request.avatarUrl} />
              </td>
              <td>{request.fullName}</td>
              <td className="text-sm" dir="ltr">
                {request.email}
              </td>
              <td className="text-sm whitespace-nowrap text-muted-foreground">
                <time dateTime={request.requestedAt}>{timeAgo(request.requestedAt)}</time>
              </td>
              <td className="cell-actions">
                <button className="btn btn-ghost btn-sm" type="button" onClick={() => setApproving(request)}>
                  {t('requests.approve')}
                </button>
                <button className="btn btn-ghost btn-sm btn-icon-destructive" type="button" onClick={() => setDeclining(request)}>
                  {t('requests.decline')}
                </button>
              </td>
            </tr>
          ))}
        </ListTable>
      </main>

      {approving ? (
        <ApproveModal
          request={approving}
          roles={roles}
          positions={positions}
          action={urlFromTemplate(urls.approve, approving.id)}
          onClose={() => setApproving(null)}
        />
      ) : null}

      {declining ? (
        <ConfirmModal
          title={t('requests.declineTitle')}
          message={t('requests.declineMessage')}
          detail={`${declining.fullName} (${declining.email})`}
          footnote={t('requests.declineNote')}
          confirmText={t('requests.yesDecline')}
          destructive
          onCancel={() => setDeclining(null)}
          onConfirm={() => submitPost(urlFromTemplate(urls.decline, declining.id))}
        />
      ) : null}
    </AppShell>
  );
}
