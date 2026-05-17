// src/main/ipc/assetIpc.ts

import {ipcMain} from 'electron';
import {
    backup,
    clearCurrentAssetPacks,
    getCatalogEditorData,
    getAssetCatalog,
    getBackupStatus,
    getCurrentAssetPacks,
    getFontTargets,
    getStoredFonts,
    importCatalogPreviewImage,
    importFont,
    restoreBackup,
    saveCatalogEditorData,
    saveCurrentAssetPacks,
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

    ipcMain.handle('asset:get-catalog-editor-data', () => {
        return getCatalogEditorData();
    });

    ipcMain.handle('asset:save-catalog-editor-data', (_event, catalog) => {
        return saveCatalogEditorData(catalog);
    });

    ipcMain.handle('asset:get-current-asset-packs', () => {
        return getCurrentAssetPacks();
    });

    ipcMain.handle('asset:save-current-asset-packs', (_event, entries) => {
        return saveCurrentAssetPacks(entries);
    });

    ipcMain.handle('asset:clear-current-asset-packs', () => {
        return clearCurrentAssetPacks();
    });

    ipcMain.handle('asset:import-catalog-preview-image', (_event, params) => {
        return importCatalogPreviewImage(params);
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
