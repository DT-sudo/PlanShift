import { useEffect, useState } from 'react';

import { formatDate } from '../../app/dates.js';
import { getBootstrap, submitPost } from '../../app/http.js';
import { AppShell } from '../../components/AppShell.jsx';
import { Avatar } from '../../components/Avatar.jsx';
import { CsrfInput, Field } from '../../components/Field.jsx';
import { Settings, Trash, UserIcon } from '../../components/Icons.jsx';
import { Modal } from '../../components/Modal.jsx';
import { t } from '../../i18n/index.js';

/** Names the card a native form belongs to; the server re-renders that card's errors in place. */
const Section = ({ name }) => <input type="hidden" name="section" value={name} />;

function AvatarCard({ person, limits, error, action }) {
  const [preview, setPreview] = useState(null);
  const [problem, setProblem] = useState('');
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  const maxMegabytes = limits.maxBytes / 2 ** 20;

  const pick = (event) => {
    const file = event.target.files[0];
    const tooBig = file && file.size > limits.maxBytes;
    setProblem(tooBig ? `The picture must be ${maxMegabytes} MB or smaller.` : '');
    setPreview(file && !tooBig ? URL.createObjectURL(file) : null);
    if (tooBig) event.target.value = '';
  };
  const message = problem || error;

  return (
    <section className="card p-4" aria-labelledby="avatarTitle">
      <h2 id="avatarTitle" className="card-title">
        Profile picture
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">{`JPEG, PNG, WebP or GIF, up to ${maxMegabytes} MB. It is cropped to a square; without one, your initials are shown.`}</p>
      <div className="mt-4 flex flex-wrap items-center gap-4">
        <Avatar name={person.fullName} src={preview || person.avatarUrl} size="lg" primary />
        <form className="flex flex-wrap items-center gap-2" method="post" action={action} encType="multipart/form-data">
          <CsrfInput />
          <Section name="avatar" />
          <label className="sr-only" htmlFor="avatarFile">
            New profile picture
          </label>
          <input
            id="avatarFile"
            name="avatar"
            type="file"
            accept={limits.accept}
            className="form-input w-auto max-w-full"
            aria-invalid={message ? 'true' : undefined}
            aria-describedby={message ? 'avatarError' : undefined}
            required
            onChange={pick}
          />
          <button className="btn btn-primary" type="submit" disabled={!preview}>
            Upload
          </button>
        </form>
        {person.avatarUrl ? (
          <button
            className="btn btn-ghost btn-icon-destructive"
            type="button"
            onClick={() => submitPost(action, { section: 'remove_avatar' })}
          >
            <Trash size={16} />
            Remove picture
          </button>
        ) : null}
      </div>
      {message ? (
        <p id="avatarError" className="form-error-text" role="alert">
          {message}
        </p>
      ) : null}
    </section>
  );
}

function ProfileCard({ values, errors, action }) {
  return (
    <section className="card p-4" aria-labelledby="profileTitle">
      <h2 id="profileTitle" className="card-title">
        Profile
      </h2>
      <form className="mt-4" method="post" action={action}>
        <CsrfInput />
        <Section name="profile" />
        <Field
          id="fullName"
          name="full_name"
          label="Full name"
          autoComplete="name"
          required
          minLength={2}
          maxLength={150}
          defaultValue={values.fullName}
          error={errors.full_name}
        />
        <Field
          id="email"
          name="email"
          type="email"
          dir="ltr"
          label="Email"
          autoComplete="email"
          hint="You sign in with this address."
          required
          defaultValue={values.email}
          error={errors.email}
        />
        <Field
          as="textarea"
          id="bio"
          name="bio"
          label="Bio"
          rows={3}
          maxLength={300}
          hint="Up to 300 characters, shown on your profile."
          defaultValue={values.bio}
          error={errors.bio}
        />
        <Field
          id="currentPassword"
          name="current_password"
          type="password"
          label="Current password"
          autoComplete="current-password"
          hint="Only needed to change your email."
          error={errors.current_password}
        />
        <button className="btn btn-primary" type="submit">
          Save profile
        </button>
      </form>
    </section>
  );
}

function PasswordCard({ errors, action }) {
  return (
    <section className="card p-4" aria-labelledby="passwordTitle">
      <h2 id="passwordTitle" className="card-title">
        Password
      </h2>
      <form className="mt-4" method="post" action={action}>
        <CsrfInput />
        <Section name="password" />
        <Field
          id="oldPassword"
          name="old_password"
          type="password"
          label="Current password"
          autoComplete="current-password"
          required
          error={errors.old_password}
        />
        <Field
          id="newPassword1"
          name="new_password1"
          type="password"
          label="New password"
          autoComplete="new-password"
          hint="Minimum 8 characters, not entirely numeric, and not similar to your name or email."
          required
          minLength={8}
          error={errors.new_password1}
        />
        <Field
          id="newPassword2"
          name="new_password2"
          type="password"
          label="Confirm new password"
          autoComplete="new-password"
          required
          minLength={8}
          error={errors.new_password2}
        />
        <button className="btn btn-primary" type="submit">
          Change password
        </button>
      </form>
    </section>
  );
}

/** The same switcher as the footer's; the choice is saved on the account. */
function LanguageCard() {
  return (
    <section className="card p-4" aria-labelledby="languageTitle">
      <h2 id="languageTitle" className="card-title">
        Language
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">PlanShift, the emails it sends you and your notifications use this language.</p>
      <div className="mt-3">
        <LanguageSwitcher id="settingsLanguage" showLabel />
      </div>
    </section>
  );
}

/** "JBSWY3DPEHPK3PXP..." -> "JBSW Y3DP EHPK 3PXP ...", easier to type into an app by hand. */
const groupKey = (secret) => secret.match(/.{1,4}/g).join(' ');

function TwoFactorSetup({ setup, errors, action }) {
  return (
    <ol className="mt-4 flex flex-col gap-5 text-sm">
      <li>
        <p className="font-medium">1. Scan this QR code with an authenticator app.</p>
        <div className="mt-3 flex flex-wrap items-center gap-4">
          <img
            src={setup.qr}
            alt="QR code that adds PlanShift to an authenticator app"
            width="180"
            height="180"
            className="rounded-md border border-border bg-white"
          />
          <div className="min-w-0 flex-1">
            <p className="text-muted-foreground">Can't scan it? Type this key into the app instead:</p>
            <code dir="ltr" className="mt-1 block font-mono text-base break-all select-all">
              {groupKey(setup.secret)}
            </code>
          </div>
        </div>
      </li>
      <li>
        <p className="font-medium">2. Enter the 6-digit code the app now shows.</p>
        <form className="mt-3" method="post" action={action}>
          <CsrfInput />
          <Section name="2fa_confirm" />
          <Field
            id="setupCode"
            name="code"
            dir="ltr"
            label="Code from the app"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            title="The 6 digits your app shows"
            maxLength={6}
            required
            error={errors.code}
          />
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-primary" type="submit">
              Turn on
            </button>
            <button className="btn btn-outline" type="button" onClick={() => submitPost(action, { section: '2fa_cancel' })}>
              Cancel
            </button>
          </div>
        </form>
      </li>
    </ol>
  );
}

function TwoFactorManage({ state, action }) {
  const { enabledAt, recoveryCodesLeft, errors } = state;

  return (
    <>
      <p className="mt-1 text-sm text-muted-foreground">
        {`Signing in takes a code from your authenticator app. On since ${formatDate(enabledAt.slice(0, 10))}.`}
      </p>
      <p className={`mt-1 text-sm ${recoveryCodesLeft <= 2 ? 'text-destructive' : 'text-muted-foreground'}`}>
        {(recoveryCodesLeft === 1 ? `${recoveryCodesLeft} unused recovery code left.` : `${recoveryCodesLeft} unused recovery codes left.`)}
      </p>
      {/* One form, two actions: each submit button posts its own `section`. */}
      <form className="mt-4" method="post" action={action}>
        <CsrfInput />
        <p className="mb-3 text-sm">To turn it off or get new recovery codes, confirm it's you.</p>
        <Field
          id="twoFactorPassword"
          name="password"
          type="password"
          label="Current password"
          autoComplete="current-password"
          required
          error={errors.password}
        />
        <Field
          id="twoFactorCode"
          name="code"
          dir="ltr"
          label="Code from your app, or a recovery code"
          autoComplete="one-time-code"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={32}
          required
          error={errors.code}
        />
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-outline" type="submit" name="section" value="2fa_recovery">
            Get new recovery codes
          </button>
          <button className="btn btn-destructive" type="submit" name="section" value="2fa_disable">
            Turn off
          </button>
        </div>
      </form>
    </>
  );
}

function TwoFactorCard({ state, action }) {
  const { enabled, setup, errors } = state;

  let body;
  if (enabled) {
    body = <TwoFactorManage state={state} action={action} />;
  } else if (setup) {
    body = <TwoFactorSetup setup={setup} errors={errors} action={action} />;
  } else {
    body = (
      <>
        <p className="mt-1 text-sm text-muted-foreground">After your password, signing in will also take a 6-digit code from an authenticator app on your phone, such as Google Authenticator, Microsoft Authenticator, 1Password or Authy. Someone who learns your password still can't get in.</p>
        <form className="mt-4" method="post" action={action}>
          <CsrfInput />
          <Section name="2fa_start" />
          <button className="btn btn-primary" type="submit">
            Set up two-factor authentication
          </button>
        </form>
      </>
    );
  }

  return (
    <section id="security" className="card p-4" aria-labelledby="twoFactorTitle">
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="twoFactorTitle" className="card-title">
          Two-factor authentication
        </h2>
        <span className={`badge ${enabled ? 'badge-success' : 'badge-outline'}`}>
          {enabled ? "On" : "Off"}
        </span>
      </div>
      {body}
    </section>
  );
}

function RecoveryCodesModal({ codes, onClose }) {
  const [copied, setCopied] = useState(false);
  const text = codes.join('\n');

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const download = () => {
    const file = `${"PlanShift recovery codes"}\n\n${text}\n`;
    const url = URL.createObjectURL(new Blob([file], { type: 'text/plain' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'planshift-recovery-codes.txt';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  return (
    <Modal
      title="Your recovery codes"
      onClose={onClose}
      footer={
        <button className="btn btn-primary" type="button" onClick={onClose}>
          I've saved them
        </button>
      }
    >
      <div className="modal-body">
        <p className="text-sm">If you lose your phone, each code signs you in once. Keep them somewhere safe, such as a password manager. They are shown only now.</p>
        <ul dir="ltr" className="mt-4 grid grid-cols-2 gap-2 font-mono text-sm" aria-label="Recovery codes">
          {codes.map((code) => (
            <li key={code} className="rounded-md border border-border px-2 py-1 text-center">
              {code}
            </li>
          ))}
        </ul>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button className="btn btn-outline btn-sm" type="button" onClick={copy}>
            Copy
          </button>
          <button className="btn btn-outline btn-sm" type="button" onClick={download}>
            Download
          </button>
          <span className="text-sm text-muted-foreground" role="status">
            {copied ? "Copied to the clipboard." : ''}
          </span>
        </div>
      </div>
    </Modal>
  );
}

export function AccountSettingsPage() {
  const { urls, data } = getBootstrap();
  const { values, errors, person, avatar, twoFactor } = data;
  const [recoveryCodes, setRecoveryCodes] = useState(twoFactor.recoveryCodes);

  return (
    <AppShell>
      <main className="p-4 pt-0">
        <div className="card page-toolbar-card">
          <div className="flex flex-wrap items-center gap-3">
            <Settings size={20} className="text-muted-foreground" />
            <h1 className="card-title flex-1">Account settings</h1>
            <a className="btn btn-outline" href={person.profileUrl}>
              <UserIcon size={16} />
              View my profile
            </a>
          </div>
        </div>

        <div className="mx-auto mt-3 flex max-w-3xl flex-col gap-3">
          <AvatarCard person={person} limits={avatar} error={errors.avatar} action={urls.settings} />
          <ProfileCard values={values} errors={errors.profile} action={urls.settings} />
          <PasswordCard errors={errors.password} action={urls.settings} />
          <LanguageCard />
          <TwoFactorCard state={twoFactor} action={urls.settings} />
          <p className="text-sm text-muted-foreground">
            {["To download or delete your data, see ", ((
                <a className="footer-link" href={urls.privacyCenter}>
                  Privacy & my data
                </a>
              )), "."]}
          </p>
        </div>
      </main>

      {recoveryCodes ? <RecoveryCodesModal codes={recoveryCodes} onClose={() => setRecoveryCodes(null)} /> : null}
    </AppShell>
  );
}
