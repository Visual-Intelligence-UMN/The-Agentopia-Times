import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import { initializeLocalRunArchive } from './utils/localRunArchive.ts';

initializeLocalRunArchive();

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>,
)
