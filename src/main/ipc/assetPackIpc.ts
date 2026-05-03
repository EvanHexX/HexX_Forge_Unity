// src/main/ipc/assetPackIpc.ts
// Asset Pack 관련 IPC 핸들러입니다.

import { dialog, ipcMain } from 'electron';
import { getAssetPacks, importAssetPack } from '../services/assetPackService';

export function registerAssetPackIpc(): void {
    ipcMain.handle('asset:get-packs', () => {
        return getAssetPacks();
    });

    ipcMain.handle('asset:select-pack-zip', async () => {
        const result = await dialog.showOpenDialog({
            title: 'Asset Pack ZIP 선택',
            properties: ['openFile'],
            filters: [{ name: 'Asset Pack ZIP', extensions: ['zip'] }]
        });

        if (result.canceled || result.filePaths.length === 0) {
            return null;
        }

        return result.filePaths[0];
    });

}