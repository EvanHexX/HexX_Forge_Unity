import { app, ipcMain } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { checkFfmpeg } from './graphicsService';
import { getConfigPath, getResourcePath } from './runtimePaths';

export type RuntimeIntegrityItemStatus = 'ok' | 'missing' | 'failed';

export type RuntimeIntegrityItem = {
    id: string;
    label: string;
    path: string;
    required: boolean;
    exists: boolean;
    status: RuntimeIntegrityItemStatus;
    message?: string;
};

export type RuntimeIntegrityResult = {
    ok: boolean;
    checkedAt: string;
    appVersion: string;
    items: RuntimeIntegrityItem[];
    ffmpegDiagnostics?: {
        ok: boolean;
        ffmpegPath: string;
        ffprobePath: string;
        frei0rPath?: string;
        version?: string;
        supportsFrei0r?: boolean;
        missingFrei0rPlugins?: string[];
        failedFrei0rPlugins?: string[];
        message?: string;
    };
};

type PersistedRuntimeIntegrity = {
    appVersion: string;
    result: RuntimeIntegrityResult;
};

const RUNTIME_INTEGRITY_FILE = 'runtime_integrity.json';

const REQUIRED_RUNTIME_FILES = [
    {
        id: 'assetmanager-exe',
        label: 'AssetManager UnityPy executable',
        path: getResourcePath('tools', 'AssetManager', 'AssetManager_UnityPy.exe'),
    },
    {
        id: 'assetmanager-data-tsv',
        label: 'AssetManager texture metadata',
        path: getResourcePath('tools', 'AssetManager', 'metadata', 'data.tsv'),
    },
    {
        id: 'assetmanager-ui-textures-tsv',
        label: 'AssetManager UI texture metadata',
        path: getResourcePath('tools', 'AssetManager', 'metadata', 'ui_textures.tsv'),
    },
    {
        id: 'assetmanager-fonts-data-tsv',
        label: 'AssetManager font metadata',
        path: getResourcePath('tools', 'AssetManager', 'metadata', 'fonts_data.tsv'),
    },
    {
        id: 'ffmpeg-exe',
        label: 'FFmpeg executable',
        path: getResourcePath('tools', 'ffmpeg', process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'),
    },
    {
        id: 'ffprobe-exe',
        label: 'FFprobe executable',
        path: getResourcePath('tools', 'ffmpeg', process.platform === 'win32' ? 'ffprobe.exe' : 'ffprobe'),
    },
    {
        id: 'frei0r-select0r',
        label: 'frei0r select0r plugin',
        path: getResourcePath('tools', 'frei0r', 'filter', 'select0r.dll'),
    },
    {
        id: 'frei0r-keyspillm0pup',
        label: 'frei0r keyspillm0pup plugin',
        path: getResourcePath('tools', 'frei0r', 'filter', 'keyspillm0pup.dll'),
    },
    {
        id: 'frei0r-alpha0ps',
        label: 'frei0r alpha0ps plugin',
        path: getResourcePath('tools', 'frei0r', 'filter', 'alpha0ps_alpha0ps.dll'),
    },
    {
        id: 'frei0r-saturat0r',
        label: 'frei0r saturat0r plugin',
        path: getResourcePath('tools', 'frei0r', 'filter', 'saturat0r.dll'),
    },
];

function getIntegrityPath(): string {
    return getConfigPath(RUNTIME_INTEGRITY_FILE);
}

function readPersistedIntegrity(): PersistedRuntimeIntegrity | null {
    const filePath = getIntegrityPath();

    if (!fs.existsSync(filePath)) return null;

    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as PersistedRuntimeIntegrity;
    } catch {
        return null;
    }
}

function writePersistedIntegrity(result: RuntimeIntegrityResult): void {
    const filePath = getIntegrityPath();
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, `${JSON.stringify({ appVersion: result.appVersion, result }, null, 2)}\n`, 'utf-8');
}

function createFileItems(): RuntimeIntegrityItem[] {
    return REQUIRED_RUNTIME_FILES.map((file) => {
        const exists = fs.existsSync(file.path);

        return {
            ...file,
            required: true,
            exists,
            status: exists ? 'ok' : 'missing',
            message: exists ? undefined : 'Required runtime file is missing.',
        };
    });
}

function markItemFailed(items: RuntimeIntegrityItem[], id: string, message: string): void {
    const item = items.find((entry) => entry.id === id);

    if (!item || !item.exists) return;

    item.status = 'failed';
    item.message = message;
}

export function getRuntimeIntegrityStatus(): RuntimeIntegrityResult | null {
    return readPersistedIntegrity()?.result || null;
}

export async function checkRuntimeIntegrity(): Promise<RuntimeIntegrityResult> {
    const items = createFileItems();
    const ffmpegStatus = await checkFfmpeg();

    if (!ffmpegStatus.ok) {
        markItemFailed(items, 'ffmpeg-exe', ffmpegStatus.message || 'FFmpeg validation failed.');
    }

    if (ffmpegStatus.ok && !ffmpegStatus.supportsFrei0r) {
        markItemFailed(items, 'ffmpeg-exe', 'FFmpeg does not report frei0r filter support.');
    }

    if (ffmpegStatus.failedFrei0rPlugins?.includes('select0r.dll')) {
        markItemFailed(items, 'frei0r-select0r', 'FFmpeg could not load the select0r frei0r plugin.');
    }

    const result: RuntimeIntegrityResult = {
        ok: items.every((item) => item.status === 'ok')
            && Boolean(ffmpegStatus.ok)
            && ffmpegStatus.supportsFrei0r !== false
            && (ffmpegStatus.failedFrei0rPlugins?.length || 0) === 0,
        checkedAt: new Date().toISOString(),
        appVersion: app.getVersion(),
        items,
        ffmpegDiagnostics: {
            ok: Boolean(ffmpegStatus.ok)
                && ffmpegStatus.supportsFrei0r !== false
                && (ffmpegStatus.failedFrei0rPlugins?.length || 0) === 0,
            ffmpegPath: ffmpegStatus.ffmpegPath,
            ffprobePath: ffmpegStatus.ffprobePath,
            frei0rPath: ffmpegStatus.frei0rPath,
            version: ffmpegStatus.version,
            supportsFrei0r: ffmpegStatus.supportsFrei0r,
            missingFrei0rPlugins: ffmpegStatus.missingFrei0rPlugins,
            failedFrei0rPlugins: ffmpegStatus.failedFrei0rPlugins,
            message: ffmpegStatus.message,
        },
    };

    writePersistedIntegrity(result);

    return result;
}

export function registerRuntimeIntegrityIpc(): void {
    ipcMain.handle('runtime:get-integrity-status', () => getRuntimeIntegrityStatus());
    ipcMain.handle('runtime:check-integrity', () => checkRuntimeIntegrity());
}

export function scheduleRuntimeIntegrityAutoCheck(): void {
    if (!app.isPackaged) return;

    const persisted = readPersistedIntegrity();

    if (persisted?.appVersion === app.getVersion()) return;

    setTimeout(() => {
        checkRuntimeIntegrity().catch(() => {
            // The Settings page can still run a manual check and show the current failure details.
        });
    }, 1500);
}
