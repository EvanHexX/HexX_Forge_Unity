// src/main/services/modService.ts
// BepInEx/plugins 하위 DLL 모드를 재귀 스캔하고 활성/비활성/추가/삭제를 처리합니다.

import fs from 'node:fs';
import path from 'node:path';
import AdmZip from 'adm-zip';
import { getAppSettings, readJsonFile, writeJsonFile } from './configService';

const ROOT_DIR = process.cwd();
const STORAGE_DIR = path.join(ROOT_DIR, 'storage');
const DISABLED_MODS_DIR = path.join(STORAGE_DIR, 'disabled_mods');
const MOD_LIST_PATH = path.join(ROOT_DIR, 'config', 'mod_list.json');

type ModMeta = {
    name?: string;
    author?: string;
    description?: string;
};

type ModList = Record<string, ModMeta>;

export type ModInfo = {
    fileName: string;
    relativePath: string;
    displayName: string;
    author: string;
    enabled: boolean;
    sourcePath: string;
};

type HexXModInfo = {
    name?: string;
    author?: string;
    description?: string;
    files?: Array<{
        path: string;
        name?: string;
        author?: string;
        description?: string;
    }>;
};

function ensureDirs(): void {
    if (!fs.existsSync(DISABLED_MODS_DIR)) {
        fs.mkdirSync(DISABLED_MODS_DIR, { recursive: true });
    }
}

function getPluginsDir(): string {
    const { gamePath } = getAppSettings();
    if (!gamePath) return '';
    return path.join(gamePath, 'BepInEx', 'plugins');
}

function readModList(): ModList {
    return readJsonFile<ModList>(MOD_LIST_PATH, {});
}

function saveModList(modList: ModList): void {
    writeJsonFile(MOD_LIST_PATH, modList);
}

function normalizeRelativePath(value: string): string {
    return value.replaceAll('\\', '/');
}

function listDllsRecursive(rootDir: string): Array<{ fileName: string; relativePath: string; fullPath: string }> {
    if (!rootDir || !fs.existsSync(rootDir)) return [];

    const results: Array<{ fileName: string; relativePath: string; fullPath: string }> = [];

    function walk(currentDir: string): void {
        for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
            const fullPath = path.join(currentDir, entry.name);

            if (entry.isDirectory()) {
                walk(fullPath);
                continue;
            }

            if (entry.isFile() && entry.name.toLowerCase().endsWith('.dll')) {
                results.push({
                    fileName: entry.name,
                    relativePath: normalizeRelativePath(path.relative(rootDir, fullPath)),
                    fullPath
                });
            }
        }
    }

    walk(rootDir);
    return results;
}

function ensureParentDir(filePath: string): void {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

function moveFileCrossDeviceSafe(from: string, to: string): void {
    ensureParentDir(to);

    try {
        fs.renameSync(from, to);
    } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;

        if (code !== 'EXDEV') {
            throw error;
        }

        fs.copyFileSync(from, to);
        fs.unlinkSync(from);
    }
}

export function scanMods(): ModInfo[] {
    ensureDirs();

    const pluginsDir = getPluginsDir();
    const modList = readModList();

    const enabledDlls = listDllsRecursive(pluginsDir).map((item) => ({
        fileName: item.fileName,
        relativePath: item.relativePath,
        enabled: true,
        sourcePath: item.fullPath
    }));

    const disabledDlls = listDllsRecursive(DISABLED_MODS_DIR).map((item) => ({
        fileName: item.fileName,
        relativePath: item.relativePath,
        enabled: false,
        sourcePath: item.fullPath
    }));

    return [...enabledDlls, ...disabledDlls]
        .sort((a, b) => a.relativePath.localeCompare(b.relativePath))
        .map((mod) => {
            const meta = modList[mod.relativePath] ?? modList[mod.fileName] ?? {};

            return {
                ...mod,
                displayName: meta.name || mod.fileName,
                author: meta.author || ''
            };
        });
}

export function setModEnabled(relativePath: string, enabled: boolean): ModInfo[] {
    ensureDirs();

    const pluginsDir = getPluginsDir();
    if (!pluginsDir) {
        throw new Error('게임 경로가 설정되지 않았습니다.');
    }

    if (!fs.existsSync(pluginsDir)) {
        throw new Error(`BepInEx plugins 폴더가 없습니다: ${pluginsDir}`);
    }

    const safeRelativePath = normalizeRelativePath(relativePath);

    const from = enabled
        ? path.join(DISABLED_MODS_DIR, safeRelativePath)
        : path.join(pluginsDir, safeRelativePath);

    const to = enabled
        ? path.join(pluginsDir, safeRelativePath)
        : path.join(DISABLED_MODS_DIR, safeRelativePath);

    if (!fs.existsSync(from)) {
        throw new Error(`이동할 DLL 파일이 없습니다: ${from}`);
    }

    moveFileCrossDeviceSafe(from, to);

    return scanMods();
}

export function deleteMod(relativePath: string): ModInfo[] {
    const pluginsDir = getPluginsDir();
    const safeRelativePath = normalizeRelativePath(relativePath);

    const enabledPath = pluginsDir ? path.join(pluginsDir, safeRelativePath) : '';
    const disabledPath = path.join(DISABLED_MODS_DIR, safeRelativePath);

    if (enabledPath && fs.existsSync(enabledPath)) {
        fs.unlinkSync(enabledPath);
    } else if (fs.existsSync(disabledPath)) {
        fs.unlinkSync(disabledPath);
    } else {
        throw new Error(`삭제할 모드 파일이 없습니다: ${safeRelativePath}`);
    }

    return scanMods();
}

export function importDllMod(filePath: string, name: string, author: string): ModInfo[] {
    ensureDirs();

    const fileName = path.basename(filePath);
    const relativePath = normalizeRelativePath(fileName);
    const targetPath = path.join(DISABLED_MODS_DIR, relativePath);

    if (!fileName.toLowerCase().endsWith('.dll')) {
        throw new Error('DLL 파일만 등록할 수 있습니다.');
    }

    fs.copyFileSync(filePath, targetPath);

    const modList = readModList();
    modList[relativePath] = {
        name: name || fileName,
        author: author || ''
    };
    saveModList(modList);

    return scanMods();
}

export function importZipMod(filePath: string): ModInfo[] {
    ensureDirs();

    const zip = new AdmZip(filePath);
    const entries = zip.getEntries();

    const infoEntry = entries.find((entry) => {
        const name = entry.entryName.toLowerCase();
        return name.endsWith('hexx-mod-info.json') || name.endsWith('mod-info.json');
    });

    let info: HexXModInfo = {};

    if (infoEntry) {
        info = JSON.parse(infoEntry.getData().toString('utf-8')) as HexXModInfo;
    }

    const dllEntries = entries.filter((entry) => {
        return !entry.isDirectory && entry.entryName.toLowerCase().endsWith('.dll');
    });

    if (dllEntries.length === 0) {
        throw new Error('ZIP 안에 DLL 파일이 없습니다.');
    }

    const modList = readModList();

    for (const entry of dllEntries) {
        const relativePath = normalizeRelativePath(entry.entryName);
        const targetPath = path.join(DISABLED_MODS_DIR, relativePath);
        ensureParentDir(targetPath);
        fs.writeFileSync(targetPath, entry.getData());

        const fileMeta = info.files?.find((file) => normalizeRelativePath(file.path) === relativePath);

        modList[relativePath] = {
            name: fileMeta?.name || info.name || path.basename(relativePath),
            author: fileMeta?.author || info.author || '',
            description: fileMeta?.description || info.description || ''
        };
    }

    saveModList(modList);

    return scanMods();
}