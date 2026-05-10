// src/main/services/assetService.ts
// Asset 백업, 상태 확인, UI용 asset catalog 로딩, 직접 선택 PNG preview URL 생성을 담당합니다.

import fs from 'node:fs';
import path from 'node:path';
import { getAppSettings, readJsonFile, writeJsonFile } from './configService';
import { getBundledStoragePath, getConfigPath, getResourcePath, getStoragePath } from './runtimePaths';

const CONFIG_PATH = getConfigPath('asset_config.json');
const BACKUP_ROOT = getStoragePath('backups');
const ASSET_CATALOG_PATH = getConfigPath('asset_catalog.json');
const TEXTURE_CATALOG_PATH = getConfigPath('texture_catalog.csv');
const CURRENT_FONTS_PATH = getConfigPath('current_fonts.json');
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
