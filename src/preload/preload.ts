// src/preload/preload.ts
// Renderer에서 안전하게 사용할 Electron API를 노출합니다.

import {contextBridge, ipcRenderer} from 'electron';

const electronAPI = {
    getVersion: (): Promise<string> => ipcRenderer.invoke('app:get-version'),

    getSettings: () => ipcRenderer.invoke('config:get-settings'),
    getThemes: () => ipcRenderer.invoke('config:get-themes'),
    setTheme: (themeName: string) => ipcRenderer.invoke('config:set-theme', themeName),
    setGamePath: (gamePath: string) => ipcRenderer.invoke('config:set-game-path', gamePath),
    selectDirectory: () => ipcRenderer.invoke('dialog:select-directory'),

    scanMods: () => ipcRenderer.invoke('mods:scan'),
    selectModImportFile: () => ipcRenderer.invoke('mods:select-import-file'),

    importDllMod: (filePath: string, name: string, author: string) =>
        ipcRenderer.invoke('mods:import-dll', filePath, name, author),

    importZipMod: (filePath: string) =>
        ipcRenderer.invoke('mods:import-zip', filePath),

    deleteMod: (relativePath: string) =>
        ipcRenderer.invoke('mods:delete', relativePath),
    setModEnabled: (relativePath: string, enabled: boolean) =>
        ipcRenderer.invoke('mods:set-enabled', relativePath, enabled)
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);

export type ElectronAPI = typeof electronAPI;