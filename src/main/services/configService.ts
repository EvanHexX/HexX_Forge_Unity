// src/main/services/configService.ts
// HexX Forge 설정 파일과 테마 파일을 읽고 저장하는 서비스입니다.

import fs from 'node:fs';
import path from 'node:path';
import {
    getBundledConfigPath,
    getConfigPath,
    getWritableConfigDir
} from './runtimePaths';

// 개발: 프로젝트 루트/config  |  패키지: exe 옆/config
const CONFIG_DIR = getWritableConfigDir();

const SETTINGS_PATH = getConfigPath('app_settings.json');
const THEMES_PATH = getConfigPath('themes.json');
const TYPOGRAPHY_PATH = getConfigPath('typography.json');

export type AppSettings = {
    theme: string;
    typography: string;
    language: LanguageCode;
    selectedGameId: string;
    gamePaths: Record<string, string>;
    gamePath: string;
};

export type ThemeDefinition = {
    displayName: string;
    variables: Record<string, string>;
};

export type ThemeMap = Record<string, ThemeDefinition | Record<string, string>>;

export type TypographyOption = {
    key: string;
    displayName: string;
    fontFamily: string;
};

export type SupportedGame = {
    id: string;
    displayName: string;
    installFolderHint: string;
};

export const DEFAULT_GAME_ID = 'long-yin-li-zhi-zhuan';
export const DEFAULT_LANGUAGE = 'en';
export type LanguageCode = 'en' | 'ko' | 'zh-CN';

const SUPPORTED_LANGUAGES: LanguageCode[] = [DEFAULT_LANGUAGE, 'ko', 'zh-CN'];

const SUPPORTED_GAMES: SupportedGame[] = [
    {
        id: DEFAULT_GAME_ID,
        displayName: '용윤입지전',
        installFolderHint: 'LongYinLiZhiZhuan 폴더'
    }
];

function ensureConfigDir(): void {
    if (!fs.existsSync(CONFIG_DIR)) {
        fs.mkdirSync(CONFIG_DIR, {recursive: true});
    }
}

function getBundledFallbackPath(filePath: string): string {
    const configDir = path.resolve(CONFIG_DIR);
    const resolvedFilePath = path.resolve(filePath);

    if (resolvedFilePath === configDir || !resolvedFilePath.startsWith(`${configDir}${path.sep}`)) {
        return '';
    }

    return getBundledConfigPath(path.relative(configDir, resolvedFilePath));
}

export function readJsonFile<T>(filePath: string, fallback: T): T {
    try {
        const readPath = fs.existsSync(filePath) ? filePath : getBundledFallbackPath(filePath);

        if (!readPath || !fs.existsSync(readPath)) {
            return fallback;
        }

        const raw = fs.readFileSync(readPath, 'utf-8');
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
    const rawSettings = readJsonFile<Partial<AppSettings>>(SETTINGS_PATH, {
        theme: 'default',
        typography: 'default',
        language: DEFAULT_LANGUAGE,
        selectedGameId: DEFAULT_GAME_ID,
        gamePaths: {},
        gamePath: ''
    });

    const selectedGameId = rawSettings.selectedGameId || DEFAULT_GAME_ID;
    const gamePaths = {
        ...(rawSettings.gamePaths || {})
    };

    if (!gamePaths[selectedGameId] && rawSettings.gamePath) {
        gamePaths[selectedGameId] = rawSettings.gamePath;
    }

    const gamePath = gamePaths[selectedGameId] || rawSettings.gamePath || '';

    return {
        theme: rawSettings.theme || 'default',
        typography: rawSettings.typography || 'default',
        language: isSupportedLanguage(rawSettings.language) ? rawSettings.language : DEFAULT_LANGUAGE,
        selectedGameId,
        gamePaths,
        gamePath
    };
}

export function saveAppSettings(settings: AppSettings): AppSettings {
    writeJsonFile(SETTINGS_PATH, settings);
    return settings;
}

export function getThemes(): ThemeMap {
    return readJsonFile<ThemeMap>(THEMES_PATH, {});
}

export function getTypographyOptions(): TypographyOption[] {
    return readJsonFile<TypographyOption[]>(TYPOGRAPHY_PATH, [
        {
            key: 'default',
            displayName: 'Default',
            fontFamily: 'Pretendard, "Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, sans-serif'
        }
    ]);
}

export function getSupportedGames(): SupportedGame[] {
    return SUPPORTED_GAMES;
}

export function setTheme(themeName: string): AppSettings {
    const current = getAppSettings();
    const next = {
        ...current,
        theme: themeName
    };

    return saveAppSettings(next);
}

export function setTypography(typography: string): AppSettings {
    const current = getAppSettings();

    const next = {
        ...current,
        typography
    };

    return saveAppSettings(next);
}

function isSupportedLanguage(language: unknown): language is LanguageCode {
    return typeof language === 'string' && SUPPORTED_LANGUAGES.includes(language as LanguageCode);
}

export function setLanguage(language: string): AppSettings {
    const current = getAppSettings();

    const next = {
        ...current,
        language: isSupportedLanguage(language) ? language : DEFAULT_LANGUAGE
    };

    return saveAppSettings(next);
}

export function setSelectedGame(selectedGameId: string): AppSettings {
    const current = getAppSettings();
    const safeGameId = SUPPORTED_GAMES.some((game) => game.id === selectedGameId)
        ? selectedGameId
        : DEFAULT_GAME_ID;

    const next = {
        ...current,
        selectedGameId: safeGameId,
        gamePath: current.gamePaths[safeGameId] || ''
    };

    return saveAppSettings(next);
}

export function setGamePath(gamePath: string, gameId?: string): AppSettings {
    const current = getAppSettings();
    const selectedGameId = gameId || current.selectedGameId || DEFAULT_GAME_ID;

    const next = {
        ...current,
        selectedGameId,
        gamePaths: {
            ...current.gamePaths,
            [selectedGameId]: gamePath
        },
        gamePath
    };

    return saveAppSettings(next);
}

