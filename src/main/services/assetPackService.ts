// src/main/services/assetPackService.ts
// Asset Pack ZIP 등록, pack.json 파싱, pack 목록 조회 서비스입니다.

import AdmZip from 'adm-zip';
import fs from 'node:fs';
import path from 'node:path';
import { getBundledStoragePath, getStoragePath } from './runtimePaths';

const PACK_ROOT = getStoragePath('asset_packs');
const BUNDLED_PACK_ROOT = getBundledStoragePath('asset_packs');

type SizeTuple = [number, number];

type AssetPackTargetRaw = {
    /** UI catalog와 연결하기 위한 선택용 id입니다. 실제 패치 최종 기준은 Python data.tsv입니다. */
    catalogId: string;
    /** API request.category. 예: outfit, body, face */
    category: string;
    /** API request.option1. 보통 gender와 동일합니다. */
    option1?: string;
    /** gender. 예: female, male */
    gender: string;
    /** API request.option2. 예: 천산파, 개방, 캐릭터명 */
    option2: string;
    textureName: string;
    pathId: number;
    size?: SizeTuple;
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

function toAssetPackProtocolUrl(packId: string, relativePath: string): string {
    const normalizedPackId = packId.replaceAll('\\', '/');
    const normalizedPath = relativePath.replaceAll('\\', '/');

    return `hexx-resource://asset-pack/${encodeURIComponent(normalizedPackId).replaceAll('%2F', '/')}/${encodeURIComponent(normalizedPath).replaceAll('%2F', '/')}`;
}

function requireString(value: unknown, fieldName: string): string {
    if (typeof value !== 'string' || value.trim() === '') {
        throw new Error(`pack.json target ${fieldName} 값이 없습니다.`);
    }

    return value;
}

function readPackFromDir(packDir: string): AssetPack | null {
    const packJsonPath = path.join(packDir, 'pack.json');

    if (!fs.existsSync(packJsonPath)) {
        return null;
    }

    const raw = JSON.parse(fs.readFileSync(packJsonPath, 'utf-8')) as AssetPackRaw;

    const targets: AssetPackTarget[] = (raw.targets || []).map((target, index) => {
        const png = requireString(target.png, `targets[${index}].png`);
        const pngPath = path.join(packDir, png);
        const previewPath = target.preview ? path.join(packDir, target.preview) : '';

        return {
            ...target,
            category: target.category || 'outfit',
            option1: target.option1 || target.gender,
            id: `${raw.packId}_${index}_${target.catalogId}`,
            pngPath,
            pngUrl: fs.existsSync(pngPath) ? toAssetPackProtocolUrl(raw.packId, png) : '',
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

    const packDirs = new Map<string, string>();

    for (const root of [BUNDLED_PACK_ROOT, PACK_ROOT]) {
        if (!fs.existsSync(root)) continue;

        for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
            if (entry.isDirectory() && !entry.name.startsWith('__')) {
                packDirs.set(entry.name, path.join(root, entry.name));
            }
        }
    }

    return [...packDirs.values()]
        .map((packDir) => readPackFromDir(packDir))
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
