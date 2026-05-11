// src/renderer/global.d.ts
// Renderer 전역 window.electronAPI 타입 선언입니다.
/// <reference types="vite/client" />
import type { ElectronAPI } from '../preload/preload';

declare global {
    interface Window {
        electronAPI: ElectronAPI;
    }
}

export {};