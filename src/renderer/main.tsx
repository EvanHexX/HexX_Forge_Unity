// src/renderer/main.tsx
// React 앱 진입점입니다.

import React from 'react';
import ReactDOM from 'react-dom/client';
import './polyfills/focusVisible';
import App from './App';
import './styles/global.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);
