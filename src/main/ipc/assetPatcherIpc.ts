// src/main/ipc/assetPatcherIpc.ts
// Renderer의 asset patch 요청을 main process service로 전달합니다.

import { ipcMain } from 'electron';
import {
    importAssetPack,
    runClothesPatch,
    runFontExtract,
    runFontList,
    runFontPatch,
    runFontRestore
} from '../services/assetPatcherService';
import {
    updateCurrentFontsFromFontList,
    updateCurrentFontsFromJobs
} from '../services/assetService';

export function registerAssetPatcherIpc() {
    ipcMain.handle('asset:run-clothes-patch', async (_event, params) => {
        return runClothesPatch(params);
    });

    ipcMain.handle('asset:run-font-extract', async (_event, params) => {
        return runFontExtract(params);
    });

    ipcMain.handle('asset:run-font-patch', async (_event, params) => {
        const result = await runFontPatch(params);
        updateCurrentFontsFromJobs(params?.jobs || []);
        return result;
    });

    ipcMain.handle('asset:run-font-restore', async (_event, params) => {
        return runFontRestore(params);
    });

    ipcMain.handle('asset:run-font-list', async (_event, params) => {
        const result = await runFontList(params);
        updateCurrentFontsFromFontList(result.report?.fonts || []);
        return result;
    });

    ipcMain.handle('asset:import-pack', async (_event, zipPath: string) => {
        return importAssetPack(zipPath);
    });
}
