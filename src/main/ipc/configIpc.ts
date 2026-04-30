// src/main/ipc/configIpc.ts
// 설정 및 테마 관련 IPC 핸들러입니다.

import {dialog, ipcMain} from 'electron';
import {
    getAppSettings,
    getThemes,
    setGamePath,
    setTheme
} from '../services/configService';

export function registerConfigIpc(): void {
    ipcMain.handle('config:get-settings', () => getAppSettings());
    ipcMain.handle('config:get-themes', () => getThemes());
    ipcMain.handle('config:set-theme', (_event, themeName: string) => setTheme(themeName));
    ipcMain.handle('config:set-game-path', (_event, gamePath: string) => setGamePath(gamePath));

    ipcMain.handle('dialog:select-directory', async () => {
        const result = await dialog.showOpenDialog({
            title: '게임 설치 폴더 선택',
            properties: ['openDirectory']
        });

        if (result.canceled || result.filePaths.length === 0) {
            return null;
        }

        return result.filePaths[0];
    });
}