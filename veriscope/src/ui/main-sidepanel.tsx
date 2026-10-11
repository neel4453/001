import React from 'react';
import { createRoot } from 'react-dom/client';
import '../styles/base.css';
import { SidePanelApp, Shell } from './sidepanel/App';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode><Shell><SidePanelApp /></Shell></React.StrictMode>,
);
