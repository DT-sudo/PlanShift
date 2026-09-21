import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import './styles/index.css';
import { getBootstrap } from './app/http.js';
import { watchBackForwardCache } from './app/session.js';
import { useLanguage } from './i18n/index.js';
import { LoginPage } from './pages/auth/LoginPage.jsx';
import { PasswordChangeRequiredPage } from './pages/auth/PasswordChangeRequiredPage.jsx';
import { SignUpPage } from './pages/auth/SignUpPage.jsx';
import { TwoFactorVerifyPage } from './pages/auth/TwoFactorVerifyPage.jsx';
import { EmployeeShiftsPage } from './pages/employee-shifts/EmployeeShiftsPage.jsx';
import { LegalPage } from './pages/legal/LegalPage.jsx';
import { ManagerAnalyticsPage } from './pages/manager-analytics/ManagerAnalyticsPage.jsx';
import { AdminUsersPage } from './pages/admin-users/AdminUsersPage.jsx';
import { ManagerShiftSearchPage } from './pages/manager-shift-search/ManagerShiftSearchPage.jsx';
import { ManagerShiftsPage } from './pages/manager-shifts/ManagerShiftsPage.jsx';
import { PrivacyCenterPage } from './pages/privacy/PrivacyCenterPage.jsx';
import { FriendsPage } from './pages/profiles/FriendsPage.jsx';
import { RegistrationPendingPage } from './pages/registration/RegistrationPendingPage.jsx';
import { RegistrationRequestsPage } from './pages/registration/RegistrationRequestsPage.jsx';
import { ProfilePage } from './pages/profiles/ProfilePage.jsx';
import { AccountSettingsPage } from './pages/profiles/AccountSettingsPage.jsx';

const PAGES = {
  login: LoginPage,
  signup: SignUpPage,
  'two-factor-verify': TwoFactorVerifyPage,
  'password-change-required': PasswordChangeRequiredPage,
  'registration-pending': RegistrationPendingPage,
  'registration-requests': RegistrationRequestsPage,
  legal: LegalPage,
  'manager-shifts': ManagerShiftsPage,
  'manager-shift-search': ManagerShiftSearchPage,
  'manager-analytics': ManagerAnalyticsPage,
  'admin-users': AdminUsersPage,
  'employee-shifts': EmployeeShiftsPage,
  'privacy-center': PrivacyCenterPage,
  profile: ProfilePage,
  'account-settings': AccountSettingsPage,
  friends: FriendsPage,
};

const Page = PAGES[getBootstrap().page];

function App() {
  useLanguage();
  return <Page />;
}

watchBackForwardCache();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
