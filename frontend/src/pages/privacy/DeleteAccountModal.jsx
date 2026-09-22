import { getBootstrap } from '../../app/http.js';
import { Field } from '../../components/Field.jsx';
import { Modal } from '../../components/Modal.jsx';
import { t, tx } from '../../i18n/index.js';

export function DeleteAccountModal({ email, action, onClose }) {
  const { urls } = getBootstrap();

  return (
    <Modal
      title={t('privacy.deleteTitle')}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-outline" type="button" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button className="btn btn-destructive" type="submit" form="deleteAccountForm">
            {t('privacy.modalConfirm')}
          </button>
        </>
      }
    >
      <form id="deleteAccountForm" className="modal-body" method="post" action={action}>
        <CsrfInput />

        <p className="text-sm">
          {tx('privacy.modalText', {
            policy: (
              <a className="footer-link" href={urls.privacy}>
                {t('footer.privacyPolicy')}
              </a>
            ),
          })}
        </p>

        <Field
          id="deleteConfirmEmail"
          name="confirm_email"
          type="email"
          dir="ltr"
          label={t('privacy.typeEmail', { email })}
          placeholder={email}
          autoComplete="off"
          required
        />
        <Field
          id="deleteConfirmPassword"
          name="confirm_password"
          type="password"
          label={t('privacy.confirmPassword')}
          autoComplete="current-password"
          required
        />
      </form>
    </Modal>
  );
}
