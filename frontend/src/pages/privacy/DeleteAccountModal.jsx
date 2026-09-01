import { getBootstrap } from '../../app/http.js';
import { CsrfInput, Field } from '../../components/Field.jsx';
import { Modal } from '../../components/Modal.jsx';

export function DeleteAccountModal({ email, action, onClose }) {
  const { urls } = getBootstrap();

  return (
    <Modal
      title="Delete your account"
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-outline" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-destructive" type="submit" form="deleteAccountForm">
            Permanently delete my account
          </button>
        </>
      }
    >
      <form id="deleteAccountForm" className="modal-body" method="post" action={action}>
        <CsrfInput />

        <p className="text-sm">
          {["This permanently deletes your account, your shift assignments and your unavailability records. There is no undo and no archive copy - see the ", ((
              <a className="footer-link" href={urls.privacy}>
                Privacy Policy
              </a>
            )), " (section 4) for exactly what that means."]}
        </p>

        <Field
          id="deleteConfirmEmail"
          name="confirm_email"
          type="email"
          dir="ltr"
          label={`Type your email (${email}) to confirm`}
          placeholder={email}
          autoComplete="off"
          required
        />
        <Field
          id="deleteConfirmPassword"
          name="confirm_password"
          type="password"
          label="Confirm your password"
          autoComplete="current-password"
          required
        />
      </form>
    </Modal>
  );
}
