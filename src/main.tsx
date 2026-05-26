import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {ThemeProvider} from 'next-themes';
import App from './App.tsx';
import './index.css';

import { registerSW } from 'virtual:pwa-register';
registerSW({ immediate: true });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* @ts-ignore - next-themes ThemeProvider types are currently incompatible with React 19 children */}
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <App />
    </ThemeProvider>
  </StrictMode>,
);
