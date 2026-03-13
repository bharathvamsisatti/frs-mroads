import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter as Router } from 'react-router-dom';
import App from './App';
import { WebSocketProvider } from './contexts/WebSocketContext';
import { initializeFavicon } from './utils/favicon';
import './css/style.css';
import './css/mroads.css';
import 'jsvectormap/dist/jsvectormap.css';
import 'flatpickr/dist/flatpickr.min.css';

// Initialize favicon functionality
initializeFavicon();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <WebSocketProvider>
      <Router>
        <App />
      </Router>
    </WebSocketProvider>
  </React.StrictMode>,
);
