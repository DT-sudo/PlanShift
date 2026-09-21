import { getBootstrap, submitPost } from '../../app/http.js';
import { PasswordChangeFields, PostForm } from '../../components/Field.jsx';
import { t } from '../../i18n/index.js';
import { AuthLayout, SigningInAs } from './AuthLayout.jsx';

export function PasswordChangeRequiredPage() {
  const { data, messages, urls } = getBootstrap();

  return (
    <AuthLayout title={t('passwordChange.title')} subtitle={t('passwordChange.subtitle')} messages={messages}>
      <SigningInAs email={data.email} />

      <PostForm action={data.urls.submit}>
        <PasswordChangeFields errors={data.fieldErrors} currentLabel={t('passwordChange.given')} />
        <button type="submit" className="btn btn-primary w-full">
          {t('settings.changePassword')}
        </button>
      </PostForm>

      <div className="mt-5 text-center text-sm">
        <button type="button" className="text-muted-foreground hover:underline" onClick={() => submitPost(urls.logout)}>
          {t('header.logout')}
        </button>
      </div>
    </AuthLayout>
  );
}
