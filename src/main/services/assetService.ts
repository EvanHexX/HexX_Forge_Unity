// src/main/services/assetService.ts
// Asset 백업, 상태 확인, UI용 asset catalog 로딩, 직접 선택 PNG preview URL 생성을 담당합니다.

import fs from 'node:fs';
import path from 'node:path';
import { getAppSettings, readJsonFile } from './configService';

const ROOT_DIR = process.cwd();
const CONFIG_PATH = path.join(ROOT_DIR, 'config', 'asset_config.json');
const BACKUP_ROOT = path.join(ROOT_DIR, 'storage', 'backups');
const ASSET_CATALOG_PATH = path.join(ROOT_DIR, 'config', 'asset_catalog.json');
const TEXTURE_CATALOG_PATH = path.join(ROOT_DIR, 'config', 'texture_catalog.csv');

type SizeTuple = [number, number];

type AssetCatalogItem = {
    id: string;
    gender: string;
    /**
     * legacy 필드입니다. 기존 JSON에서는 type에 outfit/body 같은 category 값이 들어가 있었습니다.
     * 신규 구조에서는 category를 우선 사용하고, type은 하위호환용으로만 둡니다.
     */
    type?: string;
    /** API request.category로 전달되는 값입니다. 예: outfit, body, face, building */
    category?: string;
    /** API request.option2로 전달되는 값입니다. 예: 천산파, 개방, 캐릭터명 */
    option2?: string;
    label: string;
    textureName: string;
    pathId: number;
    size?: SizeTuple;
    preview?: string;
};

type AssetConfig = {
    backupTargets: {
        font: string[];
        asset: string[];
    };
};

export type TextureItem = {
    gender: string;
    type: string;
    texture_name: string;
    pathID: number;
};

/**
 * catalog preview 상대 경로를 renderer에서 안전하게 로딩할 custom protocol URL로 변환합니다.
 * file:// URL은 Electron renderer에서 차단될 수 있으므로 사용하지 않습니다.
 */
function toPreviewProtocolUrl(relativePath: string): string {
    const normalized = relativePath.replaceAll('\\', '/');
    return `hexx-resource://preview/${encodeURIComponent(normalized).replaceAll('%2F', '/')}`;
}

/**
 * 사용자가 직접 선택한 로컬 PNG를 renderer에서 안전하게 로딩할 custom protocol URL로 변환합니다.
 * 실제 파일 경로는 query string에 넣고 main.ts의 protocol handler가 존재 여부를 검증합니다.
 */
function toSelectedImageProtocolUrl(filePath: string): string {
    return `hexx-resource://selected-image/?path=${encodeURIComponent(filePath)}`;
}

/**
 * PNG 헤더에서 width/height를 읽습니다.
 * 직접 선택 PNG는 Python API에 size를 전달해야 하므로 main process에서 미리 읽어 둡니다.
 */
function readPngSize(filePath: string): SizeTuple {
    const buffer = fs.readFileSync(filePath);

    const isPng =
        buffer.length >= 24 &&
        buffer[0] === 0x89 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x4e &&
        buffer[3] === 0x47 &&
        buffer[4] === 0x0d &&
        buffer[5] === 0x0a &&
        buffer[6] === 0x1a &&
        buffer[7] === 0x0a;

    if (!isPng) {
        throw new Error(`PNG 파일이 아닙니다: ${filePath}`);
    }

    return [buffer.readUInt32BE(16), buffer.readUInt32BE(20)];
}

/**
 * AssetManager UI에서 사용하는 원본 카탈로그를 반환합니다.
 * 실제 패치 기준은 Python data.tsv이지만, UI 정렬/최소검증/미리보기에는 이 JSON을 사용합니다.
 */
export function getAssetCatalog() {
    const catalog = readJsonFile<{ items: AssetCatalogItem[] }>(ASSET_CATALOG_PATH, {
        items: []
    });

    return {
        items: catalog.items.map((item) => {
            const category = item.category || item.type || '';

            return {
                ...item,
                category,
                // 기존 UI hook이 item.type을 보고 있을 수 있으므로 category 값을 type에도 유지합니다.
                type: category,
                previewUrl: item.preview ? toPreviewProtocolUrl(item.preview) : ''
            };
        })
    };
}

/**
 * 사용자가 직접 적용할 PNG 파일을 선택합니다.
 * 반환 URL은 file://가 아니라 hexx-resource://selected-image/ 입니다.
 */
export async function selectReplacementImage() {
    const { dialog } = await import('electron');

    const result = await dialog.showOpenDialog({
        title: '변경 PNG 선택',
        properties: ['openFile'],
        filters: [
            { name: 'PNG Image', extensions: ['png'] }
        ]
    });

    if (result.canceled || result.filePaths.length === 0) {
        return null;
    }

    const filePath = result.filePaths[0];
    const size = readPngSize(filePath);

    return {
        path: filePath,
        url: toSelectedImageProtocolUrl(filePath),
        size
    };
}

function getConfig(): AssetConfig {
    return readJsonFile<AssetConfig>(CONFIG_PATH, {
        backupTargets: { font: [], asset: [] }
    });
}

function getTimestamp(): string {
    const d = new Date();
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}_${d.getHours()}${d.getMinutes()}${d.getSeconds()}`;
}

function ensureDir(p: string) {
    if (!fs.existsSync(p)) {
        fs.mkdirSync(p, { recursive: true });
    }
}

function getGamePath(): string {
    const { gamePath } = getAppSettings();
    if (!gamePath) throw new Error('게임 경로가 설정되지 않았습니다.');
    return gamePath;
}

function resolveGameFile(relativePath: string): string {
    return path.join(getGamePath(), relativePath);
}

/**
 * 구형 texture_catalog.csv를 읽습니다.
 * 이 파일은 UI 보조/마이그레이션용이며 최종 패치 기준은 Python data.tsv입니다.
 */
export function getTextureCatalog(): TextureItem[] {
    if (!fs.existsSync(TEXTURE_CATALOG_PATH)) return [];

    const text = fs.readFileSync(TEXTURE_CATALOG_PATH, 'utf-8');
    return text
        .split('\n')
        .slice(1)
        .map((row) => row.trim())
        .filter(Boolean)
        .map((row) => {
            const [gender, type, texture_name, pathID] = row.split(',');
            return { gender, type, texture_name, pathID: Number(pathID) };
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
