import { ipcMain } from 'electron';
import { runClothesPatch } from '../services/assetPatcherService';

export function registerAssetPatcherIpc() {
    ipcMain.handle('asset:run-clothes-patch', (_e, params) => {
        return runClothesPatch(params);
    });
    ipcMain.handle('asset:import-pack', (_e, zipPath) => {
        return importAssetPack(zipPath);
    });
}