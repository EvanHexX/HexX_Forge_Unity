// src/main/services/modCatalogService.ts
// GitHub raw 기반 온라인 모드 catalog 조회/다운로드/업데이트 서비스입니다.

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { getAppSettings } from './configService';
import { getStoragePath } from './runtimePaths';
import {
    deletePackage,
    importZipMod,
    scanMods,
    setPackageEnabled,
    type ModPackage,
} from './modService';

const CATALOG_BASE_URL =
    'https://raw.githubusercontent.com/EvanHexX/HexX_Forge_Unity/main';
const CATALOG_INDEX_URL = `${CATALOG_BASE_URL}/mods/index.json`;
const DOWNLOAD_DIR = getStoragePath('online_mod_downloads');

export type OnlineModCatalogItem = {
    id: string;
    name: string;
    author: string;
    description: string;
    version: string;
    downloadPath: string;
    readmePath?: string;
    sha256?: string;
    gameIds?: string[];
    installedPackageId?: string;
    installedVersion?: string;
    installed?: boolean;
    updateAvailable?: boolean;
};

type OnlineModCatalogFile = {
    schemaVersion: 1;
    mods: OnlineModCatalogItem[];
};

export type ModDistributionInput = {
    id: string;
    name: string;
    author: string;
    description: string;
    version: string;
    zipPath?: string;
    readmeFilePath?: string;
    readmePath?: string;
    downloadPath?: string;
    sha256?: string;
    gameIds?: string[];
};

export type ModDistributionResult = {
    item: OnlineModCatalogItem;
    indexPath: string;
    zipPath?: string;
};

function ensureDownloadDir(): void {
    if (!fs.existsSync(DOWNLOAD_DIR)) {
        fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
    }
}

function ensureDir(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

function sanitizeFilePart(value: string): string {
    return value
        .replace(/[\\/:*?"<>|]/g, '_')
        .replace(/[^a-zA-Z0-9_.-]/g, '_')
        .trim();
}

function hashFile(filePath: string): string {
    const hash = crypto.createHash('sha256');
    hash.update(fs.readFileSync(filePath));
    return hash.digest('hex');
}

function getDistributionRoot(): string {
    const candidates = [
        path.join(process.cwd(), 'mods'),
        path.resolve(__dirname, '..', '..', '..', 'mods'),
        path.resolve(__dirname, '..', '..', 'mods'),
    ];
    return candidates.find((candidate) => fs.existsSync(path.join(candidate, 'index.json'))) ?? candidates[0];
}

function readDistributionIndex(): OnlineModCatalogFile {
    const distributionRoot = getDistributionRoot();
    const indexPath = path.join(distributionRoot, 'index.json');
    if (!fs.existsSync(indexPath)) {
        return { schemaVersion: 1, mods: [] };
    }

    const parsed = JSON.parse(fs.readFileSync(indexPath, 'utf-8')) as OnlineModCatalogFile;
    if (parsed.schemaVersion !== 1 || !Array.isArray(parsed.mods)) {
        throw new Error('mods/index.json 형식이 올바르지 않습니다.');
    }
    return parsed;
}

function writeDistributionIndex(index: OnlineModCatalogFile): string {
    const distributionRoot = getDistributionRoot();
    ensureDir(distributionRoot);
    const indexPath = path.join(distributionRoot, 'index.json');
    fs.writeFileSync(indexPath, `${JSON.stringify(index, null, 2)}\n`, 'utf-8');
    return indexPath;
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

function enrichCatalogItems(items: OnlineModCatalogItem[]): OnlineModCatalogItem[] {
    const installed = scanMods();
    const selectedGameId = getAppSettings().selectedGameId;

    return items
        .filter((item) => !item.gameIds || item.gameIds.length === 0 || item.gameIds.includes(selectedGameId))
        .map((item) => {
            const installedPackage = installed.find(
                (pkg) => pkg.source?.type === 'github' && pkg.source.catalogId === item.id
            );
            const installedVersion = installedPackage?.version;
            return {
                ...item,
                installedPackageId: installedPackage?.id,
                installedVersion,
                installed: Boolean(installedPackage),
                updateAvailable: Boolean(
                    installedVersion && compareVersions(item.version, installedVersion) > 0
                ),
            };
        });
}

export async function getOnlineModCatalog(): Promise<OnlineModCatalogItem[]> {
    const response = await fetch(CATALOG_INDEX_URL, {
        headers: {
            accept: 'application/vnd.github+json, application/json',
            'user-agent': 'HexX-Forge',
        },
    });

    if (!response.ok) {
        throw new Error(`온라인 모드 목록 요청 실패: ${response.status}`);
    }

    const catalog = (await response.json()) as OnlineModCatalogFile;
    if (catalog.schemaVersion !== 1 || !Array.isArray(catalog.mods)) {
        throw new Error('온라인 모드 목록 형식이 올바르지 않습니다.');
    }

    return enrichCatalogItems(catalog.mods);
}

async function downloadCatalogZip(item: OnlineModCatalogItem): Promise<string> {
    ensureDownloadDir();

    const downloadUrl = `${CATALOG_BASE_URL}/${item.downloadPath.replace(/^\/+/, '')}`;
    const response = await fetch(downloadUrl, {
        headers: { 'user-agent': 'HexX-Forge' },
    });

    if (!response.ok) {
        throw new Error(`모드 다운로드 실패: ${response.status}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    if (item.sha256) {
        const hash = crypto.createHash('sha256').update(buffer).digest('hex');
        if (hash.toLowerCase() !== item.sha256.toLowerCase()) {
            throw new Error('다운로드한 모드 파일의 sha256 값이 일치하지 않습니다.');
        }
    }

    const safeName = item.id.replace(/[^a-zA-Z0-9_.-]/g, '_');
    const targetPath = path.join(DOWNLOAD_DIR, `${safeName}-${item.version}.zip`);
    fs.writeFileSync(targetPath, buffer);
    return targetPath;
}

function findInstalledPackage(item: OnlineModCatalogItem, packages: ModPackage[]): ModPackage | undefined {
    return packages.find((pkg) => pkg.source?.type === 'github' && pkg.source.catalogId === item.id);
}

export async function installOnlineMod(item: OnlineModCatalogItem): Promise<ModPackage[]> {
    const existing = findInstalledPackage(item, scanMods());
    if (existing) {
        deletePackage(existing.id);
    }

    const zipPath = await downloadCatalogZip(item);
    return importZipMod(zipPath, {
        version: item.version,
        source: {
            type: 'github',
            catalogId: item.id,
            downloadPath: item.downloadPath,
        },
    });
}

export async function updateOnlineMod(item: OnlineModCatalogItem): Promise<ModPackage[]> {
    const existing = findInstalledPackage(item, scanMods());
    const wasEnabled = existing?.enabled === true;
    const packages = await installOnlineMod(item);
    const updated = findInstalledPackage(item, packages);
    if (wasEnabled && updated) {
        return setPackageEnabled(updated.id, true).packages;
    }
    return packages;
}

export async function getOnlineModReadme(readmePath: string): Promise<string> {
    const normalized = readmePath.replace(/^\/+/, '');
    if (!normalized || !normalized.toLowerCase().endsWith('.md')) {
        throw new Error('온라인 README 경로가 올바르지 않습니다.');
    }
    const response = await fetch(`${CATALOG_BASE_URL}/${normalized}`, {
        headers: { 'user-agent': 'HexX-Forge' },
    });
    if (!response.ok) {
        throw new Error(`온라인 README 요청 실패: ${response.status}`);
    }
    return response.text();
}

export function getModDistributionCatalog(): OnlineModCatalogItem[] {
    return readDistributionIndex().mods.sort((a, b) => a.name.localeCompare(b.name));
}

export function saveModDistributionItem(input: ModDistributionInput): ModDistributionResult {
    const id = sanitizeFilePart(input.id.trim());
    const version = sanitizeFilePart(input.version.trim());
    const name = input.name.trim();
    const author = input.author.trim();
    const description = input.description.trim();

    if (!id) throw new Error('모드 id를 입력하세요.');
    if (!name) throw new Error('모드 이름을 입력하세요.');
    if (!author) throw new Error('제작자를 입력하세요.');
    if (!description) throw new Error('설명을 입력하세요.');
    if (!version) throw new Error('version을 입력하세요.');

    let zipPath: string | undefined;
    let downloadPath = input.downloadPath?.trim() || '';
    let readmePath = input.readmePath?.trim() || undefined;
    let sha256 = input.sha256?.trim() || undefined;

    if (input.zipPath) {
        if (!fs.existsSync(input.zipPath)) throw new Error('배포할 모드 ZIP 파일을 찾을 수 없습니다.');
        const packageDir = path.join(getDistributionRoot(), 'packages', id, version);
        fs.rmSync(packageDir, { recursive: true, force: true });
        ensureDir(packageDir);
        zipPath = path.join(packageDir, `${id}.${version}.zip`);
        fs.copyFileSync(input.zipPath, zipPath);
        downloadPath = `mods/packages/${id}/${version}/${id}.${version}.zip`;
        sha256 = hashFile(zipPath);
    }

    if (input.readmeFilePath) {
        if (!fs.existsSync(input.readmeFilePath)) throw new Error('README md 파일을 찾을 수 없습니다.');
        const readmeDir = path.join(getDistributionRoot(), 'readmes', id, version);
        ensureDir(readmeDir);
        const readmeName = `${id}.${version}.md`;
        const readmeTargetPath = path.join(readmeDir, readmeName);
        fs.copyFileSync(input.readmeFilePath, readmeTargetPath);
        readmePath = `mods/readmes/${id}/${version}/${readmeName}`;
    }

    if (!downloadPath) {
        throw new Error('ZIP을 선택하거나 downloadPath를 입력하세요.');
    }

    const item: OnlineModCatalogItem = {
        id,
        name,
        author,
        description,
        version,
        downloadPath,
        readmePath,
        sha256,
        gameIds: input.gameIds?.map((value) => value.trim()).filter(Boolean),
    };

    const index = readDistributionIndex();
    const filtered = index.mods.filter((existing) => existing.id !== id);
    filtered.push(item);
    filtered.sort((a, b) => a.name.localeCompare(b.name));
    const indexPath = writeDistributionIndex({ schemaVersion: 1, mods: filtered });

    return { item, indexPath, zipPath };
}

export function deleteModDistributionItem(id: string): { indexPath: string; deletedPackageDir?: string } {
    const normalizedId = sanitizeFilePart(id.trim());
    if (!normalizedId) throw new Error('삭제할 모드 id가 없습니다.');

    const index = readDistributionIndex();
    const filtered = index.mods.filter((item) => item.id !== normalizedId);
    const indexPath = writeDistributionIndex({ schemaVersion: 1, mods: filtered });

    const packageDir = path.join(getDistributionRoot(), 'packages', normalizedId);
    let deletedPackageDir: string | undefined;
    if (fs.existsSync(packageDir)) {
        fs.rmSync(packageDir, { recursive: true, force: true });
        deletedPackageDir = packageDir;
    }

    return { indexPath, deletedPackageDir };
}
