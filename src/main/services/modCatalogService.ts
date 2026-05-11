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

function ensureDownloadDir(): void {
    if (!fs.existsSync(DOWNLOAD_DIR)) {
        fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
    }
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
