// src/main/ipc/assetIpc.ts

import {ipcMain} from 'electron';
import {
    backup,
    getAssetCatalog,
    getBackupStatus,
    getFontTargets,
    getStoredFonts,
    importFont,
    restoreBackup,
    selectReplacementImage
} from '../services/assetService';

export function registerAssetIpc() {
    ipcMain.handle('asset:get-status', () => {
        return getBackupStatus();
    });

    ipcMain.handle('asset:backup', (_e, type: 'font' | 'asset') => {
        return backup(type);
    });

    ipcMain.handle('asset:restore-backup', (_e, type: 'font' | 'asset') => {
        return restoreBackup(type);
    });

    ipcMain.handle('asset:get-catalog', () => {
        return getAssetCatalog();
    });

    ipcMain.handle('asset:get-font-targets', () => {
        return getFontTargets();
    });

    ipcMain.handle('asset:get-stored-fonts', () => {
        return getStoredFonts();
    });

    ipcMain.handle('asset:import-font', (_event, sourcePath: string) => {
        return importFont(sourcePath);
    });

    ipcMain.handle('asset:select-replacement-image', () => {
        return selectReplacementImage();
    });
}
