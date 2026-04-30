// src/main/ipc/modIpc.ts
// 모드 관리자 IPC 핸들러입니다.

import { dialog, ipcMain } from 'electron';
import {
    deleteMod,
    importDllMod,
    importZipMod,
    scanMods,
    setModEnabled
} from '../services/modService';

export function registerModIpc(): void {
    ipcMain.handle('mods:scan', () => scanMods());

    ipcMain.handle('mods:set-enabled', (_event, relativePath: string, enabled: boolean) => {
        return setModEnabled(relativePath, enabled);
    });

    ipcMain.handle('mods:delete', (_event, relativePath: string) => {
        return deleteMod(relativePath);
    });

    ipcMain.handle('mods:select-import-file', async () => {
        const result = await dialog.showOpenDialog({
            title: '모드 파일 선택',
            properties: ['openFile'],
            filters: [
                { name: 'Mod File', extensions: ['dll', 'zip'] },
                { name: 'DLL', extensions: ['dll'] },
                { name: 'ZIP', extensions: ['zip'] }
            ]
        });

        if (result.canceled || result.filePaths.length === 0) {
            return null;
        }

        return result.filePaths[0];
    });

    ipcMain.handle('mods:import-dll', (_event, filePath: string, name: string, author: string) => {
        return importDllMod(filePath, name, author);
    });

    ipcMain.handle('mods:import-zip', (_event, filePath: string) => {
        return importZipMod(filePath);
    });
}