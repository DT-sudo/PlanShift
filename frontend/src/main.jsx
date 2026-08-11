import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import './styles/index.css';
import { getBootstrap } from './app/http.js';
import { LoginPage } from './pages/auth/LoginPage.jsx';
import { ManagerEmployeesPage } from './pages/manager-employees/ManagerEmployeesPage.jsx';
import { ManagerShiftsPage } from './pages/manager-shifts/ManagerShiftsPage.jsx';

const PAGES = {
  login: LoginPage,
  'manager-shifts': ManagerShiftsPage,
  'manager-employees': ManagerEmployeesPage,
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
