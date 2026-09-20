import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import HandoverPageV3 from './HandoverPageV3.jsx';
import './scanner-enhancement.js';
import './index.css';

const isHandoverRoute = () => window.location.hash === '#/handover' || window.location.hash.startsWith('#/handover?');

// React Router's HashRouter uses history.pushState in some navigation paths.
// Browsers do not emit hashchange for pushState, so bridge it into an app-level
// event. This keeps the dedicated handover UI in sync without a page refresh.
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
  const [handoverRoute, setHandoverRoute] = useState(isHandoverRoute());

  useEffect(() => {
    const syncRoute = () => setHandoverRoute(isHandoverRoute());
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

  if (handoverRoute) return <HandoverPageV3 />;
  return <App />;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
