// src/main/main.ts
// HexX Forge Electron main process.
// 앱 창 생성, preload 연결, 개발/배포 환경별 renderer 로딩을 담당합니다.

import {app, BrowserWindow, ipcMain, protocol} from 'electron';
import path from 'node:path';

import {registerConfigIpc} from './ipc/configIpc';
import {registerModIpc} from './ipc/modIpc';
import {registerAssetIpc} from './ipc/assetIpc';
import {registerAssetPatcherIpc} from './ipc/assetPatcherIpc';
import {registerTextureIpc} from './ipc/textureIpc';
import {registerAssetPackIpc} from './ipc/assetPackIpc';

protocol.registerSchemesAsPrivileged([
    {
        scheme: 'hexx-resource',
        privileges: {
            standard: true,
            secure: true,
            supportFetchAPI: true,
            corsEnabled: true
        }
    }
]);


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

async function protocolHandleFile(filePath: string): Promise<Response> {
    const fs = await import('node:fs/promises');
    const ext = path.extname(filePath).toLowerCase();

    const mime =
        ext === '.jpg' || ext === '.jpeg'
            ? 'image/jpeg'
            : ext === '.webp'
                ? 'image/webp'
                : ext === '.png'
                    ? 'image/png'
                    : 'application/octet-stream';

    try {
        const data = await fs.readFile(filePath);

        return new Response(data, {
            headers: {
                'content-type': mime
            }
        });
    } catch {
        return new Response('File not found', {status: 404});
    }
}

app.whenReady().then(() => {
    ipcMain.handle('app:get-version', () => app.getVersion());

    registerConfigIpc();
    registerModIpc();
    registerAssetIpc();
    registerTextureIpc();
    registerAssetPatcherIpc();
    registerAssetPackIpc();

    protocol.handle('hexx-resource', async (request) => {
        const url = new URL(request.url);

        const host = url.hostname;
        const rawPath = decodeURIComponent(url.pathname).replace(/^\/+/, '');

        let filePath = '';

        if (host === 'preview') {
            filePath = path.join(process.cwd(), rawPath);
        }

        if (host === 'asset-pack') {
            filePath = path.join(process.cwd(), 'storage', 'asset_packs', rawPath);
        }

        if (!filePath) {
            return new Response('Invalid hexx-resource path', {status: 400});
        }

        return protocolHandleFile(filePath);
    });

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