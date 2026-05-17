// src/main/services/assetService.ts
// Asset 백업, 상태 확인, UI용 asset catalog 로딩, 직접 선택 PNG preview URL 생성을 담당합니다.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { getAppSettings, readJsonFile, writeJsonFile } from './configService';
import { getBundledStoragePath, getConfigPath, getResourcePath, getStoragePath, getWritableConfigDir } from './runtimePaths';

const CONFIG_PATH = getConfigPath('asset_config.json');
const BACKUP_ROOT = getStoragePath('backups');
const ASSET_CATALOG_PATH = getConfigPath('asset_catalog.json');
const ASSET_CATALOG_BASE_URL =
    'https://raw.githubusercontent.com/EvanHexX/HexX_Forge_Unity/main';
const ASSET_CATALOG_INDEX_URL = `${ASSET_CATALOG_BASE_URL}/asset-catalog/index.json`;
const ASSET_CATALOG_DISTRIBUTION_ROOT = path.join(process.cwd(), 'asset-catalog');
const TEXTURE_CATALOG_PATH = getConfigPath('texture_catalog.csv');
const CURRENT_FONTS_PATH = getConfigPath('current_fonts.json');
const CURRENT_ASSET_PACKS_PATH = getConfigPath('current_asset_packs.json');
const FONT_METADATA_PATH = getResourcePath('tools', 'AssetManager', 'metadata', 'fonts_data.tsv');
const FONT_ORIGINALS_DIR = path.join(
    getResourcePath('tools', 'AssetManager', 'originals'),
    'LongYinLiZhiZhuan',
    'fonts',
);
const FONT_TARGET_IDS = Array.from({ length: 13 }, (_, index) => 2418 + index);
const FONT_STORAGE_DIR = getStoragePath('fonts');
const BUNDLED_FONT_STORAGE_DIR = getBundledStoragePath('fonts');
const FONT_EXTENSIONS = new Set(['.ttf', '.otf', '.ttc', '.fontdata']);
const METADATA_CATALOGS = [
    {
        key: 'texture-data',
        label: 'metadata/data.tsv',
        description: '기존 의상/texture patch metadata',
        relativePath: ['tools', 'AssetManager', 'metadata', 'data.tsv'],
        columns: ['category', 'gender', 'type', 'texture_name', 'pathID', 'size', 'atlas_name', 'atlas_pathID', 'format'],
        requiredColumns: ['category', 'gender', 'type', 'texture_name', 'pathID', 'size', 'format']
    },
    {
        key: 'ui-textures',
        label: 'metadata/ui_textures.tsv',
        description: 'UI Texture2D patch metadata',
        relativePath: ['tools', 'AssetManager', 'metadata', 'ui_textures.tsv'],
        columns: ['category', 'group', 'display_name', 'texture_name', 'pathID', 'width', 'height', 'format', 'assets_file', 'flip_y'],
        requiredColumns: ['category', 'group', 'display_name', 'texture_name', 'pathID', 'width', 'height', 'format', 'assets_file', 'flip_y']
    }
] as const;

type SizeTuple = [number, number];

type AssetCatalogItem = {
    id: string;
    gender?: string;
    /**
     * legacy 필드입니다. 기존 JSON에서는 type에 outfit/body 같은 category 값이 들어가 있었습니다.
     * 신규 구조에서는 category를 우선 사용하고, type은 하위호환용으로만 둡니다.
     */
    type?: string;
    /** API request.category로 전달되는 값입니다. 예: outfit, body, face, building */
    category?: string;
    /** API request.option1로 전달되는 값입니다. 기존 의상에서는 gender였고 UI asset에서는 대상 구분입니다. */
    option1?: string;
    /** 사용자에게 option1을 보여줄 때 우선 사용하는 라벨입니다. */
    option1Label?: string;
    /** API request.option2로 전달되는 값입니다. 예: 천산파, 개방, 캐릭터명 */
    option2?: string;
    /** 드랍다운과 미리보기 caption에서 우선 사용하는 표시명입니다. */
    displayLabel?: string;
    label: string;
    textureName: string;
    pathId: number;
    size?: SizeTuple;
    preview?: string;
    previewSha256?: string;
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

export type FontTarget = {
    pathId: number;
    targetLabel: string;
    metadataName: string;
    currentFont: string;
    currentFontPath: string;
    currentFontUrl: string;
};

export type StoredFont = {
    name: string;
    path: string;
    url: string;
};

type CurrentFontEntry = {
    pathId: number;
    targetLabel: string;
    metadataName: string;
    currentFont: string;
    currentFontFileName: string;
};

type CurrentFontsFile = {
    schemaVersion: number;
    gameId: string;
    updatedAt: string;
    fonts: CurrentFontEntry[];
};

type FontListItem = {
    path_id?: number;
    pathId?: number;
    font_file_name?: string;
    fontFileName?: string;
};

type AssetCatalogFile = {
    schemaVersion?: number;
    catalogVersion?: string;
    updatedAt?: string;
    items: AssetCatalogItem[];
};

type MetadataCatalogDefinition = typeof METADATA_CATALOGS[number];

export type MetadataCatalogRow = {
    rowId?: string;
    values: Record<string, string>;
};

export type MetadataCatalogData = {
    key: string;
    label: string;
    description: string;
    path: string;
    columns: string[];
    requiredColumns: string[];
    rows: MetadataCatalogRow[];
};

type RemoteAssetCatalogFile = {
    schemaVersion: number;
    catalogVersion?: string;
    updatedAt?: string;
    items: AssetCatalogItem[];
};

export type AssetCatalogSyncStatus = {
    ok: boolean;
    checkedAt: string;
    updateAvailable: boolean;
    currentVersion: string;
    currentUpdatedAt: string;
    remoteVersion?: string;
    remoteUpdatedAt?: string;
    itemCount: number;
    remoteItemCount?: number;
    error?: string;
};

export type AssetCatalogSyncResult = {
    status: AssetCatalogSyncStatus;
    catalog: ReturnType<typeof getAssetCatalog>;
    warnings: string[];
};

export type AssetCatalogDistributionResult = {
    indexPath: string;
    previewCount: number;
    catalogVersion: string;
    itemCount: number;
};

type CurrentAssetPackEntry = {
    catalogId: string;
    category?: string;
    option1?: string;
    option2?: string;
    textureName?: string;
    pathId?: number;
    packId: string;
    packName: string;
    targetId?: string;
    targetLabel?: string;
    previewUrl?: string;
    pngUrl?: string;
    appliedAt: string;
};

type CurrentAssetPacksFile = {
    schemaVersion: number;
    gameId: string;
    updatedAt: string;
    targets: CurrentAssetPackEntry[];
};

/**
 * catalog preview 상대 경로를 renderer에서 안전하게 로딩할 custom protocol URL로 변환합니다.
 * file:// URL은 Electron renderer에서 차단될 수 있으므로 사용하지 않습니다.
 */
function toPreviewProtocolUrl(relativePath: string): string {
    const normalized = relativePath.replaceAll('\\', '/');
    return `hexx-resource://preview/${encodeURIComponent(normalized).replaceAll('%2F', '/')}`;
}

function sanitizePathSegment(value: string): string {
    return value
        .replace(/[\\/:*?"<>|]/g, '_')
        .replace(/\s+/g, '_')
        .trim() || 'asset';
}

function normalizeCatalogItem(item: AssetCatalogItem): AssetCatalogItem {
    const category = item.category || item.type || '';
    const option1 = item.option1 || item.gender || '';

    return {
        ...item,
        category,
        option1,
        gender: item.gender || option1,
        type: category
    };
}

function isUiCategory(value: string): boolean {
    return value.trim().toLowerCase() === 'ui';
}

function readAssetCatalogFile(): AssetCatalogFile {
    const catalog = readJsonFile<AssetCatalogFile>(ASSET_CATALOG_PATH, {
        items: []
    });

    return {
        ...catalog,
        items: (catalog.items || []).map(normalizeCatalogItem)
    };
}

function writeAssetCatalogFile(catalog: AssetCatalogFile): void {
    writeJsonFile(ASSET_CATALOG_PATH, catalog);
}

function normalizeRemotePath(value: string): string {
    const normalized = path.posix.normalize(value.replaceAll('\\', '/').replace(/^\/+/, ''));

    if (!normalized || normalized === '.' || normalized.startsWith('../') || normalized.includes('/../')) {
        throw new Error(`원격 catalog 경로가 올바르지 않습니다: ${value}`);
    }

    return normalized;
}

function hashBuffer(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
}

function hashFile(filePath: string): string {
    return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function getCatalogVersion(catalog: Pick<AssetCatalogFile, 'catalogVersion' | 'updatedAt'>): string {
    return String(catalog.catalogVersion || catalog.updatedAt || '');
}

function compareCatalogVersion(localCatalog: AssetCatalogFile, remoteCatalog: RemoteAssetCatalogFile): boolean {
    const localVersion = getCatalogVersion(localCatalog);
    const remoteVersion = getCatalogVersion(remoteCatalog);

    if (!remoteVersion) {
        return false;
    }

    return localVersion !== remoteVersion;
}

async function fetchRemoteAssetCatalog(): Promise<RemoteAssetCatalogFile> {
    const response = await fetch(ASSET_CATALOG_INDEX_URL, {
        headers: {
            accept: 'application/json',
            'user-agent': 'HexX-Forge'
        }
    });

    if (!response.ok) {
        throw new Error(`온라인 asset catalog 요청 실패: ${response.status}`);
    }

    const remoteCatalog = (await response.json()) as RemoteAssetCatalogFile;
    if (!remoteCatalog || remoteCatalog.schemaVersion !== 1 || !Array.isArray(remoteCatalog.items)) {
        throw new Error('온라인 asset catalog 형식이 올바르지 않습니다.');
    }

    return {
        ...remoteCatalog,
        items: remoteCatalog.items.map((item, index) => validateCatalogItem(item, index))
    };
}

function buildCatalogSyncStatus(
    localCatalog: AssetCatalogFile,
    remoteCatalog: RemoteAssetCatalogFile,
    ok = true,
    error = ''
): AssetCatalogSyncStatus {
    return {
        ok,
        checkedAt: new Date().toISOString(),
        updateAvailable: ok ? compareCatalogVersion(localCatalog, remoteCatalog) : false,
        currentVersion: getCatalogVersion(localCatalog),
        currentUpdatedAt: localCatalog.updatedAt || '',
        remoteVersion: getCatalogVersion(remoteCatalog),
        remoteUpdatedAt: remoteCatalog.updatedAt || '',
        itemCount: localCatalog.items.length,
        remoteItemCount: remoteCatalog.items.length,
        error: error || undefined
    };
}

function mergeRemoteCatalogItems(localItems: AssetCatalogItem[], remoteItems: AssetCatalogItem[]): AssetCatalogItem[] {
    const merged = new Map<string, AssetCatalogItem>();

    for (const item of localItems) {
        if (item.id) merged.set(item.id, normalizeCatalogItem(item));
    }

    for (const item of remoteItems) {
        if (item.id) merged.set(item.id, normalizeCatalogItem(item));
    }

    return [...merged.values()].sort((a, b) => {
        const categoryCompare = (a.category || '').localeCompare(b.category || '', 'ko-KR');
        if (categoryCompare !== 0) return categoryCompare;
        return (a.displayLabel || a.label || a.id).localeCompare(b.displayLabel || b.label || b.id, 'ko-KR');
    });
}

function resolveLocalPreviewPath(relativePath: string): string {
    const safePath = normalizeRemotePath(relativePath);
    const candidates = [
        path.join(getWritableConfigDir(), safePath),
        path.join(process.cwd(), safePath),
        path.join(process.cwd(), 'config', safePath)
    ];

    return candidates.find((candidate) => fs.existsSync(candidate)) || '';
}

async function downloadRemotePreview(item: AssetCatalogItem): Promise<{ item: AssetCatalogItem; warning?: string }> {
    if (!item.preview) {
        return { item };
    }

    const previewPath = normalizeRemotePath(item.preview);
    const response = await fetch(`${ASSET_CATALOG_BASE_URL}/${previewPath}`, {
        headers: { 'user-agent': 'HexX-Forge' }
    });

    if (!response.ok) {
        return {
            item: { ...item, preview: '', previewSha256: undefined },
            warning: `${item.id}: preview 다운로드 실패(${response.status})`
        };
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    if (item.previewSha256 && hashBuffer(buffer).toLowerCase() !== item.previewSha256.toLowerCase()) {
        return {
            item: { ...item, preview: '', previewSha256: undefined },
            warning: `${item.id}: preview sha256 값이 일치하지 않습니다.`
        };
    }

    const targetPath = path.join(getWritableConfigDir(), previewPath);
    ensureDir(path.dirname(targetPath));
    fs.writeFileSync(targetPath, buffer);

    return { item: { ...item, preview: previewPath } };
}

/**
 * 사용자가 직접 선택한 로컬 PNG를 renderer에서 안전하게 로딩할 custom protocol URL로 변환합니다.
 * 실제 파일 경로는 query string에 넣고 main.ts의 protocol handler가 존재 여부를 검증합니다.
 */
function toSelectedImageProtocolUrl(filePath: string): string {
    return `hexx-resource://selected-image/?path=${encodeURIComponent(filePath)}`;
}

function toFontFileProtocolUrl(filePath: string): string {
    return `hexx-resource://font-file/?path=${encodeURIComponent(filePath)}`;
}

function toStoredFontProtocolUrl(fileName: string): string {
    return `hexx-resource://font/${encodeURIComponent(fileName)}`;
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
    const catalog = readAssetCatalogFile();

    return {
        items: catalog.items.map((item) => {
            return {
                ...item,
                previewUrl: item.preview ? toPreviewProtocolUrl(item.preview) : ''
            };
        })
    };
}

export function getCatalogEditorData() {
    return getAssetCatalog();
}

function validateCatalogItem(item: AssetCatalogItem, index: number): AssetCatalogItem {
    const normalized = normalizeCatalogItem(item);
    const required: Array<[keyof AssetCatalogItem, string]> = [
        ['id', 'id'],
        ['category', 'category'],
        ['option1', 'option1'],
        ['textureName', 'textureName']
    ];

    if (!isUiCategory(normalized.category || '')) {
        required.push(['option2', 'option2']);
    }

    for (const [field, name] of required) {
        if (!String(normalized[field] || '').trim()) {
            throw new Error(`asset_catalog.json items[${index}].${name} 값이 없습니다.`);
        }
    }

    if (!Number.isFinite(Number(normalized.pathId))) {
        throw new Error(`asset_catalog.json items[${index}].pathId 값이 올바르지 않습니다.`);
    }

    if (
        !Array.isArray(normalized.size) ||
        normalized.size.length !== 2 ||
        !Number.isFinite(Number(normalized.size[0])) ||
        !Number.isFinite(Number(normalized.size[1]))
    ) {
        throw new Error(`asset_catalog.json items[${index}].size 값은 [width, height] 형식이어야 합니다.`);
    }

    return {
        ...normalized,
        id: normalized.id.trim(),
        category: normalized.category?.trim(),
        type: normalized.category?.trim(),
        option1: normalized.option1?.trim(),
        gender: normalized.gender?.trim() || normalized.option1?.trim(),
        option1Label: normalized.option1Label?.trim() || normalized.option1?.trim(),
        option2: normalized.option2?.trim(),
        displayLabel: normalized.displayLabel?.trim() || normalized.label?.trim(),
        label: normalized.label?.trim() || normalized.displayLabel?.trim() || normalized.id.trim(),
        textureName: normalized.textureName.trim(),
        pathId: Number(normalized.pathId),
        size: [Number(normalized.size[0]), Number(normalized.size[1])]
    };
}

export function saveCatalogEditorData(catalog: AssetCatalogFile) {
    const items = (catalog.items || []).map(validateCatalogItem);
    const nextCatalog: AssetCatalogFile = {
        ...catalog,
        schemaVersion: Math.max(2, Number(catalog.schemaVersion || 2)),
        updatedAt: catalog.updatedAt || new Date().toISOString(),
        items
    };

    writeAssetCatalogFile(nextCatalog);
    return getAssetCatalog();
}

export async function getAssetCatalogSyncStatus(): Promise<AssetCatalogSyncStatus> {
    const localCatalog = readAssetCatalogFile();

    try {
        const remoteCatalog = await fetchRemoteAssetCatalog();
        return buildCatalogSyncStatus(localCatalog, remoteCatalog);
    } catch (error) {
        return {
            ok: false,
            checkedAt: new Date().toISOString(),
            updateAvailable: false,
            currentVersion: getCatalogVersion(localCatalog),
            currentUpdatedAt: localCatalog.updatedAt || '',
            itemCount: localCatalog.items.length,
            error: error instanceof Error ? error.message : '온라인 asset catalog 상태 확인에 실패했습니다.'
        };
    }
}

export async function syncAssetCatalogFromRemote(): Promise<AssetCatalogSyncResult> {
    const localCatalog = readAssetCatalogFile();
    const remoteCatalog = await fetchRemoteAssetCatalog();
    const warnings: string[] = [];
    const downloadedRemoteItems: AssetCatalogItem[] = [];

    for (const item of remoteCatalog.items) {
        const result = await downloadRemotePreview(item);
        downloadedRemoteItems.push(result.item);
        if (result.warning) warnings.push(result.warning);
    }

    const nextCatalog: AssetCatalogFile = {
        schemaVersion: 2,
        catalogVersion: getCatalogVersion(remoteCatalog),
        updatedAt: remoteCatalog.updatedAt || new Date().toISOString(),
        items: mergeRemoteCatalogItems(localCatalog.items, downloadedRemoteItems)
    };

    writeAssetCatalogFile(nextCatalog);

    return {
        status: buildCatalogSyncStatus(nextCatalog, remoteCatalog),
        catalog: getAssetCatalog(),
        warnings
    };
}

export function exportAssetCatalogDistribution(): AssetCatalogDistributionResult {
    const catalog = readAssetCatalogFile();
    const now = new Date();
    const catalogVersion = now.toISOString().replace(/[:.]/g, '-');
    const updatedAt = now.toISOString();
    let previewCount = 0;

    ensureDir(ASSET_CATALOG_DISTRIBUTION_ROOT);

    const items = catalog.items.map((item, index) => {
        const normalized = validateCatalogItem(item, index);
        if (!normalized.preview) return normalized;

        const sourcePath = resolveLocalPreviewPath(normalized.preview);
        if (!sourcePath) return { ...normalized, preview: '' };

        const category = sanitizePathSegment(normalized.category || normalized.type || 'uncategorized');
        const id = sanitizePathSegment(normalized.id);
        const remotePreview = path.posix.join('asset-catalog', 'previews', category, `${id}_preview.png`);
        const targetPath = path.join(process.cwd(), remotePreview);

        ensureDir(path.dirname(targetPath));
        fs.copyFileSync(sourcePath, targetPath);
        previewCount += 1;

        return {
            ...normalized,
            preview: remotePreview,
            previewSha256: hashFile(targetPath)
        };
    });

    const index = {
        schemaVersion: 1,
        catalogVersion,
        updatedAt,
        items
    };
    const indexPath = path.join(ASSET_CATALOG_DISTRIBUTION_ROOT, 'index.json');
    fs.writeFileSync(indexPath, `${JSON.stringify(index, null, 2)}\n`, 'utf-8');

    return {
        indexPath,
        previewCount,
        catalogVersion,
        itemCount: items.length
    };
}

export function getCurrentAssetPacks(): CurrentAssetPacksFile {
    return readJsonFile<CurrentAssetPacksFile>(CURRENT_ASSET_PACKS_PATH, {
        schemaVersion: 1,
        gameId: getAppSettings().selectedGameId,
        updatedAt: '',
        targets: []
    });
}

export function saveCurrentAssetPacks(entries: CurrentAssetPackEntry[]) {
    const current = getCurrentAssetPacks();
    const nextByCatalogId = new Map<string, CurrentAssetPackEntry>();

    for (const entry of current.targets || []) {
        if (entry.catalogId) nextByCatalogId.set(entry.catalogId, entry);
    }

    for (const entry of entries) {
        if (!entry.catalogId || !entry.packId) continue;
        nextByCatalogId.set(entry.catalogId, {
            ...entry,
            appliedAt: entry.appliedAt || new Date().toISOString()
        });
    }

    const next: CurrentAssetPacksFile = {
        schemaVersion: 1,
        gameId: getAppSettings().selectedGameId,
        updatedAt: new Date().toISOString(),
        targets: [...nextByCatalogId.values()]
    };

    writeJsonFile(CURRENT_ASSET_PACKS_PATH, next);
    return next;
}

export function clearCurrentAssetPacks() {
    const next: CurrentAssetPacksFile = {
        schemaVersion: 1,
        gameId: getAppSettings().selectedGameId,
        updatedAt: new Date().toISOString(),
        targets: []
    };

    writeJsonFile(CURRENT_ASSET_PACKS_PATH, next);
    return next;
}

export async function importCatalogPreviewImage(params: { id?: string; category?: string } = {}) {
    const { dialog } = await import('electron');

    const result = await dialog.showOpenDialog({
        title: '원본 미리보기 PNG 선택',
        properties: ['openFile'],
        filters: [
            { name: 'PNG Image', extensions: ['png'] }
        ]
    });

    if (result.canceled || result.filePaths.length === 0) {
        return null;
    }

    const sourcePath = result.filePaths[0];
    const size = readPngSize(sourcePath);
    const category = sanitizePathSegment(params.category || 'uncategorized');
    const id = sanitizePathSegment(params.id || path.parse(sourcePath).name);
    const preview = path.join('resources', 'previews', category, `${id}_preview.png`).replaceAll('\\', '/');
    const targetPath = path.join(getWritableConfigDir(), preview);

    ensureDir(path.dirname(targetPath));
    fs.copyFileSync(sourcePath, targetPath);

    return {
        preview,
        path: targetPath,
        url: toPreviewProtocolUrl(preview),
        size
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

function resolveMetadataCatalogPath(definition: MetadataCatalogDefinition): string {
    return getResourcePath(...definition.relativePath);
}

function parseTsv(text: string, definition: MetadataCatalogDefinition): MetadataCatalogRow[] {
    const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);
    const header = (lines.shift() || '').split('\t').map((column) => column.trim());
    const columns = header.length > 1 ? header : [...definition.columns];

    return lines
        .map((line, index) => ({ line, index }))
        .filter(({ line }) => line.trim())
        .map(({ line, index }) => {
            const parts = line.split('\t');
            const values: Record<string, string> = {};

            for (const column of definition.columns) {
                const sourceIndex = columns.indexOf(column);
                values[column] = sourceIndex >= 0 ? (parts[sourceIndex] || '').trim() : '';
            }

            return {
                rowId: `${definition.key}_${index}_${values.pathID || index}`,
                values
            };
        });
}

function formatTsv(definition: MetadataCatalogDefinition, rows: MetadataCatalogRow[]): string {
    const lines = [
        definition.columns.join('\t'),
        ...rows.map((row) => definition.columns.map((column) => row.values[column] || '').join('\t'))
    ];

    return `${lines.join('\n')}\n`;
}

function getMetadataCatalogDefinition(key: string): MetadataCatalogDefinition {
    const definition = METADATA_CATALOGS.find((item) => item.key === key);
    if (!definition) {
        throw new Error(`지원하지 않는 metadata catalog입니다: ${key}`);
    }
    return definition;
}

function validateMetadataCatalogRows(definition: MetadataCatalogDefinition, rows: MetadataCatalogRow[]): MetadataCatalogRow[] {
    return rows.map((row, index) => {
        const values: Record<string, string> = {};

        for (const column of definition.columns) {
            values[column] = String(row.values?.[column] || '').trim();
        }

        for (const column of definition.requiredColumns) {
            if (!values[column]) {
                throw new Error(`${definition.label} ${index + 1}번째 행의 ${column} 값이 없습니다.`);
            }
        }

        if (!Number.isFinite(Number(values.pathID))) {
            throw new Error(`${definition.label} ${index + 1}번째 행의 pathID 값이 올바르지 않습니다.`);
        }

        if (definition.key === 'texture-data') {
            const [width, height] = values.size.split(',').map((value) => Number(value.trim()));
            if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
                throw new Error(`${definition.label} ${index + 1}번째 행의 size 값은 width,height 형식이어야 합니다.`);
            }
            if (values.atlas_pathID && !Number.isFinite(Number(values.atlas_pathID))) {
                throw new Error(`${definition.label} ${index + 1}번째 행의 atlas_pathID 값이 올바르지 않습니다.`);
            }
        }

        if (definition.key === 'ui-textures') {
            for (const column of ['width', 'height']) {
                if (!Number.isFinite(Number(values[column])) || Number(values[column]) <= 0) {
                    throw new Error(`${definition.label} ${index + 1}번째 행의 ${column} 값이 올바르지 않습니다.`);
                }
            }
            const flipY = values.flip_y.toLowerCase();
            if (!['true', 'false'].includes(flipY)) {
                throw new Error(`${definition.label} ${index + 1}번째 행의 flip_y 값은 true 또는 false여야 합니다.`);
            }
            values.flip_y = flipY;
        }

        return {
            rowId: row.rowId || `${definition.key}_${index}_${values.pathID || index}`,
            values
        };
    });
}

export function getMetadataCatalogs(): MetadataCatalogData[] {
    return METADATA_CATALOGS.map((definition) => {
        const filePath = resolveMetadataCatalogPath(definition);
        const text = fs.existsSync(filePath)
            ? fs.readFileSync(filePath, 'utf-8')
            : `${definition.columns.join('\t')}\n`;

        return {
            key: definition.key,
            label: definition.label,
            description: definition.description,
            path: filePath,
            columns: [...definition.columns],
            requiredColumns: [...definition.requiredColumns],
            rows: parseTsv(text, definition)
        };
    });
}

export function saveMetadataCatalog(key: string, rows: MetadataCatalogRow[]): MetadataCatalogData {
    const definition = getMetadataCatalogDefinition(key);
    const filePath = resolveMetadataCatalogPath(definition);
    const nextRows = validateMetadataCatalogRows(definition, rows);

    ensureDir(path.dirname(filePath));
    fs.writeFileSync(filePath, formatTsv(definition, nextRows), 'utf-8');

    return getMetadataCatalogs().find((catalog) => catalog.key === key)!;
}

function clearDir(dirPath: string): void {
    if (fs.existsSync(dirPath)) {
        fs.rmSync(dirPath, { recursive: true, force: true });
    }
}

function isSupportedFontFile(filePath: string): boolean {
    return FONT_EXTENSIONS.has(path.extname(filePath).toLowerCase());
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

function readFontMetadataNames(): Record<number, string> {
    if (!fs.existsSync(FONT_METADATA_PATH)) return {};

    const text = fs.readFileSync(FONT_METADATA_PATH, 'utf-8');
    const result: Record<number, string> = {};

    for (const row of text.split(/\r?\n/).slice(1)) {
        if (!row.trim()) continue;

        const columns = row.split('\t');
        const name = columns[0]?.trim() || '';
        const pathId = Number(columns[3]);

        if (Number.isFinite(pathId)) {
            result[pathId] = name;
        }
    }

    return result;
}

function findExtractedFont(pathId: number): { name: string; path: string } {
    if (!fs.existsSync(FONT_ORIGINALS_DIR)) {
        return { name: '', path: '' };
    }

    const prefix = `${pathId}_`;
    const entry = fs.readdirSync(FONT_ORIGINALS_DIR)
        .find((fileName) => fileName.startsWith(prefix));

    return entry
        ? { name: entry, path: path.join(FONT_ORIGINALS_DIR, entry) }
        : { name: '', path: '' };
}

function listOriginalFontFiles(): string[] {
    if (!fs.existsSync(FONT_ORIGINALS_DIR)) return [];

    return fs.readdirSync(FONT_ORIGINALS_DIR)
        .filter((fileName) => isSupportedFontFile(fileName));
}

function stripPathIdAndExtension(fileName: string): string {
    return path.parse(fileName.replace(/^\d+_/, '')).name;
}

function findPreviewFontFileName(pathId: number, rawFontFileName: string, metadataName = ''): string {
    const originalFiles = listOriginalFontFiles();
    const rawStem = stripPathIdAndExtension(rawFontFileName);
    const stemCandidates = [
        rawStem,
        rawStem.replaceAll('_', ' '),
        metadataName
    ].filter(Boolean);

    for (const stem of stemCandidates) {
        const match = originalFiles.find((fileName) => {
            if (fileName.startsWith(`${pathId}_`)) return false;
            return path.parse(fileName).name === stem;
        });

        if (match) return match;
    }

    if (path.extname(rawFontFileName).toLowerCase() !== '.fontdata') {
        return rawFontFileName;
    }

    const extracted = findExtractedFont(pathId);
    return extracted.name || rawFontFileName;
}

function resolveCurrentFontPath(fileName: string): string {
    if (!fileName) return '';

    const originalPath = path.join(FONT_ORIGINALS_DIR, fileName);
    if (fs.existsSync(originalPath)) return originalPath;

    const storedPath = path.join(FONT_STORAGE_DIR, fileName);
    if (fs.existsSync(storedPath)) return storedPath;

    const bundledStoredPath = path.join(BUNDLED_FONT_STORAGE_DIR, fileName);
    if (fs.existsSync(bundledStoredPath)) return bundledStoredPath;

    return '';
}

function buildDefaultCurrentFontsFile(): CurrentFontsFile {
    const metadataNames = readFontMetadataNames();

    return {
        schemaVersion: 1,
        gameId: 'LongYinLiZhiZhuan',
        updatedAt: new Date().toISOString(),
        fonts: FONT_TARGET_IDS.map((pathId) => {
            const extractedFont = findExtractedFont(pathId);
            const metadataName = metadataNames[pathId] || '';
            const previewFontFileName = findPreviewFontFileName(pathId, extractedFont.name, metadataName);

            return {
                pathId,
                targetLabel: String(pathId),
                metadataName,
                currentFont: previewFontFileName || extractedFont.name,
                currentFontFileName: previewFontFileName || extractedFont.name
            };
        })
    };
}

function readCurrentFontsFile(): CurrentFontsFile {
    const fallback = buildDefaultCurrentFontsFile();
    const file = readJsonFile<CurrentFontsFile>(CURRENT_FONTS_PATH, fallback);

    if (!file.fonts?.length) {
        writeCurrentFontsFile(fallback);
        return fallback;
    }

    return file;
}

function writeCurrentFontsFile(file: CurrentFontsFile): CurrentFontsFile {
    const next = {
        ...file,
        updatedAt: new Date().toISOString()
    };

    writeJsonFile(CURRENT_FONTS_PATH, next);
    return next;
}

export function initializeCurrentFontsFile(): CurrentFontsFile {
    const file = readJsonFile<CurrentFontsFile | null>(CURRENT_FONTS_PATH, null);
    if (file?.fonts?.length) return file;

    return writeCurrentFontsFile(buildDefaultCurrentFontsFile());
}

export function updateCurrentFontsFromJobs(jobs: Array<{ path_id?: number; pathId?: number; replacement_font_file?: string; replacementFontFile?: string }>): CurrentFontsFile {
    const current = readCurrentFontsFile();
    const fonts = [...current.fonts];

    for (const job of jobs) {
        const pathId = Number(job.path_id ?? job.pathId);
        const replacementFile = job.replacement_font_file || job.replacementFontFile || '';
        if (!Number.isFinite(pathId) || !replacementFile) continue;

        const fileName = path.basename(replacementFile);
        const index = fonts.findIndex((font) => font.pathId === pathId);
        const metadataName = fonts[index]?.metadataName || readFontMetadataNames()[pathId] || '';
        const nextEntry: CurrentFontEntry = {
            pathId,
            targetLabel: String(pathId),
            metadataName,
            currentFont: fileName,
            currentFontFileName: fileName
        };

        if (index >= 0) {
            fonts[index] = { ...fonts[index], ...nextEntry };
        } else {
            fonts.push(nextEntry);
        }
    }

    return writeCurrentFontsFile({ ...current, fonts });
}

export function updateCurrentFontsFromFontList(fontList: FontListItem[]): CurrentFontsFile {
    const metadataNames = readFontMetadataNames();
    const current = readCurrentFontsFile();
    const fonts = [...current.fonts];

    for (const item of fontList) {
        const pathId = Number(item.path_id ?? item.pathId);
        const rawFontFileName = item.font_file_name || item.fontFileName || '';
        if (!Number.isFinite(pathId) || !rawFontFileName) continue;

        const metadataName = metadataNames[pathId] || '';
        const previewFontFileName = findPreviewFontFileName(pathId, rawFontFileName, metadataName);
        const index = fonts.findIndex((font) => font.pathId === pathId);
        const nextEntry: CurrentFontEntry = {
            pathId,
            targetLabel: String(pathId),
            metadataName,
            currentFont: previewFontFileName,
            currentFontFileName: previewFontFileName
        };

        if (index >= 0) {
            fonts[index] = { ...fonts[index], ...nextEntry };
        } else {
            fonts.push(nextEntry);
        }
    }

    return writeCurrentFontsFile({ ...current, fonts });
}

export function getStoredFonts(): StoredFont[] {
    ensureDir(FONT_STORAGE_DIR);

    const fileNames = new Set<string>();

    for (const root of [BUNDLED_FONT_STORAGE_DIR, FONT_STORAGE_DIR]) {
        if (!fs.existsSync(root)) continue;

        for (const fileName of fs.readdirSync(root)) {
            if (isSupportedFontFile(fileName)) {
                fileNames.add(fileName);
            }
        }
    }

    return [...fileNames]
        .sort((a, b) => a.localeCompare(b))
        .map((fileName) => {
            const fontPath = fs.existsSync(path.join(FONT_STORAGE_DIR, fileName))
                ? path.join(FONT_STORAGE_DIR, fileName)
                : path.join(BUNDLED_FONT_STORAGE_DIR, fileName);

            return {
                name: fileName,
                path: fontPath,
                url: toStoredFontProtocolUrl(fileName)
            };
        });
}

export function importFont(sourcePath: string): StoredFont[] {
    if (!sourcePath || !fs.existsSync(sourcePath)) {
        throw new Error('폰트 파일을 찾지 못했습니다.');
    }

    if (!isSupportedFontFile(sourcePath)) {
        throw new Error('지원하지 않는 폰트 파일입니다.');
    }

    ensureDir(FONT_STORAGE_DIR);

    const parsed = path.parse(sourcePath);
    let destPath = path.join(FONT_STORAGE_DIR, parsed.base);
    let suffix = 1;

    while (fs.existsSync(destPath) && path.resolve(destPath) !== path.resolve(sourcePath)) {
        destPath = path.join(FONT_STORAGE_DIR, `${parsed.name}_${suffix}${parsed.ext}`);
        suffix += 1;
    }

    if (path.resolve(destPath) !== path.resolve(sourcePath)) {
        fs.copyFileSync(sourcePath, destPath);
    }

    return getStoredFonts();
}

export function getFontTargets(): FontTarget[] {
    const file = initializeCurrentFontsFile();

    return FONT_TARGET_IDS.map((pathId) => {
        const entry = file.fonts.find((font) => font.pathId === pathId);
        const fontPath = resolveCurrentFontPath(entry?.currentFontFileName || '');

        return {
            pathId,
            targetLabel: entry?.targetLabel || String(pathId),
            metadataName: entry?.metadataName || '',
            currentFont: entry?.currentFont || '',
            currentFontPath: fontPath,
            currentFontUrl: fontPath ? toFontFileProtocolUrl(fontPath) : ''
        };
    });
}

export function getBackupStatus() {
    const fontDir = path.join(BACKUP_ROOT, 'font');
    const assetDir = path.join(BACKUP_ROOT, 'asset');

    const getLatest = (dir: string) => {
        if (!fs.existsSync(dir)) return null;

        const list = fs.readdirSync(dir)
            .map((name) => path.join(dir, name))
            .filter((entryPath) => fs.statSync(entryPath).isDirectory());
        if (list.length === 0) return null;

        const latestPath = list.sort().reverse()[0];
        const name = path.basename(latestPath);

        return {
            name,
            sizeBytes: getDirectorySize(latestPath)
        };
    };

    return {
        font: getLatest(fontDir),
        asset: getLatest(assetDir)
    };
}

function getDirectorySize(dirPath: string): number {
    let total = 0;

    function walk(currentDir: string): void {
        for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
            const entryPath = path.join(currentDir, entry.name);

            if (entry.isDirectory()) {
                walk(entryPath);
                continue;
            }

            if (entry.isFile()) {
                total += fs.statSync(entryPath).size;
            }
        }
    }

    walk(dirPath);
    return total;
}

export function backup(type: 'font' | 'asset') {
    const config = getConfig();
    const targets = config.backupTargets[type];

    if (!targets || targets.length === 0) {
        throw new Error(`${type} 백업 대상이 없습니다.`);
    }

    const timestamp = getTimestamp();
    const typeBackupDir = path.join(BACKUP_ROOT, type);
    clearDir(typeBackupDir);

    const baseDir = path.join(typeBackupDir, timestamp);

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

function getLatestBackupDir(type: 'font' | 'asset'): string {
    const typeBackupDir = path.join(BACKUP_ROOT, type);

    if (!fs.existsSync(typeBackupDir)) {
        throw new Error(`${type} 백업 파일이 없습니다.`);
    }

    const list = fs.readdirSync(typeBackupDir)
        .map((name) => path.join(typeBackupDir, name))
        .filter((entryPath) => fs.statSync(entryPath).isDirectory())
        .sort()
        .reverse();

    if (!list.length) {
        throw new Error(`${type} 백업 파일이 없습니다.`);
    }

    return list[0];
}

function copyBackupFilesToGame(backupDir: string): void {
    function walk(currentDir: string): void {
        for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
            const sourcePath = path.join(currentDir, entry.name);

            if (entry.isDirectory()) {
                walk(sourcePath);
                continue;
            }

            if (!entry.isFile()) continue;

            const relativePath = path.relative(backupDir, sourcePath);
            const destPath = resolveGameFile(relativePath);

            ensureDir(path.dirname(destPath));
            fs.copyFileSync(sourcePath, destPath);
        }
    }

    walk(backupDir);
}

export function restoreBackup(type: 'font' | 'asset') {
    const backupDir = getLatestBackupDir(type);
    copyBackupFilesToGame(backupDir);

    return getBackupStatus();
}
