import React from 'react';
import { createRoot } from 'react-dom/client';
import ChatApp from './components/ChatApp.jsx';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ChatApp />
  </React.StrictMode>,
);
