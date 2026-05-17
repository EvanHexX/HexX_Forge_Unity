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
const PREVIEW_MAX_SIZE = { width: 1920, height: 1080 };
const TARGET_PREVIEW_MAX_SIZE = { width: 1920, height: 1080 };

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
    previewPath?: string;
    sha256?: string;
    gameIds?: string[];
    installedPackId?: string;
    installedVersion?: string;
    installed?: boolean;
    updateAvailable?: boolean;
    thumbnailUrl?: string;
    previewUrl?: string;
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
    previewPath?: string;
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
    pngPath?: string;
    previewPath?: string;
    existingZipPath?: string;
    existingPng?: string;
    existingPreview?: string;
};

export type AssetPackDistributionResult = {
    item: OnlineAssetPackCatalogItem;
    indexPath: string;
    zipPath: string;
    thumbnailPath?: string;
    previewPath?: string;
};

export type AssetPackDistributionCatalogItem = OnlineAssetPackCatalogItem & {
    zipPath: string;
    thumbnailFilePath?: string;
    previewFilePath?: string;
    pack?: AssetPackRaw;
    broken?: boolean;
    brokenReason?: string;
    missingFiles?: string[];
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

function isWorkspaceTempDirName(name: string): boolean {
    return name === '__pack_staging' || name.startsWith('__tmp-');
}

function cleanupDistributionTempDirs(rootDir = DISTRIBUTION_ROOT): void {
    const packagesDir = path.join(rootDir, 'packages');

    for (const root of [rootDir, packagesDir]) {
        if (!fs.existsSync(root)) continue;

        for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
            if (entry.isDirectory() && isWorkspaceTempDirName(entry.name)) {
                fs.rmSync(path.join(root, entry.name), { recursive: true, force: true });
            }
        }
    }

    if (!fs.existsSync(packagesDir)) return;

    const stack = [packagesDir];
    while (stack.length) {
        const current = stack.pop()!;
        for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
            const entryPath = path.join(current, entry.name);
            if (!entry.isDirectory()) continue;

            if (isWorkspaceTempDirName(entry.name)) {
                fs.rmSync(entryPath, { recursive: true, force: true });
            } else {
                stack.push(entryPath);
            }
        }
    }
}

function cleanupEmptyDistributionDirs(): void {
    const packagesRoot = path.join(DISTRIBUTION_ROOT, 'packages');
    const thumbnailsRoot = path.join(DISTRIBUTION_ROOT, 'thumbnails');
    const previewsRoot = path.join(DISTRIBUTION_ROOT, 'previews');

    for (const dirPath of [packagesRoot, thumbnailsRoot, previewsRoot]) {
        if (fs.existsSync(dirPath) && fs.readdirSync(dirPath).length === 0) {
            fs.rmSync(dirPath, { recursive: true, force: true });
        }
    }
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
                previewUrl: item.previewPath
                    ? `${CATALOG_BASE_URL}/${item.previewPath.replace(/^\/+/, '')}`
                    : item.thumbnailPath
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
    ensureDir(path.dirname(targetPath));
    fs.writeFileSync(targetPath, resized.toPNG());
}

function writeResizedPng(sourcePath: string, targetPath: string, maxSize: SizeTuple, label: string): void {
    const image = nativeImage.createFromPath(sourcePath);
    if (image.isEmpty()) {
        throw new Error(`${label} PNG를 읽을 수 없습니다.`);
    }

    const size = image.getSize();
    const scale = Math.min(
        maxSize[0] / Math.max(size.width, 1),
        maxSize[1] / Math.max(size.height, 1),
        1
    );
    const resized = image.resize({
        width: Math.max(1, Math.round(size.width * scale)),
        height: Math.max(1, Math.round(size.height * scale)),
        quality: 'best'
    });
    ensureDir(path.dirname(targetPath));
    fs.writeFileSync(targetPath, resized.toPNG());
}

function writeResizedPngFromBuffer(buffer: Buffer, targetPath: string, maxSize: SizeTuple, label: string): void {
    const image = nativeImage.createFromBuffer(buffer);
    if (image.isEmpty()) {
        throw new Error(`${label} PNG를 읽을 수 없습니다.`);
    }

    const size = image.getSize();
    const scale = Math.min(
        maxSize[0] / Math.max(size.width, 1),
        maxSize[1] / Math.max(size.height, 1),
        1
    );
    const resized = image.resize({
        width: Math.max(1, Math.round(size.width * scale)),
        height: Math.max(1, Math.round(size.height * scale)),
        quality: 'best'
    });
    ensureDir(path.dirname(targetPath));
    fs.writeFileSync(targetPath, resized.toPNG());
}

function writeThumbnailFromBuffer(buffer: Buffer, targetPath: string): void {
    writeResizedPngFromBuffer(buffer, targetPath, [THUMBNAIL_MAX_SIZE.width, THUMBNAIL_MAX_SIZE.height], 'thumbnail');
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

function copyZipEntry(zipPath: string, entryName: string, destinationPath: string): void {
    if (!fs.existsSync(zipPath)) {
        throw new Error(`기존 어셋팩 ZIP을 찾을 수 없습니다: ${zipPath}`);
    }

    const zip = new AdmZip(zipPath);
    const entry = zip.getEntry(entryName);
    if (!entry || entry.isDirectory) {
        throw new Error(`기존 어셋팩 ZIP 안에서 파일을 찾을 수 없습니다: ${entryName}`);
    }

    ensureDir(path.dirname(destinationPath));
    fs.writeFileSync(destinationPath, entry.getData());
}

function getZipEntryBuffer(zipPath: string, entryName: string): Buffer {
    if (!fs.existsSync(zipPath)) {
        throw new Error(`기존 어셋팩 ZIP을 찾을 수 없습니다: ${zipPath}`);
    }

    const zip = new AdmZip(zipPath);
    const entry = zip.getEntry(entryName);
    if (!entry || entry.isDirectory) {
        throw new Error(`기존 어셋팩 ZIP 안에서 파일을 찾을 수 없습니다: ${entryName}`);
    }

    return entry.getData();
}

function buildPackZipFromTargets(input: AssetPackDistributionInput, workDir: string, id: string, version: string): string {
    const targets = input.targets ?? [];
    if (targets.length === 0) {
        throw new Error('배포할 PNG target을 추가하세요.');
    }

    const stagingDir = path.join(workDir, '__pack_staging');
    fs.rmSync(stagingDir, { recursive: true, force: true });
    ensureDir(stagingDir);

    try {
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
            if (!target.pngPath && (!target.existingZipPath || !target.existingPng)) {
                throw new Error(`${index + 1}번째 PNG 파일 또는 기존 ZIP entry가 없습니다.`);
            }

            const sourceFileName = path.basename(target.pngPath || target.existingPng || `${catalogId}.png`);
            const safeFileName = `${index + 1}_${sanitizeFilePart(sourceFileName)}`;
            const groupDir = sanitizeFilePart(category || 'misc') || 'misc';
            const pngRelativePath = toPosixPath('files', groupDir, safeFileName);
            const previewRelativePath = toPosixPath(
                'previews',
                groupDir,
                safeFileName.replace(/\.png$/i, '_preview.png')
            );

            if (target.pngPath) {
                copyPackSourceFile(target.pngPath, path.join(stagingDir, pngRelativePath));
                writeResizedPng(
                    target.previewPath || target.pngPath,
                    path.join(stagingDir, previewRelativePath),
                    [TARGET_PREVIEW_MAX_SIZE.width, TARGET_PREVIEW_MAX_SIZE.height],
                    'target preview'
                );
            } else {
                copyZipEntry(target.existingZipPath!, target.existingPng!, path.join(stagingDir, pngRelativePath));
                if (target.existingPreview) {
                    copyZipEntry(target.existingZipPath!, target.existingPreview, path.join(stagingDir, previewRelativePath));
                } else {
                    writeResizedPng(
                        path.join(stagingDir, pngRelativePath),
                        path.join(stagingDir, previewRelativePath),
                        [TARGET_PREVIEW_MAX_SIZE.width, TARGET_PREVIEW_MAX_SIZE.height],
                        'target preview'
                    );
                }
            }

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
                size: target.size || (target.pngPath ? getPngSize(target.pngPath) : undefined),
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

        const zipPath = path.join(workDir, `${id}.zip`);
        const zip = new AdmZip();
        zip.addLocalFolder(stagingDir);
        zip.writeZip(zipPath);
        return zipPath;
    } finally {
        fs.rmSync(stagingDir, { recursive: true, force: true });
    }
}

function validatePackZip(zipPath: string): AssetPackRaw {
    if (!fs.existsSync(zipPath)) {
        throw new Error(`배포 ZIP이 생성되지 않았습니다: ${zipPath}`);
    }

    const zip = new AdmZip(zipPath);
    const packEntry = zip.getEntry('pack.json');
    if (!packEntry || packEntry.isDirectory) {
        throw new Error('배포 ZIP 안에 pack.json이 없습니다.');
    }

    const pack = JSON.parse(packEntry.getData().toString('utf-8')) as AssetPackRaw;
    if (!pack.packId || !pack.packName || !Array.isArray(pack.targets)) {
        throw new Error('배포 ZIP의 pack.json 형식이 올바르지 않습니다.');
    }

    pack.targets.forEach((target, index) => {
        if (!target.png || !zip.getEntry(target.png)) {
            throw new Error(`배포 ZIP target ${index + 1}의 PNG entry가 없습니다: ${target.png || '(empty)'}`);
        }
        if (!target.preview || !zip.getEntry(target.preview)) {
            throw new Error(`배포 ZIP target ${index + 1}의 preview entry가 없습니다: ${target.preview || '(empty)'}`);
        }
    });

    return pack;
}

function findDistributionRepresentativeSource(input: AssetPackDistributionInput, tempZipPath: string): { type: 'file'; path: string } | { type: 'zip'; zipPath: string; entryName: string } | undefined {
    const firstTarget = input.targets?.[0];

    if (firstTarget?.previewPath || firstTarget?.pngPath) {
        const sourcePath = firstTarget.previewPath || firstTarget.pngPath;
        if (sourcePath && fs.existsSync(sourcePath)) return { type: 'file', path: sourcePath };
    }

    if (firstTarget?.existingZipPath && firstTarget.existingPng) {
        return { type: 'zip', zipPath: firstTarget.existingZipPath, entryName: firstTarget.existingPng };
    }

    if (fs.existsSync(tempZipPath)) {
        const pack = validatePackZip(tempZipPath);
        const firstPackTarget = pack.targets[0];
        const sourceEntry = firstPackTarget?.png || firstPackTarget?.preview;
        if (sourceEntry) return { type: 'zip', zipPath: tempZipPath, entryName: sourceEntry };
    }

    return undefined;
}

function writeDistributionImage(
    input: AssetPackDistributionInput,
    tempZipPath: string,
    targetPath: string,
    options: { explicitPath?: string; maxSize: SizeTuple; label: string }
): string | undefined {
    if (options.explicitPath) {
        if (!fs.existsSync(options.explicitPath)) throw new Error(`${options.label} PNG 파일을 찾을 수 없습니다.`);
        writeResizedPng(options.explicitPath, targetPath, options.maxSize, options.label);
        return targetPath;
    }

    const source = findDistributionRepresentativeSource(input, tempZipPath);
    if (!source) return undefined;

    if (source.type === 'file') {
        writeResizedPng(source.path, targetPath, options.maxSize, options.label);
        return targetPath;
    }

    writeResizedPngFromBuffer(getZipEntryBuffer(source.zipPath, source.entryName), targetPath, options.maxSize, options.label);
    return targetPath;
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

    const packageRootDir = path.join(DISTRIBUTION_ROOT, 'packages', id);
    const packageDir = path.join(packageRootDir, version);
    const thumbnailDir = path.join(DISTRIBUTION_ROOT, 'thumbnails');
    const previewDir = path.join(DISTRIBUTION_ROOT, 'previews');
    const tempRoot = path.join(DISTRIBUTION_ROOT, 'packages', `__tmp-${id}-${Date.now()}`);
    const tempThumbnailPath = path.join(tempRoot, `${id}.png`);
    const tempPreviewPath = path.join(tempRoot, `${id}_preview.png`);
    const finalZipPath = path.join(packageDir, `${id}.zip`);
    const finalThumbnailPath = path.join(thumbnailDir, `${id}.png`);
    const finalPreviewPath = path.join(previewDir, `${id}.png`);

    cleanupDistributionTempDirs();
    fs.rmSync(tempRoot, { recursive: true, force: true });
    ensureDir(tempRoot);

    try {
        const tempZipPath = input.zipPath
            ? path.join(tempRoot, `${id}.zip`)
            : buildPackZipFromTargets(input, tempRoot, id, version);
        if (input.zipPath) {
            if (!fs.existsSync(input.zipPath)) throw new Error('배포할 어셋팩 ZIP 파일을 찾을 수 없습니다.');
            fs.copyFileSync(input.zipPath, tempZipPath);
        }

        validatePackZip(tempZipPath);

        const thumbnailPath = writeDistributionImage(input, tempZipPath, tempThumbnailPath, {
            explicitPath: input.thumbnailPath,
            maxSize: [THUMBNAIL_MAX_SIZE.width, THUMBNAIL_MAX_SIZE.height],
            label: 'thumbnail'
        });
        const thumbnailCatalogPath = thumbnailPath ? `asset-packs/thumbnails/${id}.png` : undefined;
        const previewPath = writeDistributionImage(input, tempZipPath, tempPreviewPath, {
            explicitPath: input.previewPath || input.thumbnailPath,
            maxSize: [PREVIEW_MAX_SIZE.width, PREVIEW_MAX_SIZE.height],
            label: 'preview'
        });
        const previewCatalogPath = previewPath ? `asset-packs/previews/${id}.png` : undefined;

        fs.rmSync(packageRootDir, { recursive: true, force: true });
        ensureDir(packageDir);
        ensureDir(thumbnailDir);
        ensureDir(previewDir);
        fs.copyFileSync(tempZipPath, finalZipPath);
        if (thumbnailPath) {
            fs.copyFileSync(tempThumbnailPath, finalThumbnailPath);
        } else {
            fs.rmSync(finalThumbnailPath, { force: true });
        }
        if (previewPath) {
            fs.copyFileSync(tempPreviewPath, finalPreviewPath);
        } else {
            fs.rmSync(finalPreviewPath, { force: true });
        }

        validatePackZip(finalZipPath);
        const sha256 = hashFile(finalZipPath);

        const item: OnlineAssetPackCatalogItem = {
            id,
            name,
            author: input.author?.trim() || undefined,
            description: input.description?.trim() || undefined,
            version,
            downloadPath: `asset-packs/packages/${id}/${version}/${id}.zip`,
            thumbnailPath: thumbnailCatalogPath,
            previewPath: previewCatalogPath,
            sha256,
            gameIds: input.gameIds?.filter(Boolean)
        };

        const resolvedZipPath = resolveDistributionPath(item.downloadPath);
        const resolvedThumbnailPath = resolveDistributionPath(item.thumbnailPath);
        const resolvedPreviewPath = resolveDistributionPath(item.previewPath);
        if (resolvedZipPath !== finalZipPath || !fs.existsSync(resolvedZipPath)) {
            throw new Error('index.json downloadPath가 생성된 ZIP과 일치하지 않습니다.');
        }
        if (item.thumbnailPath && (!resolvedThumbnailPath || !fs.existsSync(resolvedThumbnailPath))) {
            throw new Error('index.json thumbnailPath가 생성된 thumbnail과 일치하지 않습니다.');
        }
        if (item.previewPath && (!resolvedPreviewPath || !fs.existsSync(resolvedPreviewPath))) {
            throw new Error('index.json previewPath가 생성된 preview와 일치하지 않습니다.');
        }

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
            zipPath: finalZipPath,
            thumbnailPath: thumbnailPath ? finalThumbnailPath : undefined,
            previewPath: previewPath ? finalPreviewPath : undefined
        };
    } finally {
        fs.rmSync(tempRoot, { recursive: true, force: true });
        cleanupDistributionTempDirs();
        cleanupEmptyDistributionDirs();
    }
}

function resolveDistributionPath(relativePath?: string): string {
    if (!relativePath) return '';
    return path.join(process.cwd(), relativePath.replaceAll('/', path.sep));
}

function inspectDistributionItem(item: OnlineAssetPackCatalogItem): {
    pack?: AssetPackRaw;
    broken: boolean;
    brokenReason?: string;
    missingFiles: string[];
} {
    const missingFiles: string[] = [];
    const zipPath = resolveDistributionPath(item.downloadPath);
    const thumbnailFilePath = resolveDistributionPath(item.thumbnailPath);
    const previewFilePath = resolveDistributionPath(item.previewPath);

    if (!zipPath || !fs.existsSync(zipPath)) {
        missingFiles.push(item.downloadPath);
    }
    if (item.thumbnailPath && (!thumbnailFilePath || !fs.existsSync(thumbnailFilePath))) {
        missingFiles.push(item.thumbnailPath);
    }
    if (item.previewPath && (!previewFilePath || !fs.existsSync(previewFilePath))) {
        missingFiles.push(item.previewPath);
    }

    if (!zipPath || !fs.existsSync(zipPath)) {
        return {
            broken: true,
            brokenReason: 'index.json이 가리키는 배포 산출물을 찾을 수 없습니다.',
            missingFiles
        };
    }

    try {
        return {
            pack: validatePackZip(zipPath),
            broken: missingFiles.length > 0,
            brokenReason: missingFiles.length > 0
                ? 'index.json이 가리키는 preview/thumbnail 파일을 찾을 수 없습니다.'
                : undefined,
            missingFiles
        };
    } catch (error) {
        return {
            broken: true,
            brokenReason: error instanceof Error ? error.message : '배포 ZIP 검증에 실패했습니다.',
            missingFiles
        };
    }
}

export function getAssetPackDistributionCatalog(): AssetPackDistributionCatalogItem[] {
    const index = readDistributionIndex();

    return index.assetPacks.map((item) => {
        const zipPath = resolveDistributionPath(item.downloadPath);
        const thumbnailFilePath = resolveDistributionPath(item.thumbnailPath);
        const previewFilePath = resolveDistributionPath(item.previewPath);
        const inspection = inspectDistributionItem(item);

        return {
            ...item,
            zipPath,
            thumbnailFilePath: thumbnailFilePath && fs.existsSync(thumbnailFilePath) ? thumbnailFilePath : undefined,
            previewFilePath: previewFilePath && fs.existsSync(previewFilePath) ? previewFilePath : undefined,
            pack: inspection.pack,
            broken: inspection.broken,
            brokenReason: inspection.brokenReason,
            missingFiles: inspection.missingFiles
        };
    });
}

export function deleteAssetPackDistributionItem(id: string): OnlineAssetPackCatalogFile {
    const safeId = sanitizeFilePart(id.trim());
    if (!safeId) throw new Error('삭제할 어셋팩 id가 없습니다.');

    const indexPath = path.join(DISTRIBUTION_ROOT, 'index.json');
    const index = readDistributionIndex();
    const existing = index.assetPacks.find((item) => item.id === safeId);
    const nextItems = index.assetPacks.filter((item) => item.id !== safeId);

    cleanupDistributionTempDirs();
    fs.rmSync(path.join(DISTRIBUTION_ROOT, 'packages', safeId), { recursive: true, force: true });

    if (existing?.thumbnailPath) {
        const thumbnailPath = resolveDistributionPath(existing.thumbnailPath);
        if (thumbnailPath) fs.rmSync(thumbnailPath, { force: true });
    } else {
        fs.rmSync(path.join(DISTRIBUTION_ROOT, 'thumbnails', `${safeId}.png`), { force: true });
    }
    if (existing?.previewPath) {
        const previewPath = resolveDistributionPath(existing.previewPath);
        if (previewPath) fs.rmSync(previewPath, { force: true });
    } else {
        fs.rmSync(path.join(DISTRIBUTION_ROOT, 'previews', `${safeId}.png`), { force: true });
    }

    cleanupDistributionTempDirs();
    cleanupEmptyDistributionDirs();

    ensureDir(DISTRIBUTION_ROOT);
    fs.writeFileSync(indexPath, `${JSON.stringify({ schemaVersion: 1, assetPacks: nextItems }, null, 2)}\n`, 'utf-8');
    return { schemaVersion: 1, assetPacks: nextItems };
}
