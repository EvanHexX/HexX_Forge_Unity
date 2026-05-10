import { app, BrowserWindow, ipcMain } from 'electron';
import log from 'electron-log';
import { autoUpdater, ProgressInfo, UpdateInfo } from 'electron-updater';

const PRERELEASE_VERSION_PATTERN = /-[0-9A-Za-z.-]+$/;

export type UpdateStatusState =
    | 'idle'
    | 'checking'
    | 'available'
    | 'not-available'
    | 'downloading'
    | 'downloaded'
    | 'error';

export type AppUpdateStatus = {
    state: UpdateStatusState;
    currentVersion: string;
    availableVersion?: string;
    releaseName?: string;
    releaseDate?: string;
    progress?: number;
    message?: string;
    error?: string;
    isPackaged: boolean;
};

let updateStatus: AppUpdateStatus = {
    state: 'idle',
    currentVersion: app.getVersion(),
    isPackaged: app.isPackaged
};

let hasAvailableUpdate = false;
let hasDownloadedUpdate = false;

function normalizeInfo(info?: UpdateInfo): Partial<AppUpdateStatus> {
    if (!info) return {};

    return {
        availableVersion: info.version,
        releaseName: info.releaseName || undefined,
        releaseDate: info.releaseDate || undefined
    };
}

function broadcastStatus(): void {
    for (const window of BrowserWindow.getAllWindows()) {
        window.webContents.send('updates:status', updateStatus);
    }
}

function setStatus(nextStatus: Partial<AppUpdateStatus>): AppUpdateStatus {
    updateStatus = {
        ...updateStatus,
        ...nextStatus,
        currentVersion: app.getVersion(),
        isPackaged: app.isPackaged
    };

    broadcastStatus();

    return updateStatus;
}

function getPackagedOnlyStatus(): AppUpdateStatus {
    return setStatus({
        state: 'idle',
        progress: undefined,
        message: 'Updates are available only in packaged builds.',
        error: undefined
    });
}

function configureAutoUpdater(): void {
    log.transports.file.level = 'info';

    autoUpdater.logger = log;
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = false;
    autoUpdater.allowPrerelease = PRERELEASE_VERSION_PATTERN.test(app.getVersion());

    autoUpdater.on('checking-for-update', () => {
        setStatus({
            state: 'checking',
            progress: undefined,
            message: `Checking for updates... Logs: ${log.transports.file.getFile().path}`,
            error: undefined
        });
    });

    autoUpdater.on('update-available', (info) => {
        hasAvailableUpdate = true;
        hasDownloadedUpdate = false;

        setStatus({
            state: 'available',
            ...normalizeInfo(info),
            progress: undefined,
            message: 'An update is available.',
            error: undefined
        });
    });

    autoUpdater.on('update-not-available', (info) => {
        hasAvailableUpdate = false;
        hasDownloadedUpdate = false;

        setStatus({
            state: 'not-available',
            ...normalizeInfo(info),
            progress: undefined,
            message: 'You are using the latest version.',
            error: undefined
        });
    });

    autoUpdater.on('download-progress', (progress: ProgressInfo) => {
        setStatus({
            state: 'downloading',
            progress: Math.round(progress.percent),
            message: 'Downloading update...',
            error: undefined
        });
    });

    autoUpdater.on('update-downloaded', (info) => {
        hasDownloadedUpdate = true;

        setStatus({
            state: 'downloaded',
            ...normalizeInfo(info),
            progress: 100,
            message: 'Update downloaded. Restart to install.',
            error: undefined
        });
    });

    autoUpdater.on('error', (error) => {
        setStatus({
            state: 'error',
            progress: undefined,
            message: 'Update failed.',
            error: error instanceof Error ? error.message : String(error)
        });
    });
}

export function registerUpdateIpc(): void {
    configureAutoUpdater();

    ipcMain.handle('updates:get-status', () => updateStatus);

    ipcMain.handle('updates:check', async () => {
        if (!app.isPackaged) {
            return getPackagedOnlyStatus();
        }

        hasAvailableUpdate = false;
        hasDownloadedUpdate = false;

        await autoUpdater.checkForUpdates();

        return updateStatus;
    });

    ipcMain.handle('updates:download', async () => {
        if (!app.isPackaged) {
            return getPackagedOnlyStatus();
        }

        if (!hasAvailableUpdate) {
            return setStatus({
                state: 'idle',
                progress: undefined,
                message: 'Check for updates before downloading.',
                error: undefined
            });
        }

        await autoUpdater.downloadUpdate();

        return updateStatus;
    });

    ipcMain.handle('updates:install', () => {
        if (!app.isPackaged) {
            return getPackagedOnlyStatus();
        }

        if (!hasDownloadedUpdate) {
            return setStatus({
                state: 'idle',
                message: 'Download an update before installing.',
                error: undefined
            });
        }

        setImmediate(() => {
            autoUpdater.quitAndInstall(false, true);
        });

        return updateStatus;
    });
}
