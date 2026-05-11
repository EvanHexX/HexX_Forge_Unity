// src/main/services/modService.ts
// BepInEx/plugins 하위 DLL 모드를 재귀 스캔하고 활성/비활성/추가/삭제를 처리합니다.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import AdmZip from 'adm-zip';
import { getAppSettings, readJsonFile, writeJsonFile } from './configService';
import { getConfigPath, getStorageDir, getStoragePath } from './runtimePaths';

const STORAGE_DIR = getStorageDir();
const DISABLED_MODS_DIR = getStoragePath('disabled_mods');
const PACKAGES_DIR = getStoragePath('packages');
const MOD_LIST_PATH = getConfigPath('mod_list.json');

function stripJsonBom(text: string): string {
    return text.replace(/^[\uFEFF\u200B\u200C\u200D\u2060]+/, '');
}

function parseJsonText<T>(text: string, fallback?: T): T {
    try {
        return JSON.parse(stripJsonBom(text)) as T;
    } catch (err) {
        if (arguments.length >= 2) return fallback as T;
        throw err;
    }
}

// ── Types ──────────────────────────────────────────────────────────

export type ModFileType = 'dll' | 'asset' | 'mod-info' | 'script' | 'config' | 'folder';

export type ModFileInfo = {
    path: string;
    type: ModFileType;
    name?: string;
    author?: string;
    dependsOn?: string;
};

export type PackageDependency = {
    target: string;
    displayName?: string;
    installBase?: string;
};

export type PackageMeta = {
    id: string;
    name: string;
    author: string;
    description: string;
    packageType: 'collection' | 'single';
    dllPaths: string[];
    files: ModFileInfo[];
    enabled?: boolean;
    dependency?: PackageDependency;
    version?: string;
    source?: ModPackageSource;
};

export type DllEntry = {
    relativePath: string;
    displayName: string;
    author: string;
    enabled: boolean;
};

export type ModPackage = {
    id: string;
    name: string;
    author: string;
    description: string;
    packageType: 'collection' | 'single';
    enabled: boolean | 'mixed';
    dlls: DllEntry[];
    hasSettings: boolean;
    dependency?: PackageDependency;
    dependencyState?: 'ok' | 'missing' | 'disabled';
    dependencyParentId?: string;
    installPathHints?: string[];
    version?: string;
    source?: ModPackageSource;
};

export type ModPackageSource = {
    type: 'github';
    catalogId: string;
    downloadPath: string;
};

export type ImportPackageMetadata = {
    version?: string;
    source?: ModPackageSource;
};

// Settings types
export type ScriptFieldType = 'switch' | 'select' | 'number' | 'text' | 'file_picker' | 'image_picker' | 'video_picker';

export type ScriptField = {
    id: string;
    label: string;
    ui_type: ScriptFieldType;
    target?: { type: 'cfg'; path: string; section: string; key: string };
    default?: boolean | string | number;
    value?: string | number | boolean;
    options?: Array<{ label: string; value: string }>;
    min?: number;
    max?: number;
    step?: number;
    action?: string;
    accept?: string;
    preview?: boolean;
    target_path?: string;
    jsonPath?: string;
};

export type ScriptSection = {
    title: string;
    fields: ScriptField[];
};

export type ScriptConfig = {
    type: 'configurator';
    version?: number;
    sections?: ScriptSection[];
    features?: ScriptFeature[];
};

export type PackageSettings = {
    scripts: Array<{ scriptPath: string; config: ScriptConfig }>;
    features: ScriptFeature[];
    warnings: string[];
    managedFiles: ManagedFileGroup[];
    configPaths: string[];
    cfgValues: Record<string, string>;
    jsonValues: Record<string, string | number | boolean>;
};

export type ConfiguratorFeatureType = 'cfg_fields' | 'file_manager' | 'json_manager';

export type ScriptFeature = {
    id: string;
    type: ConfiguratorFeatureType;
    name: string;
    cfgPath?: string;
    targetDir?: string;
    extensions?: string[];
    jsonPath?: string;
    linkedConfigPath?: string;
    linkedConfigArrayPath?: string;
    linkedConfigValueKey?: string;
    linkedConfigTargetPath?: string;
    linkedConfigPathSegments?: string[];
    linkedConfigKeyTemplate?: string;
    linkedConfigFilterKey?: string;
    linkedConfigFilterValue?: string;
    linkedConfigAssetPath?: string;
    linkedConfigSelectedFields?: string[];
    linkedConfigFieldDefaults?: Record<string, unknown>;
    sample?: unknown;
    fields?: ScriptField[];
};

export type ManagedFileGroup = {
    featureId: string;
    managedName: string;
    targetDir: string;
    files: string[];
};

export type ApplyPackageSettingsChanges = {
    cfgValues: Record<string, string>;
    jsonValues: Record<string, string | number | boolean>;
    fileImports: Array<{ featureId: string; sourcePath: string; metadata?: Record<string, unknown> }>;
    fileDeletes: Array<{ featureId: string; fileName: string }>;
    configText?: { path: string; content: string } | null;
};

// ZIP Inspect types
export type ZipEntryInfo = {
    entryName: string;
    isDirectory: boolean;
    size: number;
    suggestedType: ModFileType;
    fromModInfo: boolean;
    modInfoData?: {
        name?: string;
        author?: string;
        type?: string;
        dependsOn?: string;
    };
    mismatch?: 'missing_in_zip' | 'missing_in_modinfo';
};

export type ZipInspectResult = {
    hasModInfo: boolean;
    modInfo: {
        name: string;
        author: string;
        description: string;
        packageType: 'collection' | 'single';
        version?: string;
        dependency?: PackageDependency;
    } | null;
    entries: ZipEntryInfo[];
    warnings: string[];
};

// Internal mod list format
type ModMeta = {
    name?: string;
    author?: string;
    description?: string;
    packageId?: string;
    version?: string;
    source?: ModPackageSource;
};

type ModListFile = {
    packages: Record<string, PackageMeta>;
    mods: Record<string, ModMeta>;
};

type LegacyModList = Record<string, ModMeta>;

type HexXModInfoFile = {
    name?: string;
    author?: string;
    description?: string;
    packageType?: 'collection' | 'single';
    version?: string;
    dependency?: PackageDependency;
    files?: Array<{
        path: string;
        name?: string;
        author?: string;
        description?: string;
        type?: string;
        dependsOn?: string;
    }>;
};

type PackModSource = {
    sourcePath: string;
    sourceKind: 'dll' | 'zip';
    name: string;
    author: string;
    description?: string;
    packageType: 'collection' | 'single';
    files: Array<{
        entryName: string;
        type: ModFileType;
        name?: string;
        author?: string;
        dependsOn?: string;
        contentTextOverride?: string;
    }>;
};

type DependencyResolution = {
    parent?: PackageMeta;
    parentName?: string;
    parentId?: string;
    state?: 'ok' | 'missing' | 'disabled';
};

// ── Helpers ────────────────────────────────────────────────────────

function ensureDirs(): void {
    for (const dir of [DISABLED_MODS_DIR, PACKAGES_DIR]) {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }
}

function getPluginsDir(): string {
    const { gamePath } = getAppSettings();
    if (!gamePath) return '';
    return path.join(gamePath, 'BepInEx', 'plugins');
}

function getConfigDir(): string {
    const { gamePath } = getAppSettings();
    if (!gamePath) return '';
    return path.join(gamePath, 'BepInEx', 'config');
}

function normalizeRelativePath(value: string): string {
    return value.replaceAll('\\', '/').replace(/^\/+/, '');
}

function toEnabledDllRelativePath(value: string): string {
    const normalized = normalizeRelativePath(value);
    return normalized.toLowerCase().startsWith('plugins/') ? normalized : `plugins/${normalized}`;
}

function toLegacyDllRelativePath(value: string): string {
    const normalized = normalizeRelativePath(value);
    return normalized.toLowerCase().startsWith('plugins/') ? normalized.slice('plugins/'.length) : normalized;
}

function getActiveDllPath(relativePath: string): string {
    const bepInExDir = getBepInExDir();
    if (!bepInExDir) return '';
    return path.join(bepInExDir, toEnabledDllRelativePath(relativePath));
}

function getActiveDllPathCandidates(relativePath: string): string[] {
    const bepInExDir = getBepInExDir();
    if (!bepInExDir) return [];
    const normalized = normalizeRelativePath(relativePath);
    const enabledRelative = toEnabledDllRelativePath(normalized);
    const candidates = [path.join(bepInExDir, enabledRelative)];
    if (normalized !== enabledRelative) candidates.push(path.join(bepInExDir, normalized));
    return [...new Set(candidates)];
}

function getDisabledDllPath(relativePath: string): string {
    return path.join(DISABLED_MODS_DIR, normalizeRelativePath(relativePath));
}

function getDisabledDllPathCandidates(relativePath: string): string[] {
    const normalized = normalizeRelativePath(relativePath);
    const legacy = toLegacyDllRelativePath(normalized);
    return [...new Set([path.join(DISABLED_MODS_DIR, normalized), path.join(DISABLED_MODS_DIR, legacy)])];
}

function readModListFile(): ModListFile {
    const raw = readJsonFile<ModListFile | LegacyModList>(MOD_LIST_PATH, { packages: {}, mods: {} });

    if (!('packages' in raw) || !('mods' in raw)) {
        const legacy = raw as LegacyModList;
        const mods: Record<string, ModMeta> = {};
        for (const [key, val] of Object.entries(legacy)) {
            mods[key] = val as ModMeta;
        }
        return { packages: {}, mods };
    }

    return raw as ModListFile;
}

function saveModListFile(data: ModListFile): void {
    writeJsonFile(MOD_LIST_PATH, data);
}

function getPackageIdentityKeys(pkg: PackageMeta): string[] {
    return [
        pkg.source?.catalogId,
        pkg.id,
        pkg.name,
    ]
        .filter((value): value is string => Boolean(value?.trim()))
        .map((value) => value.trim().toLowerCase());
}

function getStandaloneIdentityKeys(relativePath: string, meta: ModMeta = {}): string[] {
    return [
        meta.source?.catalogId,
        normalizeRelativePath(relativePath),
        toEnabledDllRelativePath(relativePath),
        toLegacyDllRelativePath(relativePath),
        path.basename(relativePath),
        meta.name,
    ]
        .filter((value): value is string => Boolean(value?.trim()))
        .map((value) => value.trim().toLowerCase());
}

function getPackageEnabledFromMeta(pkg: PackageMeta, dlls: DllEntry[] = []): boolean | 'mixed' {
    if ((pkg.dllPaths ?? []).length === 0) return Boolean(pkg.enabled);
    const enabledCount = dlls.filter((d) => d.enabled).length;
    if (enabledCount === 0) return false;
    return enabledCount === dlls.length ? true : 'mixed';
}

function isPackageActive(pkg: PackageMeta, dlls: DllEntry[] = []): boolean {
    return getPackageEnabledFromMeta(pkg, dlls) === true;
}

function resolvePackageDependency(
    modListFile: ModListFile,
    pkg: PackageMeta,
    packageDllsMap: Map<string, DllEntry[]> = new Map()
): DependencyResolution {
    const target = pkg.dependency?.target?.trim();
    if (!target) return {};
    const targetKey = target.toLowerCase();
    for (const [candidateId, candidate] of Object.entries(modListFile.packages)) {
        if (candidateId === pkg.id) continue;
        if (!getPackageIdentityKeys(candidate).includes(targetKey)) continue;
        const parentActive = isPackageActive(candidate, packageDllsMap.get(candidateId) ?? []);
        return {
            parent: candidate,
            parentId: candidateId,
            state: parentActive ? 'ok' : 'disabled',
        };
    }
    for (const [relativePath, meta] of Object.entries(modListFile.mods)) {
        if (meta.packageId) continue;
        if (!getStandaloneIdentityKeys(relativePath, meta).includes(targetKey)) continue;
        const active = getActiveDllPathCandidates(relativePath).some((candidate) => fs.existsSync(candidate));
        return {
            parentName: meta.name || path.basename(relativePath),
            parentId: relativePath,
            state: active ? 'ok' : 'disabled',
        };
    }
    return { state: 'missing' };
}

function getActiveDependentPackagesByKeys(
    modListFile: ModListFile,
    parentKeys: string[],
    packageDllsMap: Map<string, DllEntry[]> = new Map()
): PackageMeta[] {
    return Object.values(modListFile.packages).filter((candidate) => {
        const target = candidate.dependency?.target?.trim().toLowerCase();
        if (!target || !parentKeys.includes(target)) return false;
        return isPackageActive(candidate, packageDllsMap.get(candidate.id) ?? []);
    });
}

function getActiveDependentPackages(
    modListFile: ModListFile,
    parentPkg: PackageMeta,
    packageDllsMap: Map<string, DllEntry[]> = new Map()
): PackageMeta[] {
    return getActiveDependentPackagesByKeys(modListFile, getPackageIdentityKeys(parentPkg), packageDllsMap);
}

function listDllsRecursive(
    rootDir: string
): Array<{ fileName: string; relativePath: string; fullPath: string }> {
    if (!rootDir || !fs.existsSync(rootDir)) return [];

    const results: Array<{ fileName: string; relativePath: string; fullPath: string }> = [];

    function walk(currentDir: string): void {
        for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
            const fullPath = path.join(currentDir, entry.name);
            if (entry.isDirectory()) {
                walk(fullPath);
                continue;
            }
            if (entry.isFile() && entry.name.toLowerCase().endsWith('.dll')) {
                results.push({
                    fileName: entry.name,
                    relativePath: normalizeRelativePath(path.relative(rootDir, fullPath)),
                    fullPath,
                });
            }
        }
    }

    walk(rootDir);
    return results;
}

function buildPackageDllsMap(modListFile: ModListFile): Map<string, DllEntry[]> {
    const pluginsDir = getPluginsDir();
    const enabledDlls = listDllsRecursive(pluginsDir).map((item) => ({
        ...item,
        relativePath: toEnabledDllRelativePath(item.relativePath),
        enabled: true,
    }));
    const disabledDlls = listDllsRecursive(DISABLED_MODS_DIR).map((item) => ({ ...item, enabled: false }));
    const packageDllsMap = new Map<string, DllEntry[]>();

    for (const dll of [...enabledDlls, ...disabledDlls]) {
        const legacyPath = toLegacyDllRelativePath(dll.relativePath);
        const enabledPath = toEnabledDllRelativePath(dll.relativePath);
        const meta =
            modListFile.mods[dll.relativePath] ??
            modListFile.mods[enabledPath] ??
            modListFile.mods[legacyPath] ??
            modListFile.mods[dll.fileName] ??
            {};
        if (!meta.packageId || !modListFile.packages[meta.packageId]) continue;
        if (!packageDllsMap.has(meta.packageId)) packageDllsMap.set(meta.packageId, []);
        packageDllsMap.get(meta.packageId)!.push({
            relativePath: dll.relativePath,
            displayName: meta.name || dll.fileName,
            author: meta.author || '',
            enabled: dll.enabled,
        });
    }

    return packageDllsMap;
}

function ensureParentDir(filePath: string): void {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

function moveFileCrossDeviceSafe(from: string, to: string): void {
    ensureParentDir(to);
    try {
        fs.renameSync(from, to);
    } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (code !== 'EXDEV') throw error;
        fs.copyFileSync(from, to);
        fs.unlinkSync(from);
    }
}

function generateId(): string {
    return crypto.randomUUID();
}

function parseCfgValue(content: string, section: string, key: string): string | null {
    const lines = content.split('\n');
    let inSection = false;

    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
            inSection = trimmed.slice(1, -1).trim() === section;
            continue;
        }
        if (inSection && !trimmed.startsWith('#') && !trimmed.startsWith(';') && !trimmed.startsWith('//')) {
            const eqIdx = trimmed.indexOf('=');
            if (eqIdx !== -1 && trimmed.slice(0, eqIdx).trim() === key) {
                return trimmed.slice(eqIdx + 1).trim();
            }
        }
    }
    return null;
}

function suggestFileType(entryName: string, isDirectory: boolean): ModFileType {
    if (isDirectory) return 'folder';
    const lower = entryName.toLowerCase();
    const base = path.basename(lower);

    if (base === 'mod-info.json' || base === 'hexx-mod-info.json') return 'mod-info';
    if (lower.endsWith('.dll')) return 'dll';
    if (lower.endsWith('.cfg')) return 'config';
    if (/\.(png|jpg|jpeg|gif|webp|webm|bmp|tga|tiff)$/.test(lower)) return 'asset';
    if (lower.endsWith('.json')) return 'config';
    return 'asset';
}

function isBepInExRootedPath(relativePath: string): boolean {
    const top = normalizeRelativePath(relativePath).split('/')[0]?.toLowerCase();
    return top === 'plugins' || top === 'config' || top === 'patchers';
}

function getPackageInstallBase(pkgMeta: PackageMeta): string {
    const installBase = normalizeRelativePath(pkgMeta.dependency?.installBase ?? '').replace(/\/+$/, '');
    if (!installBase || path.isAbsolute(installBase) || installBase.includes('..')) return '';
    return installBase;
}

function sanitizePackageDependency(dependency?: PackageDependency): PackageDependency | undefined {
    if (!dependency?.target?.trim()) return undefined;
    const installBase = normalizeRelativePath(dependency.installBase ?? '').replace(/\/+$/, '');
    return {
        target: dependency.target.trim(),
        displayName: dependency.displayName?.trim() || undefined,
        installBase:
            installBase && !path.isAbsolute(installBase) && !installBase.includes('..')
                ? installBase
                : undefined,
    };
}

function getDeployRelativePath(pkgMeta: PackageMeta, file: Pick<ModFileInfo, 'path' | 'type'>): string {
    const normalizedPath = normalizeRelativePath(file.path).replace(/\/+$/, '');
    if (file.type !== 'script' && file.type !== 'mod-info' && file.type !== 'dll' && !isBepInExRootedPath(normalizedPath)) {
        const installBase = getPackageInstallBase(pkgMeta);
        if (installBase) return normalizeRelativePath(path.posix.join(installBase, normalizedPath));
    }
    return normalizedPath;
}

function collectInstallPathHints(pkgMeta: PackageMeta): string[] {
    const protectedTopLevel = new Set(['plugins', 'config', 'patchers']);
    const hints = new Set<string>();
    const addHint = (value: string, includeSelf = false) => {
        const normalized = normalizeRelativePath(value).replace(/\/+$/, '');
        if (!normalized) return;
        const parts = normalized.split('/').filter(Boolean);
        const max = includeSelf ? parts.length : parts.length - 1;
        for (let i = 1; i <= max; i++) {
            const hint = parts.slice(0, i).join('/');
            if (!hint || protectedTopLevel.has(hint.toLowerCase())) continue;
            hints.add(hint);
        }
    };
    for (const file of pkgMeta.files) {
        addHint(file.path, file.type === 'folder');
    }
    for (const dllPath of pkgMeta.dllPaths) {
        addHint(dllPath);
    }
    return [...hints].sort((a, b) => a.localeCompare(b));
}

// Deploy package non-DLL files to game directory
function deployPackageFiles(pkgMeta: PackageMeta, pkgDir: string): void {
    const bepInExDir = getBepInExDir();

    for (const file of pkgMeta.files) {
        const src = path.join(pkgDir, file.path);
        if (!fs.existsSync(src)) continue;

        if ((file.type === 'config' || file.type === 'asset') && bepInExDir) {
            const dst = resolveBepInExRelative(getDeployRelativePath(pkgMeta, file));
            if (!fs.existsSync(dst)) {
                ensureParentDir(dst);
                fs.copyFileSync(src, dst);
            }
        }
    }
}

// ── Scan ───────────────────────────────────────────────────────────

export function scanMods(): ModPackage[] {
    ensureDirs();

    const pluginsDir = getPluginsDir();
    const modListFile = readModListFile();

    const enabledDlls = listDllsRecursive(pluginsDir).map((item) => ({
        ...item,
        relativePath: toEnabledDllRelativePath(item.relativePath),
        enabled: true,
    }));
    const disabledDlls = listDllsRecursive(DISABLED_MODS_DIR).map((item) => ({ ...item, enabled: false }));
    const allDlls = [...enabledDlls, ...disabledDlls];

    const packageDllsMap = new Map<string, DllEntry[]>();
    const standalonePackages: ModPackage[] = [];

    for (const dll of allDlls) {
        const legacyPath = toLegacyDllRelativePath(dll.relativePath);
        const enabledPath = toEnabledDllRelativePath(dll.relativePath);
        const meta =
            modListFile.mods[dll.relativePath] ??
            modListFile.mods[enabledPath] ??
            modListFile.mods[legacyPath] ??
            modListFile.mods[dll.fileName] ??
            {};
        const dllEntry: DllEntry = {
            relativePath: dll.relativePath,
            displayName: meta.name || dll.fileName,
            author: meta.author || '',
            enabled: dll.enabled,
        };

        if (meta.packageId && modListFile.packages[meta.packageId]) {
            if (!packageDllsMap.has(meta.packageId)) {
                packageDllsMap.set(meta.packageId, []);
            }
            packageDllsMap.get(meta.packageId)!.push(dllEntry);
        } else {
            standalonePackages.push({
                id: dll.relativePath,
                name: dllEntry.displayName,
                author: dllEntry.author,
                description: meta.description || '',
                packageType: 'single',
                enabled: dll.enabled,
                dlls: [dllEntry],
                hasSettings: false,
                version: meta.version,
                source: meta.source,
            });
        }
    }

    const packages: ModPackage[] = [];

    for (const [pkgId, pkgMeta] of Object.entries(modListFile.packages)) {
        const dlls = packageDllsMap.get(pkgId) ?? [];
        const enabled = getPackageEnabledFromMeta(pkgMeta, dlls);

        const hasSettings = pkgMeta.files.some((f) => f.type === 'script' || f.type === 'config');
        const dependency = resolvePackageDependency(modListFile, pkgMeta, packageDllsMap);

        packages.push({
            id: pkgId,
            name: pkgMeta.name,
            author: pkgMeta.author,
            description: pkgMeta.description,
            packageType: pkgMeta.packageType,
            enabled,
            dlls: dlls.sort((a, b) => a.relativePath.localeCompare(b.relativePath)),
            hasSettings,
            dependency: pkgMeta.dependency,
            dependencyState: dependency.state,
            dependencyParentId: dependency.parentId,
            installPathHints: collectInstallPathHints(pkgMeta),
            version: pkgMeta.version,
            source: pkgMeta.source,
        });
    }

    return [...packages, ...standalonePackages].sort((a, b) => a.name.localeCompare(b.name));
}

// ── Toggle Enable ──────────────────────────────────────────────────

export function setPackageEnabled(packageId: string, enabled: boolean): { packages: ModPackage[]; warnings: string[] } {
    ensureDirs();

    const bepInExDir = getBepInExDir();
    if (!bepInExDir) throw new Error('게임 경로가 설정되지 않았습니다.');

    const modListFile = readModListFile();
    const pkgMeta = modListFile.packages[packageId];
    const packageDllsMap = buildPackageDllsMap(modListFile);
    const dllPaths: string[] = pkgMeta?.dllPaths ?? [packageId];
    const warnings: string[] = [];

    if (enabled && pkgMeta?.dependency?.target) {
        const dependency = resolvePackageDependency(modListFile, pkgMeta, packageDllsMap);
        if (dependency.state === 'missing') {
            throw new Error(`메인 모드를 찾을 수 없습니다: ${pkgMeta.dependency.displayName || pkgMeta.dependency.target}`);
        }
        if (dependency.state === 'disabled') {
            throw new Error(`메인 모드가 비활성 상태입니다: ${dependency.parent?.name || dependency.parentName || pkgMeta.dependency.displayName || pkgMeta.dependency.target}`);
        }
    }

    if (!enabled && pkgMeta) {
        const dependents = getActiveDependentPackages(modListFile, pkgMeta, packageDllsMap);
        if (dependents.length > 0) {
            throw new Error(`활성화된 종속 모드가 있습니다. 먼저 비활성화하거나 삭제해 주세요: ${dependents.map((item) => item.name).join(', ')}`);
        }
    }
    if (!enabled && !pkgMeta) {
        const meta =
            modListFile.mods[packageId] ??
            modListFile.mods[toEnabledDllRelativePath(packageId)] ??
            modListFile.mods[toLegacyDllRelativePath(packageId)] ??
            {};
        const dependents = getActiveDependentPackagesByKeys(
            modListFile,
            getStandaloneIdentityKeys(packageId, meta),
            packageDllsMap
        );
        if (dependents.length > 0) {
            throw new Error(`활성화된 종속 모드가 있습니다. 먼저 비활성화하거나 삭제해 주세요: ${dependents.map((item) => item.name).join(', ')}`);
        }
    }

    for (const relativePath of dllPaths) {
        const fromCandidates = enabled
            ? getDisabledDllPathCandidates(relativePath)
            : getActiveDllPathCandidates(relativePath);
        const from = fromCandidates.find((candidate) => fs.existsSync(candidate)) ?? fromCandidates[0];
        const to = enabled
            ? getActiveDllPath(relativePath)
            : getDisabledDllPath(relativePath);

        if (enabled && fs.existsSync(to)) {
            warnings.push(`파일 충돌: ${relativePath} 이(가) 이미 활성화 상태입니다. 해당 DLL은 건너뜁니다.`);
            continue;
        }

        if (fs.existsSync(from)) {
            moveFileCrossDeviceSafe(from, to);
        }
    }

    // Deploy config/asset files when enabling
    if (enabled && pkgMeta) {
        const pkgDir = path.join(PACKAGES_DIR, packageId);
        deployPackageFiles(pkgMeta, pkgDir);
    }
    if (!enabled && pkgMeta) {
        const folderPaths = pkgMeta.files
            .filter((file) => file.type === 'folder')
            .map((file) => getDeployRelativePath(pkgMeta, file));
        if (folderPaths.length > 0) tryDeleteFolders(folderPaths, bepInExDir);
    }

    if (pkgMeta && (pkgMeta.dllPaths ?? []).length === 0) {
        pkgMeta.enabled = enabled;
        saveModListFile(modListFile);
    }

    return { packages: scanMods(), warnings };
}

export function setDllEnabled(relativePath: string, enabled: boolean): { packages: ModPackage[]; warnings: string[] } {
    ensureDirs();

    const bepInExDir = getBepInExDir();
    if (!bepInExDir) throw new Error('게임 경로가 설정되지 않았습니다.');

    const safeRelativePath = normalizeRelativePath(relativePath);
    const fromCandidates = enabled
        ? getDisabledDllPathCandidates(safeRelativePath)
        : getActiveDllPathCandidates(safeRelativePath);
    const from = fromCandidates.find((candidate) => fs.existsSync(candidate)) ?? fromCandidates[0];
    const to = enabled
        ? getActiveDllPath(safeRelativePath)
        : getDisabledDllPath(safeRelativePath);

    if (enabled && fs.existsSync(to)) {
        return {
            packages: scanMods(),
            warnings: [`파일 충돌: ${safeRelativePath} 이(가) 이미 활성화 상태입니다.`],
        };
    }

    if (!fs.existsSync(from)) throw new Error(`이동할 DLL 파일이 없습니다: ${from}`);

    moveFileCrossDeviceSafe(from, to);
    return { packages: scanMods(), warnings: [] };
}

export function setModEnabled(relativePath: string, enabled: boolean): { packages: ModPackage[]; warnings: string[] } {
    return setDllEnabled(relativePath, enabled);
}

// ── Delete ─────────────────────────────────────────────────────────

export function deletePackage(packageId: string): ModPackage[] {
    const bepInExDir = getBepInExDir();
    const modListFile = readModListFile();

    let dllPaths: string[];
    let folderPaths: string[] = [];

    if (modListFile.packages[packageId]) {
        const pkg = modListFile.packages[packageId];
        const dependents = getActiveDependentPackages(modListFile, pkg, buildPackageDllsMap(modListFile));
        if (dependents.length > 0) {
            throw new Error(`활성화된 종속 모드가 있습니다. 먼저 비활성화하거나 삭제해 주세요: ${dependents.map((item) => item.name).join(', ')}`);
        }
        dllPaths = pkg.dllPaths;
        folderPaths = pkg.files.filter((f) => f.type === 'folder').map((f) => getDeployRelativePath(pkg, f));

        const pkgDir = path.join(PACKAGES_DIR, packageId);
        if (fs.existsSync(pkgDir)) {
            fs.rmSync(pkgDir, { recursive: true, force: true });
        }

        for (const dllPath of dllPaths) {
            delete modListFile.mods[dllPath];
        }
        delete modListFile.packages[packageId];
    } else {
        dllPaths = [packageId];
        const meta =
            modListFile.mods[packageId] ??
            modListFile.mods[toEnabledDllRelativePath(packageId)] ??
            modListFile.mods[toLegacyDllRelativePath(packageId)] ??
            {};
        const dependents = getActiveDependentPackagesByKeys(
            modListFile,
            getStandaloneIdentityKeys(packageId, meta),
            buildPackageDllsMap(modListFile)
        );
        if (dependents.length > 0) {
            throw new Error(`활성화된 종속 모드가 있습니다. 먼저 비활성화하거나 삭제해 주세요: ${dependents.map((item) => item.name).join(', ')}`);
        }
        if (modListFile.mods[packageId]) {
            delete modListFile.mods[packageId];
        }
    }

    saveModListFile(modListFile);

    let deletedFromActive = false;
    let deletedFromDisabled = false;
    for (const relativePath of dllPaths) {
        const enabledPath = getActiveDllPathCandidates(relativePath).find((candidate) => fs.existsSync(candidate)) ?? '';
        const disabledPath = getDisabledDllPathCandidates(relativePath).find((candidate) => fs.existsSync(candidate)) ?? '';

        if (enabledPath) {
            fs.unlinkSync(enabledPath);
            deletedFromActive = true;
        } else if (disabledPath) {
            fs.unlinkSync(disabledPath);
            deletedFromDisabled = true;
        }
    }
    if (folderPaths.length > 0) {
        if (deletedFromActive && bepInExDir) tryDeleteFolders(folderPaths, bepInExDir);
        if (deletedFromDisabled || dllPaths.length === 0) tryDeleteFolders(folderPaths, DISABLED_MODS_DIR);
        if (!deletedFromActive && bepInExDir && dllPaths.length === 0) tryDeleteFolders(folderPaths, bepInExDir);
    }

    return scanMods();
}

function tryDeleteFolders(folderPaths: string[], baseDir: string): void {
    const protectedTopLevel = new Set(['plugins', 'config', 'patchers']);
    for (const folderPath of folderPaths) {
        const normalized = normalizeRelativePath(folderPath).replace(/\/+$/, '');
        if (!normalized || protectedTopLevel.has(normalized.toLowerCase())) continue;
        const fullPath = path.resolve(baseDir, normalized);
        const baseResolved = path.resolve(baseDir);
        if (fullPath === baseResolved || !fullPath.startsWith(`${baseResolved}${path.sep}`)) continue;
        if (fs.existsSync(fullPath)) {
            try {
                fs.rmSync(fullPath, { recursive: true, force: true });
            } catch {
                // ignore
            }
        }
    }
}

export function deleteMod(relativePath: string): ModPackage[] {
    return deletePackage(relativePath);
}

// ── Import ─────────────────────────────────────────────────────────

export function importDllMod(filePath: string, name: string, author: string, version?: string): ModPackage[] {
    ensureDirs();

    const fileName = path.basename(filePath);
    if (!fileName.toLowerCase().endsWith('.dll')) {
        throw new Error('DLL 파일만 등록할 수 있습니다.');
    }

    const relativePath = toEnabledDllRelativePath(fileName);
    const modListFile = readModListFile();

    // 이미 mod_list에 등록된 경우: 에러 없이 현재 상태 반환
    if (modListFile.mods[relativePath] || modListFile.mods[toLegacyDllRelativePath(relativePath)]) {
        return scanMods();
    }

    const existingInDisabled = getDisabledDllPathCandidates(relativePath).some((candidate) => fs.existsSync(candidate));
    const existingInPlugins = getActiveDllPathCandidates(relativePath).some((candidate) => fs.existsSync(candidate));

    if (!existingInDisabled && !existingInPlugins) {
        // 게임 폴더에도 없으면 disabled_mods로 복사
        const targetPath = getDisabledDllPath(relativePath);
        ensureParentDir(targetPath);
        fs.copyFileSync(filePath, targetPath);
    }
    // 이미 plugins 또는 disabled_mods에 있으면 파일은 그대로 두고 메타만 등록

    modListFile.mods[relativePath] = { name: name || fileName, author: author || '', version: version || undefined };
    saveModListFile(modListFile);

    return scanMods();
}

// 중첩 mod-info 파일을 재귀적으로 파싱 (collection 타입은 스킵)
function resolveNestedModInfo(
    zip: AdmZip,
    infoFile: HexXModInfoFile,
    visited = new Set<string>()
): Array<NonNullable<HexXModInfoFile['files']>[number]> {
    const result: Array<NonNullable<HexXModInfoFile['files']>[number]> = [];

    for (const f of infoFile.files ?? []) {
        result.push(f);

        if (f.type === 'mod-info') {
            if (visited.has(f.path)) continue;
            visited.add(f.path);

            const nestedEntry = zip.getEntry(f.path);
            if (!nestedEntry) continue;

            try {
                const nested = parseJsonText<HexXModInfoFile>(nestedEntry.getData().toString('utf-8'));
                if (nested.packageType === 'collection') continue; // 중첩 collection 금지

                const nestedFiles = resolveNestedModInfo(zip, nested, visited);
                result.push(...nestedFiles.filter((nf) => !result.some((r) => r.path === nf.path)));
            } catch {
                // skip malformed
            }
        }
    }

    return result;
}

export function importZipMod(filePath: string, metadata: ImportPackageMetadata = {}): ModPackage[] {
    ensureDirs();

    const zip = new AdmZip(filePath);
    const entries = zip.getEntries();

    const infoEntry = entries.find((entry) => {
        const name = entry.entryName.toLowerCase();
        return name.endsWith('hexx-mod-info.json') || name.endsWith('mod-info.json');
    });

    let info: HexXModInfoFile = {};
    if (infoEntry) {
        info = parseJsonText<HexXModInfoFile>(infoEntry.getData().toString('utf-8'));
        // 중첩 mod-info 처리
        info = { ...info, files: resolveNestedModInfo(zip, info) };
    }

    const dllEntries = entries.filter(
        (entry) => !entry.isDirectory && entry.entryName.toLowerCase().endsWith('.dll')
    );

    if (dllEntries.length === 0 && !infoEntry) {
        throw new Error('ZIP 안에 DLL 파일이 없습니다.');
    }

    const packageId = generateId();
    const pkgDir = path.join(PACKAGES_DIR, packageId);
    fs.mkdirSync(pkgDir, { recursive: true });

    const modListFile = readModListFile();
    const dllPaths: string[] = [];

    for (const entry of dllEntries) {
        const relativePath = normalizeRelativePath(entry.entryName);

        // 중복 체크: 이미 mod_list에 있으면 스킵 (기존 등록 우선)
        if (modListFile.mods[relativePath]) continue;

        const existingInDisabled = getDisabledDllPathCandidates(relativePath).some((candidate) => fs.existsSync(candidate));
        const existingInPlugins = getActiveDllPathCandidates(relativePath).some((candidate) => fs.existsSync(candidate));

        if (!existingInDisabled && !existingInPlugins) {
            const targetPath = path.join(DISABLED_MODS_DIR, relativePath);
            ensureParentDir(targetPath);
            fs.writeFileSync(targetPath, entry.getData());
        }

        dllPaths.push(relativePath);

        const fileMeta = info.files?.find((f) => normalizeRelativePath(f.path) === relativePath);
        modListFile.mods[relativePath] = {
            name: fileMeta?.name || info.name || path.basename(relativePath),
            author: fileMeta?.author || info.author || '',
            description: fileMeta?.description || info.description || '',
            packageId,
            version: metadata.version || info.version,
            source: metadata.source,
        };
    }

    // dllPaths가 0이어도 패키지는 생성 (asset-only 또는 모두 이미 등록된 경우)

    // 비-DLL 파일을 package dir로 추출
    for (const entry of entries) {
        if (entry.isDirectory) continue;
        const name = entry.entryName.toLowerCase();
        if (name.endsWith('.dll')) continue;

        const targetPath = path.join(pkgDir, entry.entryName);
        ensureParentDir(targetPath);
        fs.writeFileSync(targetPath, entry.getData());
    }

    const infoFiles: ModFileInfo[] = info.files
        ? info.files.map((f) => ({
              path: f.path,
              type: (f.type as ModFileType) || 'dll',
              name: f.name,
              author: f.author,
              dependsOn: f.dependsOn,
          }))
        : dllEntries.map((e) => ({
              path: normalizeRelativePath(e.entryName),
              type: 'dll' as ModFileType,
          }));

    const pkgMeta: PackageMeta = {
        id: packageId,
        name: info.name || path.basename(filePath, '.zip'),
        author: info.author || '',
        description: info.description || '',
        packageType: info.packageType || (dllPaths.length > 1 ? 'collection' : 'single'),
        dllPaths,
        files: infoFiles,
        enabled: false,
        dependency: sanitizePackageDependency(info.dependency),
        version: metadata.version || info.version,
        source: metadata.source,
    };

    modListFile.packages[packageId] = pkgMeta;
    saveModListFile(modListFile);

    return scanMods();
}

// 사용자 설정으로 ZIP import
export function importZipWithConfig(
    zipPath: string,
    config: {
        name: string;
        author: string;
        description: string;
        packageType: 'collection' | 'single';
        version?: string;
        dependency?: PackageDependency;
        files: Array<{
            entryName: string;
            type: ModFileType;
            name?: string;
            author?: string;
            dependsOn?: string;
        }>;
    }
): ModPackage[] {
    ensureDirs();

    const zip = new AdmZip(zipPath);
    const packageId = generateId();
    const pkgDir = path.join(PACKAGES_DIR, packageId);
    fs.mkdirSync(pkgDir, { recursive: true });

    const modListFile = readModListFile();
    const dllPaths: string[] = [];

    // mod-info 중첩 파일 처리
    const allFiles = [...config.files];
    for (const fileEntry of config.files.filter((f) => f.type === 'mod-info')) {
        const zipEntry = zip.getEntry(fileEntry.entryName);
        if (!zipEntry) continue;

        try {
            const nested = parseJsonText<HexXModInfoFile>(zipEntry.getData().toString('utf-8'));
            if (nested.packageType === 'collection') continue;

            for (const nf of nested.files ?? []) {
                if (!allFiles.some((f) => f.entryName === nf.path)) {
                    allFiles.push({
                        entryName: nf.path,
                        type: (nf.type as ModFileType) || 'asset',
                        name: nf.name,
                        author: nf.author,
                        dependsOn: nf.dependsOn,
                    });
                }
            }
        } catch {
            // skip malformed
        }
    }

    for (const fileEntry of allFiles) {
        if (fileEntry.type === 'folder') continue;

        const zipEntry = zip.getEntry(fileEntry.entryName);
        if (!zipEntry || zipEntry.isDirectory) continue;

        const relativePath = normalizeRelativePath(fileEntry.entryName);

        if (fileEntry.type === 'dll') {
            if (modListFile.mods[relativePath]) continue; // 중복 스킵

            const existingInDisabled = getDisabledDllPathCandidates(relativePath).some((candidate) => fs.existsSync(candidate));
            const existingInPlugins = getActiveDllPathCandidates(relativePath).some((candidate) => fs.existsSync(candidate));

            if (!existingInDisabled && !existingInPlugins) {
                const targetPath = path.join(DISABLED_MODS_DIR, relativePath);
                ensureParentDir(targetPath);
                fs.writeFileSync(targetPath, zipEntry.getData());
            }

            dllPaths.push(relativePath);
            modListFile.mods[relativePath] = {
                name: fileEntry.name || path.basename(relativePath),
                author: fileEntry.author || config.author || '',
                packageId,
            };
        } else {
            // 비-DLL 파일 → package dir로 저장
            const targetPath = path.join(pkgDir, fileEntry.entryName);
            ensureParentDir(targetPath);
            fs.writeFileSync(targetPath, zipEntry.getData());
        }
    }

    if (dllPaths.length === 0) {
        // DLL이 없어도 패키지는 생성 (asset-only 패키지 지원)
    }

    const pkgMeta: PackageMeta = {
        id: packageId,
        name: config.name || path.basename(zipPath, '.zip'),
        author: config.author || '',
        description: config.description || '',
        packageType: config.packageType,
        dllPaths,
        files: allFiles.map((f) => ({
            path: f.entryName,
            type: f.type,
            name: f.name,
            author: f.author,
            dependsOn: f.dependsOn,
        })),
        enabled: false,
        dependency: sanitizePackageDependency(config.dependency),
        version: config.version,
    };

    modListFile.packages[packageId] = pkgMeta;
    saveModListFile(modListFile);

    return scanMods();
}

// DLL 폼 데이터로 직접 패키지 생성 후 import
export function createAndImportPackage(data: {
    name: string;
    author: string;
    description: string;
    packageType: 'collection' | 'single';
    version?: string;
    dependency?: PackageDependency;
    files: Array<{ filePath: string; name: string; author: string }>;
}): ModPackage[] {
    ensureDirs();

    if (data.packageType === 'single' && data.files.length === 1) {
        const f = data.files[0];
        return importDllMod(f.filePath, data.name || f.name, data.author || f.author, data.version);
    }

    const zip = new AdmZip();
    const infoFiles: NonNullable<HexXModInfoFile['files']> = [];

    for (const file of data.files) {
        const fileName = path.basename(file.filePath);
        zip.addFile(fileName, fs.readFileSync(file.filePath));

        infoFiles.push({
            path: fileName,
            name: file.name || fileName.replace(/\.dll$/i, ''),
            author: file.author || data.author,
            type: 'dll',
        });

        if (data.packageType === 'collection') {
            const baseName = fileName.replace(/\.dll$/i, '');
            const dllJsonName = `${baseName}.json`;
            const dllJson = JSON.stringify(
                {
                    name: file.name || baseName,
                    author: file.author || data.author,
                    packageType: 'single',
                    files: [{ path: fileName, name: file.name || baseName, author: file.author || data.author, type: 'dll' }],
                },
                null,
                2
            );
            zip.addFile(dllJsonName, Buffer.from(dllJson));
            infoFiles.push({ path: dllJsonName, type: 'mod-info', dependsOn: fileName });
        }
    }

    const modInfo: HexXModInfoFile = {
        name: data.name,
        author: data.author,
        description: data.description,
        packageType: data.packageType,
        version: data.version,
        dependency: sanitizePackageDependency(data.dependency),
        files: infoFiles,
    };
    zip.addFile('mod-info.json', Buffer.from(JSON.stringify(modInfo, null, 2)));

    const tmpPath = path.join(STORAGE_DIR, `temp_${Date.now()}.zip`);
    zip.writeZip(tmpPath);

    try {
        return importZipMod(tmpPath);
    } finally {
        if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
    }
}

// ── Pack Mod ───────────────────────────────────────────────────────

function sanitizeInfoFileName(value: string, fallback: string): string {
    const base = (value || fallback)
        .replace(/\.(dll|zip)$/i, '')
        .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
        .trim();
    return `${base || fallback}.json`;
}

function addUniqueZipFile(zip: AdmZip, entryName: string, data: Buffer): string {
    const normalizedName = normalizeRelativePath(entryName).replace(/^\/+/, '');
    let candidate = normalizedName;
    const parsed = path.posix.parse(normalizedName);
    let idx = 2;

    while (zip.getEntry(candidate)) {
        candidate = normalizeRelativePath(path.posix.join(parsed.dir, `${parsed.name}_${idx}${parsed.ext}`));
        idx += 1;
    }

    zip.addFile(candidate, data);
    return candidate;
}

function isGeneratedModInfoCandidate(entryName: string): boolean {
    const base = path.posix.basename(normalizeRelativePath(entryName).toLowerCase());
    return base === 'mod-info.json' || base === 'hexx-mod-info.json';
}

function packModFromSources(data: {
    name: string;
    author: string;
    description: string;
    packageType: 'collection' | 'single';
    version?: string;
    dependency?: PackageDependency;
    sources: PackModSource[];
    settingsScript?: ScriptConfig | null;
    savePath: string;
}): ModPackage[] {
    const zip = new AdmZip();
    const topInfoFiles: NonNullable<HexXModInfoFile['files']> = [];
    const useNestedInfo = data.sources.length > 1;

    for (const source of data.sources) {
        const sourceInfoFiles: NonNullable<HexXModInfoFile['files']> = [];

        if (source.sourceKind === 'dll') {
            const fileName = path.basename(source.sourcePath);
            const row = source.files[0];
            const writtenPath = addUniqueZipFile(zip, row?.entryName || fileName, fs.readFileSync(source.sourcePath));
            sourceInfoFiles.push({
                path: writtenPath,
                name: row?.name || source.name || fileName.replace(/\.dll$/i, ''),
                author: row?.author || source.author || data.author,
                type: 'dll',
                dependsOn: row?.dependsOn,
            });
        } else {
            const sourceZip = new AdmZip(source.sourcePath);
            for (const file of source.files) {
                if (file.type === 'folder') {
                    sourceInfoFiles.push({
                        path: normalizeRelativePath(file.entryName).replace(/\/+$/, ''),
                        name: file.name,
                        author: file.author || source.author || data.author,
                        type: 'folder',
                        dependsOn: file.dependsOn,
                    });
                    continue;
                }
                if (file.type === 'mod-info' || isGeneratedModInfoCandidate(file.entryName)) {
                    continue;
                }

                const sourceEntry =
                    sourceZip.getEntry(file.entryName) ??
                    (file.entryName.toLowerCase().startsWith('plugins/')
                        ? sourceZip.getEntry(file.entryName.slice('plugins/'.length))
                        : null);
                if (!sourceEntry || sourceEntry.isDirectory) continue;

                const fileData =
                    typeof file.contentTextOverride === 'string'
                        ? Buffer.from(file.contentTextOverride, 'utf-8')
                        : sourceEntry.getData();
                const writtenPath = addUniqueZipFile(zip, file.entryName, fileData);
                sourceInfoFiles.push({
                    path: writtenPath,
                    name: file.name,
                    author: file.author || source.author || data.author,
                    type: file.type,
                    dependsOn: file.dependsOn,
                });
            }
        }

        if (useNestedInfo) {
            const nestedInfo: HexXModInfoFile = {
                name: source.name,
                author: source.author || data.author,
                description: source.description || '',
                packageType: 'single',
                version: data.version,
                files: sourceInfoFiles,
            };
            const nestedName = addUniqueZipFile(
                zip,
                sanitizeInfoFileName(source.name, path.basename(source.sourcePath)),
                Buffer.from(JSON.stringify(nestedInfo, null, 2))
            );
            topInfoFiles.push({
                path: nestedName,
                type: 'mod-info',
                dependsOn: sourceInfoFiles.find((file) => file.type === 'dll')?.path || 'modpack',
            });
        } else {
            topInfoFiles.push(...sourceInfoFiles);
        }
    }

    const modInfo: HexXModInfoFile = {
        name: data.name,
        author: data.author,
        description: data.description,
        packageType: data.packageType,
        version: data.version,
        dependency: sanitizePackageDependency(data.dependency),
        files: topInfoFiles,
    };
    if (data.settingsScript) {
        zip.addFile('settings.configurator.json', Buffer.from(JSON.stringify(data.settingsScript, null, 2)));
        modInfo.files = [
            ...(modInfo.files ?? []),
            { path: 'settings.configurator.json', type: 'script', dependsOn: 'modpack' },
        ];
    }
    zip.addFile('mod-info.json', Buffer.from(JSON.stringify(modInfo, null, 2)));

    ensureParentDir(data.savePath);
    zip.writeZip(data.savePath);

    const tmpPath = path.join(STORAGE_DIR, `pack_${Date.now()}.zip`);
    zip.writeZip(tmpPath);
    try {
        return importZipMod(tmpPath);
    } finally {
        if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
    }
}

export function packMod(data: {
    name: string;
    author: string;
    description: string;
    packageType: 'collection' | 'single';
    version?: string;
    dependency?: PackageDependency;
    files: Array<{ filePath: string; name: string; author: string }>;
    sources?: PackModSource[];
    settingsScript?: ScriptConfig | null;
    savePath: string;
}): ModPackage[] {
    ensureDirs();

    if (data.sources && data.sources.length > 0) {
        return packModFromSources({
            name: data.name,
            author: data.author,
            description: data.description,
            packageType: data.packageType,
            version: data.version,
            dependency: sanitizePackageDependency(data.dependency),
            sources: data.sources,
            settingsScript: data.settingsScript,
            savePath: data.savePath,
        });
    }

    if (data.files.length === 0) {
        throw new Error('패킹할 파일이 없습니다.');
    }

    const zip = new AdmZip();
    const infoFiles: NonNullable<HexXModInfoFile['files']> = [];

    for (const file of data.files) {
        const fileName = path.basename(file.filePath);
        zip.addFile(fileName, fs.readFileSync(file.filePath));

        infoFiles.push({
            path: fileName,
            name: file.name || fileName.replace(/\.dll$/i, ''),
            author: file.author || data.author,
            type: 'dll',
        });

        if (data.packageType === 'collection') {
            const baseName = fileName.replace(/\.dll$/i, '');
            const dllJsonName = `${baseName}.json`;
            const dllJson = JSON.stringify(
                {
                    name: file.name || baseName,
                    author: file.author || data.author,
                    packageType: 'single',
                    files: [
                        {
                            path: fileName,
                            name: file.name || baseName,
                            author: file.author || data.author,
                            type: 'dll',
                        },
                    ],
                },
                null,
                2
            );
            zip.addFile(dllJsonName, Buffer.from(dllJson));
            infoFiles.push({ path: dllJsonName, type: 'mod-info', dependsOn: fileName });
        }
    }

    const modInfo: HexXModInfoFile = {
        name: data.name,
        author: data.author,
        description: data.description,
        packageType: data.packageType,
        version: data.version,
        dependency: sanitizePackageDependency(data.dependency),
        files: infoFiles,
    };
    if (data.settingsScript) {
        zip.addFile('settings.configurator.json', Buffer.from(JSON.stringify(data.settingsScript, null, 2)));
        modInfo.files = [
            ...(modInfo.files ?? []),
            { path: 'settings.configurator.json', type: 'script', dependsOn: 'modpack' },
        ];
    }
    zip.addFile('mod-info.json', Buffer.from(JSON.stringify(modInfo, null, 2)));

    ensureParentDir(data.savePath);
    zip.writeZip(data.savePath);

    // Import to mod manager (starts in disabled state)
    const tmpPath = path.join(STORAGE_DIR, `pack_${Date.now()}.zip`);
    zip.writeZip(tmpPath);
    try {
        return importZipMod(tmpPath);
    } finally {
        if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
    }
}

// ── ZIP Inspect ────────────────────────────────────────────────────

export function inspectZip(zipPath: string): ZipInspectResult {
    const zip = new AdmZip(zipPath);
    const entries = zip.getEntries();
    const warnings: string[] = [];

    const infoEntry = entries.find((entry) => {
        const name = entry.entryName.toLowerCase();
        return name.endsWith('hexx-mod-info.json') || name.endsWith('mod-info.json');
    });

    let modInfo: ZipInspectResult['modInfo'] = null;
    let parsedInfo: HexXModInfoFile = {};

    if (infoEntry) {
        try {
            parsedInfo = parseJsonText<HexXModInfoFile>(infoEntry.getData().toString('utf-8'));
            modInfo = {
                name: parsedInfo.name || '',
                author: parsedInfo.author || '',
                description: parsedInfo.description || '',
                packageType: parsedInfo.packageType || 'single',
                version: parsedInfo.version,
                dependency: sanitizePackageDependency(parsedInfo.dependency),
            };
        } catch {
            warnings.push('mod-info.json 파싱 실패 — 손상된 파일일 수 있습니다.');
        }
    }

    const folderKey = (value: string) => normalizeRelativePath(value).replace(/\/+$/, '');
    const declaredPaths = new Set((parsedInfo.files ?? []).map((f) => normalizeRelativePath(f.path)));
    const declaredPathKeys = new Set((parsedInfo.files ?? []).map((f) => folderKey(f.path)));
    const declaredFolderKeys = new Set(
        (parsedInfo.files ?? [])
            .filter((f) => f.type === 'folder')
            .map((f) => folderKey(f.path))
    );

    // zip 실제 파일 집합
    const zipFilePaths = new Set(
        entries.filter((e) => !e.isDirectory).map((e) => normalizeRelativePath(e.entryName))
    );
    const zipKnownPaths = new Set(entries.map((e) => normalizeRelativePath(e.entryName).replace(/\/+$/, '')));

    const resultEntries: ZipEntryInfo[] = [];

    // ZIP의 모든 항목 처리
    for (const entry of entries) {
        const entryNorm = normalizeRelativePath(entry.entryName);
        const entryKey = folderKey(entry.entryName);
        const suggested = suggestFileType(entry.entryName, entry.isDirectory);

        const modInfoFile = parsedInfo.files?.find((f) => folderKey(f.path) === entryKey);
        const fromModInfo = declaredPathKeys.has(entryKey);

        let mismatch: ZipEntryInfo['mismatch'];
        if (fromModInfo && !zipKnownPaths.has(entryKey) && !entry.isDirectory && modInfoFile?.type !== 'folder') {
            mismatch = 'missing_in_zip';
        }

        resultEntries.push({
            entryName: entry.entryName,
            isDirectory: entry.isDirectory,
            size: entry.header.size,
            suggestedType: modInfoFile ? ((modInfoFile.type as ModFileType) || suggested) : suggested,
            fromModInfo,
            modInfoData: modInfoFile
                ? { name: modInfoFile.name, author: modInfoFile.author, type: modInfoFile.type, dependsOn: modInfoFile.dependsOn }
                : undefined,
            mismatch,
        });
    }

    if (!infoEntry && !resultEntries.some((entry) => isGeneratedModInfoCandidate(entry.entryName))) {
        resultEntries.push({
            entryName: 'mod-info.json',
            isDirectory: false,
            size: 0,
            suggestedType: 'mod-info',
            fromModInfo: false,
            mismatch: 'missing_in_zip',
        });
    }

    const resultPathSet = new Set(resultEntries.map((entry) => normalizeRelativePath(entry.entryName).replace(/\/+$/, '')));
    for (const filePath of zipFilePaths) {
        if (isGeneratedModInfoCandidate(filePath)) continue;
        const parts = filePath.split('/').filter(Boolean);
        for (let i = 1; i < parts.length; i += 1) {
            const folderPath = parts.slice(0, i).join('/');
            if (folderPath.toLowerCase() === 'plugins') continue;
            if (!folderPath || resultPathSet.has(folderPath)) continue;
            resultPathSet.add(folderPath);
            resultEntries.push({
                entryName: `${folderPath}/`,
                isDirectory: true,
                size: 0,
                suggestedType: 'folder',
                fromModInfo: declaredPathKeys.has(folderPath),
                mismatch: modInfo && !declaredPathKeys.has(folderPath)
                    ? 'missing_in_modinfo'
                    : undefined,
            });
        }
    }

    // mod-info에 있지만 zip에 없는 파일
    for (const declaredPath of declaredPaths) {
        const normalizedDeclared = folderKey(declaredPath);
        if (declaredFolderKeys.has(normalizedDeclared)) continue;
        if (!zipKnownPaths.has(normalizedDeclared)) {
            const modInfoFile = parsedInfo.files?.find((f) => folderKey(f.path) === normalizedDeclared);
            resultEntries.push({
                entryName: declaredPath,
                isDirectory: modInfoFile?.type === 'folder',
                size: 0,
                suggestedType: (modInfoFile?.type as ModFileType) || 'asset',
                fromModInfo: true,
                modInfoData: modInfoFile
                    ? { name: modInfoFile.name, author: modInfoFile.author, type: modInfoFile.type, dependsOn: modInfoFile.dependsOn }
                    : undefined,
                mismatch: 'missing_in_zip',
            });
            warnings.push(`mod-info에 선언됐으나 ZIP에 없음: ${declaredPath}`);
        }
    }

    // zip에 있지만 mod-info에 없는 DLL
    if (modInfo) {
        for (const zipPath2 of zipFilePaths) {
            if (zipPath2.toLowerCase().endsWith('.dll') && !declaredPaths.has(zipPath2)) {
                warnings.push(`mod-info에 미등록 DLL: ${zipPath2}`);
                const entry = resultEntries.find((e) => normalizeRelativePath(e.entryName) === zipPath2);
                if (entry) entry.mismatch = 'missing_in_modinfo';
            }
        }
    }

    return {
        hasModInfo: !!infoEntry,
        modInfo,
        entries: resultEntries,
        warnings,
    };
}

// ── Settings ───────────────────────────────────────────────────────

function getBepInExDir(): string {
    const { gamePath } = getAppSettings();
    if (!gamePath) return '';
    return path.join(gamePath, 'BepInEx');
}

function resolveBepInExRelative(relativePath: string): string {
    const baseDir = getBepInExDir();
    if (!baseDir) throw new Error('게임 경로가 설정되지 않았습니다.');
    if (!relativePath || path.isAbsolute(relativePath) || relativePath.includes('..')) {
        throw new Error(`허용되지 않는 BepInEx 상대 경로입니다: ${relativePath}`);
    }
    const resolved = path.resolve(baseDir, relativePath);
    const baseResolved = path.resolve(baseDir);
    if (resolved !== baseResolved && !resolved.startsWith(`${baseResolved}${path.sep}`)) {
        throw new Error(`BepInEx 밖으로 벗어나는 경로입니다: ${relativePath}`);
    }
    return resolved;
}

function managedManifestPath(packageId: string): string {
    return path.join(PACKAGES_DIR, packageId, 'settings-managed-files.json');
}

function readManagedManifest(packageId: string): ManagedFileGroup[] {
    const manifestPath = managedManifestPath(packageId);
    if (!fs.existsSync(manifestPath)) return [];
    try {
        return parseJsonText<ManagedFileGroup[]>(fs.readFileSync(manifestPath, 'utf-8'));
    } catch {
        return [];
    }
}

function writeManagedManifest(packageId: string, groups: ManagedFileGroup[]): void {
    const manifestPath = managedManifestPath(packageId);
    ensureParentDir(manifestPath);
    fs.writeFileSync(manifestPath, JSON.stringify(groups, null, 2), 'utf-8');
}

function getFeatureValueId(feature: ScriptFeature, field: ScriptField): string {
    return `${feature.id}:${field.id}`;
}

function splitJsonPath(pathValue: string): string[] {
    const trimmed = (pathValue || '').trim();
    if (!trimmed || trimmed === '$' || trimmed.toLowerCase() === 'root') return [];
    const normalized = trimmed.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
    return (normalized.includes('/') ? normalized.split('/') : normalized.split('.')).filter(Boolean);
}

function getJsonPathValue(source: unknown, jsonPath: string): unknown {
    const parts = splitJsonPath(jsonPath);
    if (parts.length === 0) return source;
    return parts.reduce<unknown>((acc, part) => {
        if (acc && typeof acc === 'object' && part in acc) {
            return (acc as Record<string, unknown>)[part];
        }
        return undefined;
    }, source);
}

function setJsonPathValue(source: Record<string, unknown>, jsonPath: string, value: unknown): void {
    const parts = splitJsonPath(jsonPath);
    if (parts.length === 0) return;
    let cursor: Record<string, unknown> = source;
    for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        if (!cursor[part] || typeof cursor[part] !== 'object' || Array.isArray(cursor[part])) {
            cursor[part] = {};
        }
        cursor = cursor[part] as Record<string, unknown>;
    }
    if (parts.length > 0) cursor[parts[parts.length - 1]] = value;
}

function deleteJsonPathValue(source: Record<string, unknown>, jsonPath: string): void {
    const parts = splitJsonPath(jsonPath);
    if (parts.length === 0) return;
    let cursor: Record<string, unknown> = source;
    for (let i = 0; i < parts.length - 1; i++) {
        const child = cursor[parts[i]];
        if (!child || typeof child !== 'object' || Array.isArray(child)) return;
        cursor = child as Record<string, unknown>;
    }
    if (parts.length > 0) delete cursor[parts[parts.length - 1]];
}

function readJsonFileObject(fullPath: string): Record<string, unknown> {
    if (!fs.existsSync(fullPath)) return {};
    const parsed = parseJsonText<unknown>(fs.readFileSync(fullPath, 'utf-8'));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
}

function getLinkedConfigBase(feature: ScriptFeature): string {
    const parts = normalizeRelativePath(feature.linkedConfigPath || '').split('/').filter(Boolean);
    if (parts[0]?.toLowerCase() === 'plugins' && parts.length >= 2) return parts.slice(0, 2).join('/');
    return '';
}

function getManagedJsonEntryPath(feature: ScriptFeature, fileName: string): string {
    if (feature.linkedConfigKeyTemplate) {
        const template = normalizeRelativePath(feature.linkedConfigKeyTemplate);
        return template.includes('$')
            ? template.replaceAll('$', fileName)
            : normalizeRelativePath(path.posix.join(template, fileName));
    }
    const fullTarget = normalizeRelativePath(path.posix.join(feature.targetDir || '', fileName));
    const base = getLinkedConfigBase(feature);
    return base && fullTarget.toLowerCase().startsWith(`${base.toLowerCase()}/`)
        ? fullTarget.slice(base.length + 1)
        : fullTarget;
}

function buildLinkedConfigMetadata(feature: ScriptFeature, fileName: string, metadata?: Record<string, unknown>): Record<string, unknown> {
    const defaults = feature.linkedConfigFieldDefaults ?? {};
    const selected = feature.linkedConfigSelectedFields ?? Object.keys(defaults);
    const result: Record<string, unknown> = {};
    if (feature.linkedConfigFilterKey && feature.linkedConfigFilterValue) {
        result[feature.linkedConfigFilterKey] = feature.linkedConfigFilterValue;
    }
    for (const [key, value] of Object.entries(defaults)) {
        if (!selected.includes(key)) result[key] = value;
    }
    for (const key of selected) {
        result[key] = metadata?.[key] ?? defaults[key] ?? '';
    }
    return result;
}

function addLinkedConfigEntry(feature: ScriptFeature, fileName: string, metadata?: Record<string, unknown>): void {
    if (!feature.linkedConfigPath || !feature.linkedConfigTargetPath) return;
    const jsonPath = resolveBepInExRelative(feature.linkedConfigPath);
    const jsonData = readJsonFileObject(jsonPath);
    const target = getJsonPathValue(jsonData, feature.linkedConfigTargetPath);
    const targetMap = target && typeof target === 'object' && !Array.isArray(target) ? target as Record<string, unknown> : {};
    setJsonPathValue(jsonData, feature.linkedConfigTargetPath, targetMap);
    targetMap[getManagedJsonEntryPath(feature, fileName)] = buildLinkedConfigMetadata(feature, fileName, metadata);
    ensureParentDir(jsonPath);
    fs.writeFileSync(jsonPath, JSON.stringify(jsonData, null, 2), 'utf-8');
}

function deleteLinkedConfigEntry(feature: ScriptFeature, fileName: string): void {
    if (!feature.linkedConfigPath || !feature.linkedConfigTargetPath) return;
    const jsonPath = resolveBepInExRelative(feature.linkedConfigPath);
    if (!fs.existsSync(jsonPath)) return;
    const jsonData = readJsonFileObject(jsonPath);
    const target = getJsonPathValue(jsonData, feature.linkedConfigTargetPath);
    if (target && typeof target === 'object' && !Array.isArray(target)) {
        delete (target as Record<string, unknown>)[getManagedJsonEntryPath(feature, fileName)];
    }
    fs.writeFileSync(jsonPath, JSON.stringify(jsonData, null, 2), 'utf-8');
}

function coerceFieldValue(field: ScriptField, value: string | number | boolean): string | number | boolean {
    if (field.ui_type === 'switch') return value === true || String(value).toLowerCase() === 'true';
    if (field.ui_type === 'number') return Number(value);
    return String(value);
}

export function getPackageSettings(packageId: string): PackageSettings {
    const modListFile = readModListFile();
    const pkg = modListFile.packages[packageId];

    if (!pkg) return { scripts: [], features: [], warnings: [], managedFiles: [], configPaths: [], cfgValues: {}, jsonValues: {} };

    const pkgDir = path.join(PACKAGES_DIR, packageId);
    const scriptFiles = pkg.files.filter((f) => f.type === 'script');
    const configFiles = pkg.files.filter((f) => f.type === 'config');

    const scripts: PackageSettings['scripts'] = [];
    const features: ScriptFeature[] = [];
    const warnings: string[] = [];
    const cfgValues: Record<string, string> = {};
    const jsonValues: Record<string, string | number | boolean> = {};

    for (const sf of scriptFiles) {
        const fullPath = path.join(pkgDir, sf.path);
        if (!fs.existsSync(fullPath)) continue;

        try {
            const config = parseJsonText<ScriptConfig>(fs.readFileSync(fullPath, 'utf-8'));
            scripts.push({ scriptPath: sf.path, config });
            for (const feature of config.features ?? []) {
                features.push(feature);
            }

            const configDir = getConfigDir();
            for (const section of config.sections ?? []) {
                for (const field of section.fields ?? []) {
                    if (field.ui_type === 'switch' && field.target?.type === 'cfg') {
                        const cfgPath = field.target.path ? path.join(configDir, field.target.path) : '';
                        if (cfgPath && fs.existsSync(cfgPath)) {
                            const content = fs.readFileSync(cfgPath, 'utf-8');
                            const val = parseCfgValue(content, field.target.section, field.target.key);
                            cfgValues[field.id] = val ?? String(field.default ?? 'true');
                        } else {
                            cfgValues[field.id] = String(field.default ?? 'true');
                        }
                    }
                }
            }

            for (const feature of config.features ?? []) {
                if (feature.type === 'cfg_fields') {
                    if (!getBepInExDir()) {
                        warnings.push(`${feature.name}: 게임 경로가 설정되지 않았습니다.`);
                        continue;
                    }
                    const cfgPath = feature.cfgPath ? resolveBepInExRelative(feature.cfgPath) : '';
                    if (!cfgPath || !fs.existsSync(cfgPath)) {
                        warnings.push(`${feature.name}: cfg 파일이 없습니다. 모드를 한 번 실행한 뒤 다시 열어주세요.`);
                        continue;
                    }
                    const content = fs.readFileSync(cfgPath, 'utf-8');
                    for (const field of feature.fields ?? []) {
                        if (field.target?.type === 'cfg') {
                            const val = parseCfgValue(content, field.target.section, field.target.key);
                            cfgValues[getFeatureValueId(feature, field)] = val ?? String(field.default ?? '');
                        }
                    }
                }

                if (feature.type === 'json_manager') {
                    if (!getBepInExDir()) {
                        warnings.push(`${feature.name}: 게임 경로가 설정되지 않았습니다.`);
                        continue;
                    }
                    const jsonPath = feature.jsonPath ? resolveBepInExRelative(feature.jsonPath) : '';
                    let jsonData: unknown = feature.sample ?? {};
                    if (jsonPath && fs.existsSync(jsonPath)) {
                        try {
                            jsonData = parseJsonText<unknown>(fs.readFileSync(jsonPath, 'utf-8'));
                        } catch {
                            warnings.push(`${feature.name}: JSON 파일을 파싱할 수 없습니다.`);
                        }
                    }
                    for (const field of feature.fields ?? []) {
                        const value = field.jsonPath ? getJsonPathValue(jsonData, field.jsonPath) : undefined;
                        const fallback = field.default ?? field.value ?? '';
                        jsonValues[getFeatureValueId(feature, field)] =
                            typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
                                ? value
                                : (fallback as string | number | boolean);
                    }
                }
            }
        } catch {
            warnings.push(`${sf.path}: script JSON을 파싱할 수 없습니다.`);
        }
    }

    return {
        scripts,
        features,
        warnings,
        managedFiles: readManagedManifest(packageId),
        configPaths: configFiles.map((f) => f.path),
        cfgValues,
        jsonValues,
    };
}

export function applyCfgValue(configPath: string, section: string, key: string, value: string): void {
    const configDir = getConfigDir();
    if (!configDir) throw new Error('게임 경로가 설정되지 않았습니다.');

    const fullPath = path.join(configDir, configPath);
    applyCfgValueAtFullPath(fullPath, section, key, value);
}

function applyCfgValueAtFullPath(fullPath: string, section: string, key: string, value: string): void {
    const content = fs.existsSync(fullPath) ? fs.readFileSync(fullPath, 'utf-8') : '';
    const lines = content.split('\n');

    let inSection = false;
    let keyFound = false;
    let sectionEndLine = -1;

    for (let i = 0; i < lines.length; i++) {
        const trimmed = lines[i].trim();

        if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
            if (inSection && sectionEndLine === -1) sectionEndLine = i;
            inSection = trimmed.slice(1, -1).trim() === section;
            if (inSection) sectionEndLine = -1;
            continue;
        }

        if (inSection && !trimmed.startsWith('#') && !trimmed.startsWith(';') && !trimmed.startsWith('//')) {
            const eqIdx = trimmed.indexOf('=');
            if (eqIdx !== -1 && trimmed.slice(0, eqIdx).trim() === key) {
                lines[i] = `${key} = ${value}`;
                keyFound = true;
                break;
            }
        }
    }

    if (!keyFound) {
        const insertIdx = sectionEndLine !== -1 ? sectionEndLine : lines.length;
        if (!lines.some((l) => l.trim() === `[${section}]`)) {
            lines.push(`[${section}]`, `${key} = ${value}`);
        } else {
            lines.splice(insertIdx, 0, `${key} = ${value}`);
        }
    }

    ensureParentDir(fullPath);
    fs.writeFileSync(fullPath, lines.join('\n'), 'utf-8');
}

function getPackageFeatures(packageId: string): ScriptFeature[] {
    const modListFile = readModListFile();
    const pkg = modListFile.packages[packageId];
    if (!pkg) return [];
    const pkgDir = path.join(PACKAGES_DIR, packageId);
    const features: ScriptFeature[] = [];
    for (const sf of pkg.files.filter((f) => f.type === 'script')) {
        const fullPath = path.join(pkgDir, sf.path);
        if (!fs.existsSync(fullPath)) continue;
        try {
            const config = parseJsonText<ScriptConfig>(fs.readFileSync(fullPath, 'utf-8'));
            features.push(...(config.features ?? []));
        } catch {
            // malformed scripts are reported by getPackageSettings
        }
    }
    return features;
}

export function applyPackageSettings(packageId: string, changes: ApplyPackageSettingsChanges): PackageSettings {
    const features = getPackageFeatures(packageId);

    if (changes.configText) {
        writeConfigFileText(changes.configText.path, changes.configText.content);
    }

    for (const feature of features) {
        if (feature.type === 'cfg_fields') {
            for (const field of feature.fields ?? []) {
                const valueId = getFeatureValueId(feature, field);
                if (field.target?.type === 'cfg' && changes.cfgValues[valueId] !== undefined) {
                    applyCfgValueAtFullPath(
                        resolveBepInExRelative(field.target.path),
                        field.target.section,
                        field.target.key,
                        String(changes.cfgValues[valueId])
                    );
                }
            }
        }

        if (feature.type === 'json_manager' && feature.jsonPath) {
            const jsonPath = resolveBepInExRelative(feature.jsonPath);
            let jsonData: Record<string, unknown> = {};
            if (fs.existsSync(jsonPath)) {
                jsonData = parseJsonText<Record<string, unknown>>(fs.readFileSync(jsonPath, 'utf-8'));
            } else if (feature.sample && typeof feature.sample === 'object' && !Array.isArray(feature.sample)) {
                jsonData = feature.sample as Record<string, unknown>;
            }
            let changed = false;
            for (const field of feature.fields ?? []) {
                const valueId = getFeatureValueId(feature, field);
                if (field.jsonPath && changes.jsonValues[valueId] !== undefined) {
                    setJsonPathValue(jsonData, field.jsonPath, coerceFieldValue(field, changes.jsonValues[valueId]));
                    changed = true;
                }
            }
            if (changed) {
                ensureParentDir(jsonPath);
                fs.writeFileSync(jsonPath, JSON.stringify(jsonData, null, 2), 'utf-8');
            }
        }
    }

    let manifest = readManagedManifest(packageId);
    for (const fileImport of changes.fileImports ?? []) {
        const feature = features.find((f) => f.id === fileImport.featureId && f.type === 'file_manager');
        if (!feature?.targetDir) throw new Error('파일관리 기능을 찾을 수 없습니다.');
        const fileName = path.basename(fileImport.sourcePath);
        const ext = path.extname(fileName).replace(/^\./, '').toLowerCase();
        const allowed = (feature.extensions ?? []).map((item) => item.replace(/^\./, '').toLowerCase()).filter(Boolean);
        if (allowed.length > 0 && !allowed.includes(ext)) {
            throw new Error(`허용되지 않는 확장자입니다: ${fileName}`);
        }
        const targetDir = resolveBepInExRelative(feature.targetDir);
        const targetPath = path.join(targetDir, fileName);
        ensureParentDir(targetPath);
        fs.copyFileSync(fileImport.sourcePath, targetPath);
        addLinkedConfigEntry(feature, fileName, fileImport.metadata);

        const groupIdx = manifest.findIndex((g) => g.featureId === feature.id);
        const nextGroup: ManagedFileGroup =
            groupIdx >= 0
                ? manifest[groupIdx]
                : { featureId: feature.id, managedName: feature.name, targetDir: feature.targetDir, files: [] };
        if (!nextGroup.files.includes(fileName)) nextGroup.files.push(fileName);
        if (groupIdx >= 0) manifest[groupIdx] = nextGroup;
        else manifest.push(nextGroup);
    }

    for (const fileDelete of changes.fileDeletes ?? []) {
        const feature = features.find((f) => f.id === fileDelete.featureId && f.type === 'file_manager');
        if (!feature?.targetDir) throw new Error('파일관리 기능을 찾을 수 없습니다.');
        const group = manifest.find((g) => g.featureId === feature.id);
        if (!group || !group.files.includes(fileDelete.fileName)) {
            throw new Error('앱이 import한 파일만 삭제할 수 있습니다.');
        }
        const targetPath = path.join(resolveBepInExRelative(feature.targetDir), path.basename(fileDelete.fileName));
        if (fs.existsSync(targetPath)) fs.unlinkSync(targetPath);
        deleteLinkedConfigEntry(feature, fileDelete.fileName);
        group.files = group.files.filter((file) => file !== fileDelete.fileName);
    }
    manifest = manifest.filter((group) => group.files.length > 0);
    writeManagedManifest(packageId, manifest);

    return getPackageSettings(packageId);
}

export function readConfigFileText(configPath: string): string {
    const fullPath = resolveBepInExRelative(configPath);
    return fs.existsSync(fullPath) ? fs.readFileSync(fullPath, 'utf-8') : '';
}

export function writeConfigFileText(configPath: string, content: string): void {
    const fullPath = resolveBepInExRelative(configPath);
    ensureParentDir(fullPath);
    fs.writeFileSync(fullPath, content, 'utf-8');
}

export function copyResourceFile(sourcePath: string, targetRelativePath: string): void {
    const bepInExDir = getBepInExDir();
    if (!bepInExDir) throw new Error('게임 경로가 설정되지 않았습니다.');
    const fullTargetPath = path.join(bepInExDir, targetRelativePath);
    ensureParentDir(fullTargetPath);
    fs.copyFileSync(sourcePath, fullTargetPath);
}
