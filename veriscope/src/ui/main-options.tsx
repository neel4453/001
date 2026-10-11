import React from 'react';
import { createRoot } from 'react-dom/client';
import '../styles/base.css';
import { OptionsApp } from './options/OptionsApp';
import { ToastProvider } from './components/ui';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode><ToastProvider><OptionsApp /></ToastProvider></React.StrictMode>,
);
