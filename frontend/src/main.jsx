import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import './styles/index.css';
import { getBootstrap } from './app/http.js';

const PAGES = {
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
