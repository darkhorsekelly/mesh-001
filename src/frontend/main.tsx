// ===============================================
// God-View Frontend Entry Point
// ===============================================
// minimalist spatial visualizer for MESH 95 development.

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { GodView } from './GodView.js';

const root = document.getElementById('root');
if (!root) {
    throw new Error('Root element not found');
}

createRoot(root).render(
    <StrictMode>
        <GodView />
    </StrictMode>
);
