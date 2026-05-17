// src/main/services/assetPackService.ts
// Asset Pack ZIP 등록, pack.json 파싱, pack 목록 조회 서비스입니다.

import AdmZip from 'adm-zip';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { nativeImage } from 'electron';
import { getAppSettings } from './configService';
import { getBundledStoragePath, getStoragePath } from './runtimePaths';

const PACK_ROOT = getStoragePath('asset_packs');
const BUNDLED_PACK_ROOT = getBundledStoragePath('asset_packs');
const ONLINE_DOWNLOAD_DIR = getStoragePath('online_asset_pack_downloads');
const CATALOG_BASE_URL =
    'https://raw.githubusercontent.com/EvanHexX/HexX_Forge_Unity/main';
const CATALOG_INDEX_URL = `${CATALOG_BASE_URL}/asset-packs/index.json`;
const DISTRIBUTION_ROOT = path.join(process.cwd(), 'asset-packs');
const THUMBNAIL_MAX_SIZE = { width: 420, height: 280 };

type SizeTuple = [number, number];

type AssetPackTargetRaw = {
    /** UI catalog와 연결하기 위한 선택용 id입니다. 실제 패치 최종 기준은 Python data.tsv입니다. */
    catalogId: string;
    /** API request.category. 예: outfit, body, face */
    category: string;
    /** API request.option1. 보통 gender와 동일합니다. */
    option1?: string;
    /** gender. 예: female, male */
    gender?: string;
    option1Label?: string;
    /** API request.option2. 예: 천산파, 개방, 캐릭터명 */
    option2: string;
    displayLabel?: string;
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
    version?: string;
    source?: AssetPackSource;
    targets: AssetPackTargetRaw[];
};

type AssetPackSource = {
    type: 'github';
    catalogId: string;
    downloadPath: string;
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

export type OnlineAssetPackCatalogItem = {
    id: string;
    name: string;
    author?: string;
    description?: string;
    version: string;
    downloadPath: string;
    thumbnailPath?: string;
    sha256?: string;
    gameIds?: string[];
    installedPackId?: string;
    installedVersion?: string;
    installed?: boolean;
    updateAvailable?: boolean;
    thumbnailUrl?: string;
};

type OnlineAssetPackCatalogFile = {
    schemaVersion: 1;
    assetPacks: OnlineAssetPackCatalogItem[];
};

export type AssetPackDistributionInput = {
    id: string;
    name: string;
    author?: string;
    description?: string;
    version: string;
    zipPath?: string;
    thumbnailPath?: string;
    gameIds?: string[];
    targets?: AssetPackDistributionTargetInput[];
};

export type AssetPackDistributionTargetInput = {
    catalogId: string;
    category: string;
    option1?: string;
    gender?: string;
    option1Label?: string;
    option2?: string;
    displayLabel?: string;
    textureName: string;
    pathId: number;
    size?: SizeTuple;
    pngPath: string;
    previewPath?: string;
};

export type AssetPackDistributionResult = {
    item: OnlineAssetPackCatalogItem;
    indexPath: string;
    zipPath: string;
    thumbnailPath?: string;
};

function ensureDir(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

function sanitizeId(value: string): string {
    return value.replace(/[\\/:*?"<>|]/g, '_').trim();
}

function sanitizeFilePart(value: string): string {
    return sanitizeId(value).replace(/[^a-zA-Z0-9_.-]/g, '_');
}

function compareVersions(a: string, b: string): number {
    const parse = (value: string) =>
        value
            .replace(/^v/i, '')
            .split(/[.-]/)
            .map((part) => {
                const numeric = Number(part);
                return Number.isFinite(numeric) ? numeric : part;
            });
    const left = parse(a);
    const right = parse(b);
    const max = Math.max(left.length, right.length);
    for (let i = 0; i < max; i += 1) {
        const l = left[i] ?? 0;
        const r = right[i] ?? 0;
        if (typeof l === 'number' && typeof r === 'number' && l !== r) return l > r ? 1 : -1;
        const cmp = String(l).localeCompare(String(r), undefined, { numeric: true });
        if (cmp !== 0) return cmp > 0 ? 1 : -1;
    }
    return 0;
}

function hashFile(filePath: string): string {
    return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
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
            option1: target.option1 || target.gender || '',
            gender: target.gender || target.option1 || '',
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

export function importAssetPack(zipPath: string, metadata: Partial<Pick<AssetPackRaw, 'version' | 'source'>> = {}): AssetPack[] {
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

    if (metadata.version || metadata.source) {
        const finalPackJsonPath = path.join(finalDir, 'pack.json');
        const nextRaw = {
            ...raw,
            version: metadata.version || raw.version,
            source: metadata.source || raw.source
        };
        fs.writeFileSync(finalPackJsonPath, `${JSON.stringify(nextRaw, null, 2)}\n`, 'utf-8');
    }

    return getAssetPacks();
}

function enrichOnlineCatalogItems(items: OnlineAssetPackCatalogItem[]): OnlineAssetPackCatalogItem[] {
    const installed = getAssetPacks();
    const selectedGameId = getAppSettings().selectedGameId;

    return items
        .filter((item) => !item.gameIds || item.gameIds.length === 0 || item.gameIds.includes(selectedGameId))
        .map((item) => {
            const installedPack = installed.find(
                (pack) => pack.source?.type === 'github' && pack.source.catalogId === item.id
            );
            const installedVersion = installedPack?.version;
            return {
                ...item,
                thumbnailUrl: item.thumbnailPath
                    ? `${CATALOG_BASE_URL}/${item.thumbnailPath.replace(/^\/+/, '')}`
                    : undefined,
                installedPackId: installedPack?.packId,
                installedVersion,
                installed: Boolean(installedPack),
                updateAvailable: Boolean(
                    installedVersion && compareVersions(item.version, installedVersion) > 0
                )
            };
        });
}

export async function getOnlineAssetPackCatalog(): Promise<OnlineAssetPackCatalogItem[]> {
    const response = await fetch(CATALOG_INDEX_URL, {
        headers: {
            accept: 'application/vnd.github+json, application/json',
            'user-agent': 'HexX-Forge'
        }
    });

    if (!response.ok) {
        throw new Error(`온라인 어셋팩 목록 요청 실패: ${response.status}`);
    }

    const catalog = (await response.json()) as OnlineAssetPackCatalogFile;
    if (catalog.schemaVersion !== 1 || !Array.isArray(catalog.assetPacks)) {
        throw new Error('온라인 어셋팩 목록 형식이 올바르지 않습니다.');
    }

    return enrichOnlineCatalogItems(catalog.assetPacks);
}

async function downloadCatalogZip(item: OnlineAssetPackCatalogItem): Promise<string> {
    ensureDir(ONLINE_DOWNLOAD_DIR);

    const downloadUrl = `${CATALOG_BASE_URL}/${item.downloadPath.replace(/^\/+/, '')}`;
    const response = await fetch(downloadUrl, {
        headers: { 'user-agent': 'HexX-Forge' }
    });

    if (!response.ok) {
        throw new Error(`어셋팩 다운로드 실패: ${response.status}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    if (item.sha256) {
        const hash = crypto.createHash('sha256').update(buffer).digest('hex');
        if (hash.toLowerCase() !== item.sha256.toLowerCase()) {
            throw new Error('다운로드한 어셋팩 파일의 sha256 값이 일치하지 않습니다.');
        }
    }

    const safeName = sanitizeFilePart(item.id);
    const targetPath = path.join(ONLINE_DOWNLOAD_DIR, `${safeName}-${item.version}.zip`);
    fs.writeFileSync(targetPath, buffer);
    return targetPath;
}

function findInstalledOnlinePack(item: OnlineAssetPackCatalogItem, packs: AssetPack[]): AssetPack | undefined {
    return packs.find((pack) => pack.source?.type === 'github' && pack.source.catalogId === item.id);
}

export async function installOnlineAssetPack(item: OnlineAssetPackCatalogItem): Promise<AssetPack[]> {
    const existing = findInstalledOnlinePack(item, getAssetPacks());
    if (existing) {
        fs.rmSync(existing.basePath, { recursive: true, force: true });
    }

    const zipPath = await downloadCatalogZip(item);
    return importAssetPack(zipPath, {
        version: item.version,
        source: {
            type: 'github',
            catalogId: item.id,
            downloadPath: item.downloadPath
        }
    });
}

export async function updateOnlineAssetPack(item: OnlineAssetPackCatalogItem): Promise<AssetPack[]> {
    return installOnlineAssetPack(item);
}

function readDistributionIndex(): OnlineAssetPackCatalogFile {
    const indexPath = path.join(DISTRIBUTION_ROOT, 'index.json');
    if (!fs.existsSync(indexPath)) {
        return { schemaVersion: 1, assetPacks: [] };
    }

    const parsed = JSON.parse(fs.readFileSync(indexPath, 'utf-8')) as OnlineAssetPackCatalogFile;
    if (parsed.schemaVersion !== 1 || !Array.isArray(parsed.assetPacks)) {
        throw new Error('asset-packs/index.json 형식이 올바르지 않습니다.');
    }
    return parsed;
}

function writeThumbnail(sourcePath: string, targetPath: string): void {
    const image = nativeImage.createFromPath(sourcePath);
    if (image.isEmpty()) {
        throw new Error('thumbnail PNG를 읽을 수 없습니다.');
    }

    const size = image.getSize();
    const scale = Math.min(
        THUMBNAIL_MAX_SIZE.width / Math.max(size.width, 1),
        THUMBNAIL_MAX_SIZE.height / Math.max(size.height, 1),
        1
    );
    const resized = image.resize({
        width: Math.max(1, Math.round(size.width * scale)),
        height: Math.max(1, Math.round(size.height * scale)),
        quality: 'best'
    });
    fs.writeFileSync(targetPath, resized.toPNG());
}

function toPosixPath(...segments: string[]): string {
    return segments.join('/').replaceAll('\\', '/');
}

function getPngSize(filePath: string): SizeTuple | undefined {
    const image = nativeImage.createFromPath(filePath);
    if (image.isEmpty()) return undefined;
    const size = image.getSize();
    return [size.width, size.height];
}

function copyPackSourceFile(sourcePath: string, destinationPath: string): void {
    if (!fs.existsSync(sourcePath)) {
        throw new Error(`PNG 파일을 찾을 수 없습니다: ${sourcePath}`);
    }
    ensureDir(path.dirname(destinationPath));
    fs.copyFileSync(sourcePath, destinationPath);
}

function buildPackZipFromTargets(input: AssetPackDistributionInput, packageDir: string, id: string, version: string): string {
    const targets = input.targets ?? [];
    if (targets.length === 0) {
        throw new Error('배포할 PNG target을 추가하세요.');
    }

    const stagingDir = path.join(packageDir, '__pack_staging');
    fs.rmSync(stagingDir, { recursive: true, force: true });
    ensureDir(stagingDir);

    const packTargets: AssetPackTargetRaw[] = targets.map((target, index) => {
        const category = target.category?.trim() || '';
        const option1 = target.option1?.trim() || target.gender?.trim() || '';
        const catalogId = target.catalogId?.trim() || '';
        const textureName = target.textureName?.trim() || '';
        const pathId = Number(target.pathId);

        if (!catalogId) throw new Error(`${index + 1}번째 PNG: catalogId가 없습니다.`);
        if (!category) throw new Error(`${index + 1}번째 PNG: category가 없습니다.`);
        if (!option1) throw new Error(`${index + 1}번째 PNG: 대상 구분(option1)이 없습니다.`);
        if (!textureName) throw new Error(`${index + 1}번째 PNG: textureName이 없습니다.`);
        if (!Number.isFinite(pathId)) throw new Error(`${index + 1}번째 PNG: pathId가 올바르지 않습니다.`);
        if (!target.pngPath || !fs.existsSync(target.pngPath)) throw new Error(`${index + 1}번째 PNG 파일을 찾을 수 없습니다.`);

        const sourceFileName = path.basename(target.pngPath);
        const safeFileName = `${index + 1}_${sanitizeFilePart(sourceFileName)}`;
        const groupDir = sanitizeFilePart(category || 'misc') || 'misc';
        const pngRelativePath = toPosixPath('files', groupDir, safeFileName);
        const previewRelativePath = toPosixPath(
            'previews',
            groupDir,
            safeFileName.replace(/\.png$/i, '_preview.png')
        );

        copyPackSourceFile(target.pngPath, path.join(stagingDir, pngRelativePath));
        writeThumbnail(target.previewPath || target.pngPath, path.join(stagingDir, previewRelativePath));

        return {
            catalogId,
            category,
            option1,
            gender: option1,
            option1Label: target.option1Label?.trim() || option1,
            option2: target.option2?.trim() || '',
            displayLabel: target.displayLabel?.trim() || undefined,
            textureName,
            pathId,
            size: target.size || getPngSize(target.pngPath),
            png: pngRelativePath,
            preview: previewRelativePath
        };
    });

    const pack: AssetPackRaw = {
        schemaVersion: 2,
        packId: id,
        packName: input.name.trim(),
        author: input.author?.trim() || undefined,
        description: input.description?.trim() || undefined,
        version,
        targets: packTargets
    };

    fs.writeFileSync(path.join(stagingDir, 'pack.json'), `${JSON.stringify(pack, null, 2)}\n`, 'utf-8');

    const zipPath = path.join(packageDir, `${id}.zip`);
    const zip = new AdmZip();
    zip.addLocalFolder(stagingDir);
    zip.writeZip(zipPath);
    fs.rmSync(stagingDir, { recursive: true, force: true });
    return zipPath;
}

export function createAssetPackDistribution(input: AssetPackDistributionInput): AssetPackDistributionResult {
    const id = sanitizeFilePart(input.id.trim());
    const version = sanitizeFilePart(input.version.trim());
    const name = input.name.trim();

    if (!id) throw new Error('어셋팩 id를 입력하세요.');
    if (!name) throw new Error('어셋팩 제목을 입력하세요.');
    if (!version) throw new Error('어셋팩 version을 입력하세요.');
    if (!input.zipPath && (!input.targets || input.targets.length === 0)) {
        throw new Error('배포할 어셋팩 ZIP 또는 PNG target을 추가하세요.');
    }

    const packageDir = path.join(DISTRIBUTION_ROOT, 'packages', id, version);
    const thumbnailDir = path.join(DISTRIBUTION_ROOT, 'thumbnails');
    fs.rmSync(packageDir, { recursive: true, force: true });
    ensureDir(packageDir);
    ensureDir(thumbnailDir);

    const zipPath = input.zipPath
        ? path.join(packageDir, `${id}.zip`)
        : buildPackZipFromTargets(input, packageDir, id, version);
    if (input.zipPath) {
        if (!fs.existsSync(input.zipPath)) throw new Error('배포할 어셋팩 ZIP 파일을 찾을 수 없습니다.');
        fs.copyFileSync(input.zipPath, zipPath);
    }

    let thumbnailPath: string | undefined;
    let thumbnailCatalogPath: string | undefined;
    const thumbnailSource = input.thumbnailPath || input.targets?.[0]?.previewPath || input.targets?.[0]?.pngPath;
    if (thumbnailSource) {
        if (!fs.existsSync(thumbnailSource)) throw new Error('thumbnail PNG 파일을 찾을 수 없습니다.');
        thumbnailPath = path.join(thumbnailDir, `${id}.png`);
        writeThumbnail(thumbnailSource, thumbnailPath);
        thumbnailCatalogPath = `asset-packs/thumbnails/${id}.png`;
    }

    const item: OnlineAssetPackCatalogItem = {
        id,
        name,
        author: input.author?.trim() || undefined,
        description: input.description?.trim() || undefined,
        version,
        downloadPath: `asset-packs/packages/${id}/${version}/${id}.zip`,
        thumbnailPath: thumbnailCatalogPath,
        sha256: hashFile(zipPath),
        gameIds: input.gameIds?.filter(Boolean)
    };

    const indexPath = path.join(DISTRIBUTION_ROOT, 'index.json');
    const index = readDistributionIndex();
    const filtered = index.assetPacks.filter((existing) => existing.id !== id);
    filtered.push(item);
    filtered.sort((a, b) => a.name.localeCompare(b.name));

    ensureDir(DISTRIBUTION_ROOT);
    fs.writeFileSync(indexPath, `${JSON.stringify({ schemaVersion: 1, assetPacks: filtered }, null, 2)}\n`, 'utf-8');

    return {
        item,
        indexPath,
        zipPath,
        thumbnailPath
    };
}
