import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import '@fontsource/playfair-display/600.css';
import '@fontsource/playfair-display/700.css';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
