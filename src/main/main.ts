// src/main/main.ts
// HexX Forge Electron main process.
// 앱 창 생성, preload 연결, 개발/배포 환경별 renderer 로딩을 담당합니다.

import {app, BrowserWindow, ipcMain} from 'electron';
import path from 'node:path';

import {registerConfigIpc} from './ipc/configIpc';
import {registerModIpc} from './ipc/modIpc';
import {registerAssetIpc} from './ipc/assetIpc';
import {registerAssetPatcherIpc} from './ipc/assetPatcherIpc';
import {registerTextureIpc} from './ipc/textureIpc';

const isDev = !app.isPackaged;

function createMainWindow(): void {
    const mainWindow = new BrowserWindow({
        width: 1480,
        height: 820,
        minWidth: 1280,
        minHeight: 700,
        title: 'HexX Forge',
        backgroundColor: '#101018',
        webPreferences: {
            preload: path.join(__dirname, '../preload/preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    if (isDev) {
        mainWindow.loadURL('http://localhost:5173');
        mainWindow.webContents.openDevTools({mode: 'detach'});
        return;
    }

    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
}

app.whenReady().then(() => {
    ipcMain.handle('app:get-version', () => app.getVersion());

    registerConfigIpc();
    registerModIpc();
    registerAssetIpc();
    registerTextureIpc();
    registerAssetPatcherIpc();
    createMainWindow();


    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createMainWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});