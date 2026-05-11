import { ipcMain } from 'electron';
import {
    checkFfmpeg,
    createPortraitLoop,
    exportPortraitImage,
    exportPortraitVideo,
    getGraphicsAssets,
    getGraphicsConfig,
    resolveDroppedGraphicsFile,
    selectGraphicsImage,
    selectGraphicsVideo,
} from '../services/graphicsService';

export function registerGraphicsIpc(): void {
    ipcMain.handle('graphics:get-assets', () => getGraphicsAssets());
    ipcMain.handle('graphics:get-config', () => getGraphicsConfig());
    ipcMain.handle('graphics:select-video', () => selectGraphicsVideo());
    ipcMain.handle('graphics:select-image', () => selectGraphicsImage());
    ipcMain.handle('graphics:resolve-dropped-file', (_event, params) => resolveDroppedGraphicsFile(params));
    ipcMain.handle('graphics:check-ffmpeg', () => checkFfmpeg());
    ipcMain.handle('graphics:create-loop', (event, params) => createPortraitLoop(params, event.sender));
    ipcMain.handle('graphics:export-video', (event, params) => exportPortraitVideo(params, event.sender));
    ipcMain.handle('graphics:export-image', (_event, params) => exportPortraitImage(params));
}
