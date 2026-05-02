// src/main/services/assetService.ts
// Asset 백업 및 상태 확인 서비스

import fs from 'node:fs';
import path from 'node:path';
import {getAppSettings, readJsonFile} from './configService';
import {pathToFileURL} from 'node:url';

const ROOT_DIR = process.cwd();
const CONFIG_PATH = path.join(ROOT_DIR, 'config', 'asset_config.json');
const BACKUP_ROOT = path.join(ROOT_DIR, 'storage', 'backups');
const ASSET_CATALOG_PATH = path.join(ROOT_DIR, 'config', 'asset_catalog.json');

type AssetCatalogItem = {
    id: string;
    gender: string;
    type: string;
    label: string;
    textureName: string;
    pathId: number;
    preview?: string;
};

type AssetConfig = {
    backupTargets: {
        font: string[];
        asset: string[];
    };
};

export function getAssetCatalog() {
    const catalog = readJsonFile<{ items: AssetCatalogItem[] }>(ASSET_CATALOG_PATH, {
        items: []
    });

    return {
        items: catalog.items.map((item) => {
            const previewPath = item.preview ? path.join(ROOT_DIR, item.preview) : '';

            return {
                ...item,
                previewUrl: previewPath && fs.existsSync(previewPath)
                    ? pathToFileURL(previewPath).toString()
                    : ''
            };
        })
    };
}

export async function selectReplacementImage() {
    const {dialog} = await import('electron');

    const result = await dialog.showOpenDialog({
        title: '변경 PNG 또는 미리보기 이미지 선택',
        properties: ['openFile'],
        filters: [
            {name: 'Image', extensions: ['png', 'jpg', 'jpeg', 'webp']}
        ]
    });

    if (result.canceled || result.filePaths.length === 0) {
        return null;
    }

    const filePath = result.filePaths[0];

    return {
        path: filePath,
        url: pathToFileURL(filePath).toString()
    };
}

function getConfig(): AssetConfig {
    return readJsonFile<AssetConfig>(CONFIG_PATH, {
        backupTargets: {font: [], asset: []}
    });
}

function getTimestamp(): string {
    const d = new Date();
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}_${d.getHours()}${d.getMinutes()}${d.getSeconds()}`;
}

function ensureDir(p: string) {
    if (!fs.existsSync(p)) {
        fs.mkdirSync(p, {recursive: true});
    }
}

function getGamePath(): string {
    const {gamePath} = getAppSettings();
    if (!gamePath) throw new Error('게임 경로가 설정되지 않았습니다.');
    return gamePath;
}

function resolveGameFile(relativePath: string): string {
    return path.join(getGamePath(), relativePath);
}

const CATALOG_PATH = path.join(ROOT_DIR, 'config', 'texture_catalog.csv');

export type TextureItem = {
    gender: string;
    type: string;
    texture_name: string;
    pathID: number;
};

export function getTextureCatalog(): TextureItem[] {
    if (!fs.existsSync(CATALOG_PATH)) return [];

    const text = fs.readFileSync(CATALOG_PATH, 'utf-8');
    return text
        .split('\n')
        .slice(1)
        .filter(Boolean)
        .map((row) => {
            const [gender, type, texture_name, pathID] = row.trim().split(',');
            return {gender, type, texture_name, pathID: Number(pathID)};
        });
}

export function getBackupStatus() {
    const fontDir = path.join(BACKUP_ROOT, 'font');
    const assetDir = path.join(BACKUP_ROOT, 'asset');

    const getLatest = (dir: string) => {
        if (!fs.existsSync(dir)) return null;

        const list = fs.readdirSync(dir);
        if (list.length === 0) return null;

        return list.sort().reverse()[0];
    };

    return {
        font: getLatest(fontDir),
        asset: getLatest(assetDir)
    };
}

export function backup(type: 'font' | 'asset') {
    const config = getConfig();
    const targets = config.backupTargets[type];

    if (!targets || targets.length === 0) {
        throw new Error(`${type} 백업 대상이 없습니다.`);
    }

    const timestamp = getTimestamp();
    const baseDir = path.join(BACKUP_ROOT, type, timestamp);

    ensureDir(baseDir);

    for (const rel of targets) {
        const src = resolveGameFile(rel);
        if (!fs.existsSync(src)) continue;

        const dest = path.join(baseDir, rel);
        ensureDir(path.dirname(dest));

        fs.copyFileSync(src, dest);
    }

    return getBackupStatus();
}