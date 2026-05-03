// src/main/services/assetPackService.ts
// Asset Pack ZIP 등록, pack.json 파싱, pack 목록 조회 서비스입니다.

import AdmZip from 'adm-zip';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT_DIR = process.cwd();
const PACK_ROOT = path.join(ROOT_DIR, 'storage', 'asset_packs');

type AssetPackTargetRaw = {
    catalogId: string;
    textureName: string;
    pathId: number;
    gender: string;
    category: string;
    option2: string;
    png: string;
    preview?: string;
};

type AssetPackRaw = {
    schemaVersion: number;
    packId: string;
    packName: string;
    author?: string;
    description?: string;
    targets: AssetPackTargetRaw[];
};

export type AssetPackTarget = AssetPackTargetRaw & {
    id: string;
    pngPath: string;
    pngUrl: string;
    previewPath: string;
    previewUrl: string;
};

export type AssetPack = Omit<AssetPackRaw, 'targets'> & {
    basePath: string;
    targets: AssetPackTarget[];
};

function ensureDir(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

function sanitizeId(value: string): string {
    return value.replace(/[\\/:*?"<>|]/g, '_').trim();
}

function toFileUrlIfExists(filePath: string): string {
    return filePath && fs.existsSync(filePath) ? pathToFileURL(filePath).toString() : '';
}

function toAssetPackProtocolUrl(packId: string, relativePath: string): string {
    const normalizedPackId = packId.replaceAll('\\', '/');
    const normalizedPath = relativePath.replaceAll('\\', '/');

    return `hexx-resource://asset-pack/${encodeURIComponent(normalizedPackId).replaceAll('%2F', '/')}/${encodeURIComponent(normalizedPath).replaceAll('%2F', '/')}`;
}

function readPackFromDir(packDir: string): AssetPack | null {
    const packJsonPath = path.join(packDir, 'pack.json');

    if (!fs.existsSync(packJsonPath)) {
        return null;
    }

    const raw = JSON.parse(fs.readFileSync(packJsonPath, 'utf-8')) as AssetPackRaw;

    const targets: AssetPackTarget[] = (raw.targets || []).map((target, index) => {
        const pngPath = path.join(packDir, target.png);
        const previewPath = target.preview ? path.join(packDir, target.preview) : '';

        return {
            ...target,
            id: `${raw.packId}_${index}_${target.catalogId}`,
            pngPath,
            pngUrl: fs.existsSync(pngPath) ? toAssetPackProtocolUrl(raw.packId, target.png) : '',
            previewPath,
            previewUrl: target.preview && fs.existsSync(previewPath)
                ? toAssetPackProtocolUrl(raw.packId, target.preview)
                : ''
        };
    });

    return {
        ...raw,
        basePath: packDir,
        targets
    };
}

export function getAssetPacks(): AssetPack[] {
    ensureDir(PACK_ROOT);

    return fs
        .readdirSync(PACK_ROOT, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && !entry.name.startsWith('__'))
        .map((entry) => readPackFromDir(path.join(PACK_ROOT, entry.name)))
        .filter((pack): pack is AssetPack => pack !== null);
}

export function importAssetPack(zipPath: string): AssetPack[] {
    ensureDir(PACK_ROOT);

    const zip = new AdmZip(zipPath);
    const tempDir = path.join(PACK_ROOT, `__temp_${Date.now()}`);

    fs.rmSync(tempDir, { recursive: true, force: true });
    ensureDir(tempDir);

    zip.extractAllTo(tempDir, true);

    const packJsonPath = path.join(tempDir, 'pack.json');

    if (!fs.existsSync(packJsonPath)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
        throw new Error('Asset Pack 안에 pack.json이 없습니다.');
    }

    const raw = JSON.parse(fs.readFileSync(packJsonPath, 'utf-8')) as AssetPackRaw;

    if (!raw.packId || !raw.packName || !Array.isArray(raw.targets)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
        throw new Error('pack.json 형식이 올바르지 않습니다.');
    }

    const finalDir = path.join(PACK_ROOT, sanitizeId(raw.packId));

    fs.rmSync(finalDir, { recursive: true, force: true });
    fs.renameSync(tempDir, finalDir);

    return getAssetPacks();
}