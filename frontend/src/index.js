import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import './styles/base.css';
import './styles/components-01.css';
import './styles/components-02.css';
import './styles/components-03.css';
import './styles/components-04.css';
import './styles/components-05.css';
import './styles/motion.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import * as serviceWorkerRegistration from './serviceWorkerRegistration';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
serviceWorkerRegistration.register();

// Automatically reload the page when a new service worker takes over.
// This ensures users always get the latest PWA updates immediately.
if ('serviceWorker' in navigator) {
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!refreshing) {
      refreshing = true;
      window.location.reload();
    }
  });
}
