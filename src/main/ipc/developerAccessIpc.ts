import { ipcMain } from 'electron';
import {
    getDeveloperAccessStatus,
    verifyDeveloperPassword
} from '../services/developerAccessService';

export function registerDeveloperAccessIpc(): void {
    ipcMain.handle('developer:get-access-status', () => {
        return getDeveloperAccessStatus();
    });

    ipcMain.handle('developer:verify-password', (_event, password: string) => {
        return verifyDeveloperPassword(password);
    });
}
