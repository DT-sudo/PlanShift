import { useState } from 'react';

import { getBootstrap } from '../../app/http.js';
import { AppShell, PageHeader, PrivacyPolicyLink } from '../../components/AppShell.jsx';
import { Download, ShieldCheck, Trash } from '../../components/Icons.jsx';
import { t, tx } from '../../i18n/index.js';
import { DeleteAccountModal } from './DeleteAccountModal.jsx';

function InfoCard({ title, text, danger = false, children }) {
  return (
    <div className={`card mt-3 p-4 ${danger ? 'card-danger' : ''}`}>
      <div className="card-title">{title}</div>
      <p className="mt-2 text-sm text-muted-foreground">{text}</p>
      {children}
    </div>
  );
}

export function PrivacyCenterPage() {
  const { data } = getBootstrap();
  const { urls, isManager, email, lastAdmin } = data;
  const [showDelete, setShowDelete] = useState(false);

  return (
    <AppShell>
      <main className="p-4 pt-0">
        <PageHeader icon={ShieldCheck} title={t('header.privacy')} subtitle={t('privacy.subtitle')} />

        <InfoCard
          title={t('privacy.holdTitle')}
          text={
            <>
              {isManager ? t('privacy.holdManager') : t('privacy.holdEmployee')}{' '}
              {tx('privacy.holdMore', { policy: <PrivacyPolicyLink /> })}
            </>
          }
        />

        <InfoCard title={t('privacy.requestTitle')} text={t('privacy.requestText')}>
          <a className="btn btn-outline mt-3" href={urls.exportData}>
            <Download size={16} />
            {t('privacy.download')}
          </a>
        </InfoCard>

        <InfoCard
          title={t('privacy.deleteTitle')}
          text={`${isManager ? t('privacy.deleteManager') : t('privacy.deleteEmployee')} ${t('privacy.deleteFinal')}`}
          danger
        >
          {lastAdmin ? (
            <p className="mt-3 text-sm font-medium" role="note">
              {lastAdmin}
            </p>
          ) : (
            <button className="btn btn-destructive mt-3" type="button" onClick={() => setShowDelete(true)}>
              <Trash size={16} />
              {t('privacy.deleteButton')}
            </button>
          )}
        </InfoCard>
      </main>

      {showDelete ? (
        <DeleteAccountModal email={email} action={urls.deleteAccount} onClose={() => setShowDelete(false)} />
      ) : null}
    </AppShell>
  );
}
