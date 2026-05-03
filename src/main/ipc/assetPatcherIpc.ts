// src/main/ipc/assetPatcherIpc.ts
// Renderer의 asset patch 요청을 main process service로 전달합니다.

import { ipcMain } from 'electron';
import { importAssetPack, runClothesPatch } from '../services/assetPatcherService';

export function registerAssetPatcherIpc() {
    ipcMain.handle('asset:run-clothes-patch', async (_event, params) => {
        return runClothesPatch(params);
    });

    ipcMain.handle('asset:import-pack', async (_event, zipPath: string) => {
        return importAssetPack(zipPath);
    });
}
