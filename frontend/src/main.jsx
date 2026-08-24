import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import './styles/index.css';
import { getBootstrap } from './app/http.js';
import { LoginPage } from './pages/auth/LoginPage.jsx';
import { SignUpPage } from './pages/auth/SignUpPage.jsx';
import { EmployeeShiftsPage } from './pages/employee-shifts/EmployeeShiftsPage.jsx';
import { LegalPage } from './pages/legal/LegalPage.jsx';
import { ManagerAnalyticsPage } from './pages/manager-analytics/ManagerAnalyticsPage.jsx';
import { ManagerEmployeesPage } from './pages/manager-employees/ManagerEmployeesPage.jsx';
import { ManagerShiftSearchPage } from './pages/manager-shift-search/ManagerShiftSearchPage.jsx';
import { ManagerShiftsPage } from './pages/manager-shifts/ManagerShiftsPage.jsx';

const PAGES = {
  login: LoginPage,
  signup: SignUpPage,
  legal: LegalPage,
  'manager-shifts': ManagerShiftsPage,
  'manager-shift-search': ManagerShiftSearchPage,
  'manager-analytics': ManagerAnalyticsPage,
  'manager-employees': ManagerEmployeesPage,
  'employee-shifts': EmployeeShiftsPage,
};

const Page = PAGES[getBootstrap().page];

function App() {
  return <Page />;
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
