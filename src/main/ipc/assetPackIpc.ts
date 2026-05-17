// src/main/ipc/assetPackIpc.ts
// Asset Pack 관련 IPC 핸들러입니다.

import { dialog, ipcMain, nativeImage } from 'electron';
import path from 'node:path';
import {
    createAssetPackDistribution,
    deleteAssetPackDistributionItem,
    getAssetPackDistributionCatalog,
    getAssetPacks,
    getOnlineAssetPackCatalog,
    installOnlineAssetPack,
    updateOnlineAssetPack,
    type AssetPackDistributionInput,
    type OnlineAssetPackCatalogItem
} from '../services/assetPackService';

export function registerAssetPackIpc(): void {
    ipcMain.handle('asset:get-packs', () => {
        return getAssetPacks();
    });

    ipcMain.handle('asset:get-online-packs', () => {
        return getOnlineAssetPackCatalog();
    });

    ipcMain.handle('asset:download-online-pack', (_event, item: OnlineAssetPackCatalogItem) => {
        return installOnlineAssetPack(item);
    });

    ipcMain.handle('asset:update-online-pack', (_event, item: OnlineAssetPackCatalogItem) => {
        return updateOnlineAssetPack(item);
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

    ipcMain.handle('asset:select-pack-thumbnail', async () => {
        const result = await dialog.showOpenDialog({
            title: 'Asset Pack thumbnail PNG 선택',
            properties: ['openFile'],
            filters: [{ name: 'PNG', extensions: ['png'] }]
        });

        if (result.canceled || result.filePaths.length === 0) {
            return null;
        }

        return result.filePaths[0];
    });

    ipcMain.handle('asset:select-pack-pngs', async () => {
        const result = await dialog.showOpenDialog({
            title: 'Asset Pack PNG 선택',
            properties: ['openFile', 'multiSelections'],
            filters: [{ name: 'PNG', extensions: ['png'] }]
        });

        if (result.canceled || result.filePaths.length === 0) {
            return [];
        }

        return result.filePaths.map((filePath) => {
            const image = nativeImage.createFromPath(filePath);
            const size = image.isEmpty() ? undefined : image.getSize();
            return {
                path: filePath,
                name: path.basename(filePath),
                url: `file://${filePath.replaceAll('\\', '/')}`,
                size: size ? [size.width, size.height] : undefined
            };
        });
    });

    ipcMain.handle('asset:create-pack-distribution', (_event, input: AssetPackDistributionInput) => {
        return createAssetPackDistribution(input);
    });

    ipcMain.handle('asset:get-pack-distribution-catalog', () => {
        return getAssetPackDistributionCatalog();
    });

    ipcMain.handle('asset:delete-pack-distribution-item', (_event, id: string) => {
        return deleteAssetPackDistributionItem(id);
    });
}
