import { timeAgo } from '../../app/dates.js';
import { getBootstrap } from '../../app/http.js';
import { useLiveEvents } from '../../app/live.js';
import { AppShell } from '../../components/AppShell.jsx';
import { t, tx } from '../../i18n/index.js';

export function RegistrationPendingPage() {
  const { email, requestedAt, urls } = getBootstrap().data;
  useLiveEvents((event) => {
    if (event.type === 'registration.approved') window.location.assign(urls.home);
  });

  return (
    <AppShell>
      <main className="flex justify-center p-6">
        <section className="card w-full max-w-120 p-8 text-center" aria-labelledby="pendingTitle">
          <h1 id="pendingTitle" className="text-2xl font-bold">
            {t('pending.title')}
          </h1>
          <p className="mt-3 text-muted-foreground">
            {tx('pending.text', { email: <bdi className="font-medium text-foreground">{email}</bdi> })}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">{t('pending.sent', { time: timeAgo(requestedAt) })}</p>
          <p className="mt-4 text-sm text-muted-foreground">{t('pending.hint')}</p>
        </section>
      </main>
    </AppShell>
  );
}
