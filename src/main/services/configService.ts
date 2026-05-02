// src/main/services/configService.ts
// HexX Forge 설정 파일과 테마 파일을 읽고 저장하는 서비스입니다.

import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';

// 개발: 프로젝트 루트/config  |  패키지: exe 옆/config
const CONFIG_DIR = app.isPackaged
    ? path.join(path.dirname(app.getPath('exe')), 'config')
    : path.join(process.cwd(), 'config');

const SETTINGS_PATH = path.join(CONFIG_DIR, 'app_settings.json');
const THEMES_PATH = path.join(CONFIG_DIR, 'themes.json');

export type AppSettings = {
    theme: string;
    gamePath: string;
};

export type ThemeMap = Record<string, Record<string, string>>;

function ensureConfigDir(): void {
    if (!fs.existsSync(CONFIG_DIR)) {
        fs.mkdirSync(CONFIG_DIR, {recursive: true});
    }
}

export function readJsonFile<T>(filePath: string, fallback: T): T {
    try {
        if (!fs.existsSync(filePath)) {
            return fallback;
        }

        const raw = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(raw) as T;
    } catch {
        return fallback;
    }
}

export function writeJsonFile<T>(filePath: string, data: T): void {
    ensureConfigDir();
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

export function getAppSettings(): AppSettings {
    return readJsonFile<AppSettings>(SETTINGS_PATH, {
        theme: 'default',
        gamePath: ''
    });
}

export function saveAppSettings(settings: AppSettings): AppSettings {
    writeJsonFile(SETTINGS_PATH, settings);
    return settings;
}

export function getThemes(): ThemeMap {
    return readJsonFile<ThemeMap>(THEMES_PATH, {});
}

export function setTheme(themeName: string): AppSettings {
    const current = getAppSettings();
    const next = {
        ...current,
        theme: themeName
    };

    return saveAppSettings(next);
}

export function setGamePath(gamePath: string): AppSettings {
    const current = getAppSettings();

    const next = {
        ...current,
        gamePath
    };

    return saveAppSettings(next);
}


