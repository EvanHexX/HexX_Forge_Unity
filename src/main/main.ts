// src/main/main.ts
// HexX Forge Electron main process.
// 앱 창 생성, preload 연결, 개발/배포 환경별 renderer 로딩을 담당합니다.

import { app, BrowserWindow, ipcMain, Menu, protocol } from 'electron';
import path from 'node:path';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';

import { registerConfigIpc } from './ipc/configIpc';
import { registerModIpc } from './ipc/modIpc';
import { registerAssetIpc } from './ipc/assetIpc';
import { registerAssetPatcherIpc } from './ipc/assetPatcherIpc';
import { registerTextureIpc } from './ipc/textureIpc';
import { registerAssetPackIpc } from './ipc/assetPackIpc';
import { registerGraphicsIpc } from './ipc/graphicsIpc';
import { registerUpdateIpc } from './services/updateService';
import { resolveGraphicsFile, resolveSelectedMediaFile } from './services/graphicsService';
import { getAppRootDir, getBundledStoragePath, getStoragePath } from './services/runtimePaths';

protocol.registerSchemesAsPrivileged([
    {
        scheme: 'hexx-resource',
        privileges: {
            standard: true,
            secure: true,
            supportFetchAPI: true,
            corsEnabled: true,
            stream: true
        }
    }
]);

const isDev = !app.isPackaged;

function resolveWindowIcon(): string {
    const iconPath = isDev
        ? path.join(process.cwd(), 'build', 'icon.ico')
        : path.join(getAppRootDir(), 'build', 'icon.ico');

    return fsSync.existsSync(iconPath) ? iconPath : '';
}

type GitHubReleaseApiItem = {
    id: number;
    name: string | null;
    tag_name: string;
    html_url: string;
    published_at: string;
    body: string | null;
    prerelease: boolean;
};

async function fetchGitHubReleases() {
    const response = await fetch('https://api.github.com/repos/EvanHexX/HexX_Forge_Unity/releases?per_page=5', {
        headers: {
            accept: 'application/vnd.github+json',
            'user-agent': 'HexX-Forge'
        }
    });

    if (!response.ok) {
        throw new Error(`GitHub Releases 요청 실패: ${response.status}`);
    }

    const releases = (await response.json()) as GitHubReleaseApiItem[];

    return releases.map((release) => ({
        id: release.id,
        name: release.name || release.tag_name,
        tagName: release.tag_name,
        htmlUrl: release.html_url,
        publishedAt: release.published_at,
        body: release.body || '',
        prerelease: release.prerelease
    }));
}

function createMainWindow(): void {
    const mainWindow = new BrowserWindow({
        width: 1480,
        height: 820,
        minWidth: 1280,
        minHeight: 700,
        title: 'HexX Forge',
        icon: resolveWindowIcon(),
        backgroundColor: '#101018',
        webPreferences: {
            preload: path.join(__dirname, '../preload/preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    if (isDev) {
        mainWindow.loadURL('http://localhost:5173');
        mainWindow.webContents.openDevTools({ mode: 'detach' });
        return;
    }

    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
}

function getMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();

    if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
    if (ext === '.webp') return 'image/webp';
    if (ext === '.png') return 'image/png';
    if (ext === '.mp4') return 'video/mp4';
    if (ext === '.webm') return 'video/webm';
    if (ext === '.mov') return 'video/quicktime';
    if (ext === '.mkv') return 'video/x-matroska';
    if (ext === '.avi') return 'video/x-msvideo';
    if (ext === '.ttf' || ext === '.ttc' || ext === '.fontdata') return 'font/ttf';
    if (ext === '.otf') return 'font/otf';

    return 'application/octet-stream';
}

async function protocolHandleFile(filePath: string): Promise<Response> {
    try {
        const data = await fs.readFile(filePath);

        return new Response(data, {
            headers: {
                'content-type': getMimeType(filePath)
            }
        });
    } catch {
        return new Response('File not found', { status: 404 });
    }
}

function uniquePaths(paths: string[]): string[] {
    return [...new Set(paths.filter(Boolean).map((item) => path.normalize(item)))];
}

function getRootCandidates(): string[] {
    return uniquePaths([
        process.cwd(),
        app.getAppPath(),
        path.dirname(process.execPath),
        process.resourcesPath
    ]);
}

function normalizeRelativePath(rawPath: string): string | null {
    const normalized = path.normalize(rawPath.replaceAll('\\', '/'));

    if (!normalized || normalized.startsWith('..') || path.isAbsolute(normalized)) {
        return null;
    }

    return normalized;
}

function findExistingFile(relativePath: string, baseFolders: string[]): string {
    const safeRelativePath = normalizeRelativePath(relativePath);

    if (!safeRelativePath) return '';

    for (const root of getRootCandidates()) {
        for (const baseFolder of baseFolders) {
            const candidate = path.join(root, baseFolder, safeRelativePath);

            if (fsSync.existsSync(candidate)) {
                return candidate;
            }
        }
    }

    return '';
}

function resolvePreviewFile(rawPath: string): string {
    // asset_catalog.json의 preview 값은 현재 config/resources/previews/... 기준 상대 경로입니다.
    // 배포 구조가 바뀌어도 config/ 하위와 app root 하위를 모두 탐색합니다.
    return findExistingFile(rawPath, ['config', '']);
}

function resolveAssetPackFile(rawPath: string): string {
    // assetPackService.ts가 storage/asset_packs를 기준으로 URL을 만들기 때문에
    // protocol 쪽도 동일한 상대 구조를 우선 사용합니다.
    const safeRelativePath = normalizeRelativePath(rawPath);

    if (!safeRelativePath) return '';

    const candidates = [
        path.join(getStoragePath('asset_packs'), safeRelativePath),
        path.join(getBundledStoragePath('asset_packs'), safeRelativePath)
    ];
    return candidates.find((candidate) => fsSync.existsSync(candidate)) || '';
}

function resolveSelectedImageFile(url: URL): string {
    const encodedPath = url.searchParams.get('path') || '';

    if (!encodedPath) return '';

    const filePath = decodeURIComponent(encodedPath);

    return fsSync.existsSync(filePath) ? filePath : '';
}

function resolveFontFile(url: URL): string {
    const encodedPath = url.searchParams.get('path') || '';

    if (!encodedPath) return '';

    const filePath = decodeURIComponent(encodedPath);
    const ext = path.extname(filePath).toLowerCase();

    if (!['.ttf', '.otf', '.ttc', '.fontdata'].includes(ext)) return '';

    return fsSync.existsSync(filePath) ? filePath : '';
}

function resolveStoredFontFile(rawPath: string): string {
    const safeRelativePath = normalizeRelativePath(rawPath);

    if (!safeRelativePath) return '';

    const ext = path.extname(safeRelativePath).toLowerCase();

    if (!['.ttf', '.otf', '.ttc', '.fontdata'].includes(ext)) return '';

    const candidates = [
        path.join(getStoragePath('fonts'), safeRelativePath),
        path.join(getBundledStoragePath('fonts'), safeRelativePath)
    ];
    return candidates.find((candidate) => fsSync.existsSync(candidate)) || '';
}

app.whenReady().then(() => {
    Menu.setApplicationMenu(null);

    ipcMain.handle('app:get-version', () => app.getVersion());
    ipcMain.handle('github:get-releases', () => fetchGitHubReleases());

    registerConfigIpc();
    registerModIpc();
    registerAssetIpc();
    registerTextureIpc();
    registerAssetPatcherIpc();
    registerAssetPackIpc();
    registerGraphicsIpc();
    registerUpdateIpc();

    protocol.handle('hexx-resource', async (request) => {
        const url = new URL(request.url);
        const host = url.hostname;
        const rawPath = decodeURIComponent(url.pathname).replace(/^\/+/, '');

        let filePath = '';

        if (host === 'preview') {
            filePath = resolvePreviewFile(rawPath);
        }

        if (host === 'asset-pack') {
            filePath = resolveAssetPackFile(rawPath);
        }

        if (host === 'selected-image') {
            filePath = resolveSelectedImageFile(url);
        }

        if (host === 'font-file') {
            filePath = resolveFontFile(url);
        }

        if (host === 'font') {
            filePath = resolveStoredFontFile(rawPath);
        }

        if (host === 'graphics') {
            filePath = resolveGraphicsFile(rawPath);
        }

        if (host === 'selected-media') {
            filePath = resolveSelectedMediaFile(url);
        }

        if (!filePath) {
            return new Response('Invalid or missing hexx-resource path', { status: 404 });
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
