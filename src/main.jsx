import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import HandoverPageV3 from './HandoverPageV3.jsx';
import ManifestPage from './ManifestPage.jsx';
import HistoryPage from './HistoryPage.jsx';
import './scanner-enhancement.js';
import './index.css';

function getSpecialRoute() {
  const raw = window.location.hash.replace(/^#/, '') || '/';
  const path = raw.split('?')[0];
  if (path === '/handover') return 'handover';
  if (path === '/manifests') return 'manifests';
  if (path === '/history') return 'history';
  return null;
}

if (!window.__manifestReturHistoryBridge__) {
  window.__manifestReturHistoryBridge__ = true;
  ['pushState', 'replaceState'].forEach((method) => {
    const original = window.history[method];
    window.history[method] = function bridgedHistoryMethod(...args) {
      const result = original.apply(this, args);
      window.dispatchEvent(new Event('manifestretur:navigation'));
      return result;
    };
  });
}

function Root() {
  const [specialRoute, setSpecialRoute] = useState(getSpecialRoute());

  useEffect(() => {
    const syncRoute = () => setSpecialRoute(getSpecialRoute());
    window.addEventListener('hashchange', syncRoute);
    window.addEventListener('popstate', syncRoute);
    window.addEventListener('manifestretur:navigation', syncRoute);
    syncRoute();
    return () => {
      window.removeEventListener('hashchange', syncRoute);
      window.removeEventListener('popstate', syncRoute);
      window.removeEventListener('manifestretur:navigation', syncRoute);
    };
  }, []);

  const token = localStorage.getItem('retur_token');
  if (!token) return <App />;

  if (specialRoute === 'handover') return <HandoverPageV3 />;
  if (specialRoute === 'manifests') return <ManifestPage />;
  if (specialRoute === 'history') return <HistoryPage />;
  return <App />;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
