import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import App from './App.jsx';
import HandoverPageV2 from './HandoverPage.jsx';
import './index.css';

const isHandoverRoute = () => window.location.hash === '#/handover' || window.location.hash.startsWith('#/handover?');

function Root() {
  const [handoverRoute, setHandoverRoute] = useState(isHandoverRoute());

  useEffect(() => {
    const handleHashChange = () => setHandoverRoute(isHandoverRoute());
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  if (handoverRoute) {
    return (
      <MemoryRouter initialEntries={['/handover']}>
        <HandoverPageV2 />
      </MemoryRouter>
    );
  }

  return <App />;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
