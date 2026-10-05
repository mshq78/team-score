import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import '@fontsource/vazirmatn/400.css';
import '@fontsource/vazirmatn/500.css';
import '@fontsource/vazirmatn/700.css';
import '@fontsource/vazirmatn/800.css';
import '@fontsource/vazirmatn/900.css';
import App from './App.tsx';
import { PublicResults } from './components/PublicResults.tsx';
import { AdminGate } from './components/AdminGate.tsx';
import './index.css';
import { IS_OFFLINE } from './offline/flag';

// Public results link: /?results=<token>[&event=<id>] shows a read-only page and nothing else
const query = new URLSearchParams(window.location.search);
const resultsToken = IS_OFFLINE ? null : query.get('results');
// Judges open ?judge=1 (they sign in with their own code); the offline file is a local app. Everything else needs the admin key.
const isJudgeLink = query.get('judge') === '1';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {resultsToken ? (
      <PublicResults token={resultsToken} eventId={query.get('event') || 'default'} />
    ) : IS_OFFLINE || isJudgeLink ? (
      <App />
    ) : (
      <AdminGate>
        <App />
      </AdminGate>
    )}
  </StrictMode>,
);

// Offline support: cache the app so it opens without a connection.
// Service workers need HTTPS or localhost; on a plain-HTTP LAN address the
// browser simply doesn't offer them and the app works as before.
if (import.meta.env.PROD && !IS_OFFLINE && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  });
}
