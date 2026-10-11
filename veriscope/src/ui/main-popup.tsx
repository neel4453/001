import React from 'react';
import { createRoot } from 'react-dom/client';
import '../styles/base.css';
import { PopupApp } from './popup/PopupApp';
import { ToastProvider } from './components/ui';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode><ToastProvider><PopupApp /></ToastProvider></React.StrictMode>,
);
