import { app } from 'electron';
import path from 'node:path';

export function getAppRootDir(): string {
    return app.isPackaged ? process.resourcesPath : process.cwd();
}

export function getBundledConfigDir(): string {
    return path.join(getAppRootDir(), 'config');
}

export function getWritableConfigDir(): string {
    return app.isPackaged
        ? path.join(app.getPath('userData'), 'config')
        : path.join(process.cwd(), 'config');
}

export function getConfigPath(fileName: string): string {
    return path.join(getWritableConfigDir(), fileName);
}

export function getBundledConfigPath(fileName: string): string {
    return path.join(getBundledConfigDir(), fileName);
}

export function getResourcesDir(): string {
    return path.join(getAppRootDir(), 'resources');
}

export function getResourcePath(...segments: string[]): string {
    return path.join(getResourcesDir(), ...segments);
}

export function getStorageDir(): string {
    return app.isPackaged
        ? path.join(app.getPath('userData'), 'storage')
        : path.join(process.cwd(), 'storage');
}

export function getStoragePath(...segments: string[]): string {
    return path.join(getStorageDir(), ...segments);
}

export function getBundledStorageDir(): string {
    return path.join(getAppRootDir(), 'storage');
}

export function getBundledStoragePath(...segments: string[]): string {
    return path.join(getBundledStorageDir(), ...segments);
}
