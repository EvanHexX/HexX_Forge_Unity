// src/renderer/types/modTypes.ts
// modService와 ModManager 사이의 공유 타입 (IPC 경계)

export type ModFileType = 'dll' | 'asset' | 'mod-info' | 'script' | 'config' | 'folder' | 'readme';

export const MOD_FILE_TYPE_LABELS: Record<ModFileType, string> = {
    dll: 'DLL',
    asset: 'Asset',
    'mod-info': 'Mod-Info',
    script: 'Script',
    config: 'Config',
    folder: 'Folder',
    readme: 'README',
};

export const COMMON_FOLDER_NAMES = [
    'data', 'assets', 'config', 'plugins', 'mods',
    'content', 'resources', 'lib', 'libs', 'common',
];

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
    readmePath?: string;
    dependency?: PackageDependency;
    dependencyState?: 'ok' | 'missing' | 'disabled';
    dependencyParentId?: string;
    installPathHints?: string[];
    version?: string;
    source?: ModPackageSource;
    updateAvailable?: boolean;
};

export type PackageDependency = {
    target: string;
    displayName?: string;
    installBase?: string;
};

export type ModPackageSource = {
    type: 'github';
    catalogId: string;
    downloadPath: string;
    readmePath?: string;
};

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

export type ToggleResult = {
    packages: ModPackage[];
    warnings: string[];
};
