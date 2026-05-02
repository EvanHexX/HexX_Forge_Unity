// src/main/ipc/assetIpc.ts

import {ipcMain} from 'electron';
import {
    backup,
    getAssetCatalog,
    getBackupStatus,
    selectReplacementImage
} from '../services/assetService';

export function registerAssetIpc() {
    ipcMain.handle('asset:get-status', () => {
        return getBackupStatus();
    });

    ipcMain.handle('asset:backup', (_e, type: 'font' | 'asset') => {
        return backup(type);
    });

    ipcMain.handle('asset:get-catalog', () => {
        return getAssetCatalog();
    });

    ipcMain.handle('asset:select-replacement-image', () => {
        return selectReplacementImage();
    });
}