// src/preload/preload.ts
// Renderer에서 안전하게 사용할 Electron API를 노출합니다.

import {contextBridge, ipcRenderer, webUtils} from 'electron';

type UpdateStatus = {
    state: 'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error';
    currentVersion: string;
    availableVersion?: string;
    releaseName?: string;
    releaseDate?: string;
    progress?: number;
    message?: string;
    error?: string;
    isPackaged: boolean;
};

type GitHubRelease = {
    id: number;
    name: string;
    tagName: string;
    htmlUrl: string;
    publishedAt: string;
    body: string;
    prerelease: boolean;
};

type OnlineModCatalogItem = {
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

type ModDistributionInput = {
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

type OnlineAssetPackCatalogItem = {
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

type AssetPackDistributionInput = {
    id: string;
    name: string;
    author?: string;
    description?: string;
    version: string;
    zipPath?: string;
    thumbnailPath?: string;
    gameIds?: string[];
    targets?: Array<{
        catalogId: string;
        category: string;
        option1?: string;
        gender?: string;
        option1Label?: string;
        option2?: string;
        displayLabel?: string;
        textureName: string;
        pathId: number;
        size?: [number, number];
        pngPath: string;
        previewPath?: string;
    }>;
};

type LaunchGameResult = {
    ok: boolean;
    message?: string;
};

const electronAPI = {
    getVersion: (): Promise<string> => ipcRenderer.invoke('app:get-version'),
    getUpdateStatus: (): Promise<UpdateStatus> => ipcRenderer.invoke('updates:get-status'),
    checkForUpdates: (): Promise<UpdateStatus> => ipcRenderer.invoke('updates:check'),
    downloadUpdate: (): Promise<UpdateStatus> => ipcRenderer.invoke('updates:download'),
    installUpdate: (): Promise<UpdateStatus> => ipcRenderer.invoke('updates:install'),
    onUpdateStatus: (listener: (status: UpdateStatus) => void): (() => void) => {
        const subscription = (_event: Electron.IpcRendererEvent, status: UpdateStatus) => listener(status);

        ipcRenderer.on('updates:status', subscription);

        return () => {
            ipcRenderer.removeListener('updates:status', subscription);
        };
    },

    getSettings: () => ipcRenderer.invoke('config:get-settings'),
    getThemes: () => ipcRenderer.invoke('config:get-themes'),
    getTypographyOptions: () => ipcRenderer.invoke('config:get-typography-options'),
    getSupportedGames: () => ipcRenderer.invoke('config:get-supported-games'),
    setTheme: (themeName: string) => ipcRenderer.invoke('config:set-theme', themeName),
    setTypography: (typography: string) => ipcRenderer.invoke('config:set-typography', typography),
    setLanguage: (language: string) => ipcRenderer.invoke('config:set-language', language),
    setSelectedGame: (gameId: string) => ipcRenderer.invoke('config:set-selected-game', gameId),
    setGamePath: (gamePath: string, gameId?: string) => ipcRenderer.invoke('config:set-game-path', gamePath, gameId),
    selectDirectory: () => ipcRenderer.invoke('dialog:select-directory'),
    getGitHubReleases: (): Promise<GitHubRelease[]> => ipcRenderer.invoke('github:get-releases'),
    readManualDocument: (documentPath: string): Promise<string> =>
        ipcRenderer.invoke('docs:read-manual', documentPath),
    launchGame: (): Promise<LaunchGameResult> => ipcRenderer.invoke('game:launch'),
    getDeveloperAccessStatus: () => ipcRenderer.invoke('developer:get-access-status'),
    verifyDeveloperPassword: (password: string) => ipcRenderer.invoke('developer:verify-password', password),

    // Mod Manager
    scanMods: () => ipcRenderer.invoke('mods:scan'),
    getOnlineModCatalog: (): Promise<OnlineModCatalogItem[]> =>
        ipcRenderer.invoke('mods:get-online-catalog'),
    getOnlineModReadme: (readmePath: string): Promise<string> =>
        ipcRenderer.invoke('mods:get-online-readme', readmePath),
    getModDistributionCatalog: (): Promise<OnlineModCatalogItem[]> =>
        ipcRenderer.invoke('mods:get-distribution-catalog'),
    saveModDistributionItem: (input: ModDistributionInput) =>
        ipcRenderer.invoke('mods:save-distribution-item', input),
    deleteModDistributionItem: (id: string) =>
        ipcRenderer.invoke('mods:delete-distribution-item', id),
    downloadOnlineMod: (item: OnlineModCatalogItem) =>
        ipcRenderer.invoke('mods:download-online-mod', item),
    updateOnlineMod: (item: OnlineModCatalogItem) =>
        ipcRenderer.invoke('mods:update-online-mod', item),
    selectModImportFile: () => ipcRenderer.invoke('mods:select-import-file'),
    selectFile: (accept?: string) => ipcRenderer.invoke('mods:select-file', accept),
    readTextFile: (filePath: string) => ipcRenderer.invoke('mods:read-text-file', filePath),
    readZipEntryText: (zipPath: string, entryName: string): Promise<string> =>
        ipcRenderer.invoke('mods:read-zip-entry-text', zipPath, entryName),
    getModPackGuide: (): Promise<string> => ipcRenderer.invoke('mods:get-pack-guide'),

    inspectZip: (zipPath: string) => ipcRenderer.invoke('mods:inspect-zip', zipPath),

    setPackageEnabled: (packageId: string, enabled: boolean) =>
        ipcRenderer.invoke('mods:set-package-enabled', packageId, enabled),
    setDllEnabled: (relativePath: string, enabled: boolean) =>
        ipcRenderer.invoke('mods:set-dll-enabled', relativePath, enabled),

    importDllMod: (filePath: string, name: string, author: string, version?: string) =>
        ipcRenderer.invoke('mods:import-dll', filePath, name, author, version),
    importZipMod: (filePath: string) =>
        ipcRenderer.invoke('mods:import-zip', filePath),
    importZipConfigured: (
        zipPath: string,
        config: {
            name: string;
            author: string;
            description: string;
            packageType: 'collection' | 'single';
            version?: string;
            dependency?: { target: string; displayName?: string; installBase?: string };
            files: Array<{
                entryName: string;
                type: string;
                name?: string;
                author?: string;
                dependsOn?: string;
            }>;
        }
    ) => ipcRenderer.invoke('mods:import-zip-configured', zipPath, config),
    createAndImportPackage: (data: {
        name: string;
        author: string;
        description: string;
        packageType: 'collection' | 'single';
        version?: string;
        dependency?: { target: string; displayName?: string; installBase?: string };
        files: Array<{ filePath: string; name: string; author: string }>;
    }) => ipcRenderer.invoke('mods:create-and-import', data),

    deletePackage: (packageId: string) =>
        ipcRenderer.invoke('mods:delete-package', packageId),
    exportPackage: (packageId: string, savePath: string): Promise<string> =>
        ipcRenderer.invoke('mods:export-package', packageId, savePath),

    getPackageSettings: (packageId: string) =>
        ipcRenderer.invoke('mods:get-package-settings', packageId),
    getPackageReadme: (packageId: string): Promise<string> =>
        ipcRenderer.invoke('mods:get-package-readme', packageId),
    applyPackageSettings: (packageId: string, changes: any) =>
        ipcRenderer.invoke('mods:apply-package-settings', packageId, changes),
    applyCfgValue: (configPath: string, section: string, key: string, value: string) =>
        ipcRenderer.invoke('mods:apply-cfg-value', configPath, section, key, value),
    readConfigText: (configPath: string) =>
        ipcRenderer.invoke('mods:read-config-text', configPath),
    writeConfigText: (configPath: string, content: string) =>
        ipcRenderer.invoke('mods:write-config-text', configPath, content),
    copyResource: (sourcePath: string, targetRelativePath: string) =>
        ipcRenderer.invoke('mods:copy-resource', sourcePath, targetRelativePath),
    selectManagedFile: (accept?: string) => ipcRenderer.invoke('mods:select-file', accept),

    // backward compat
    deleteMod: (relativePath: string) => ipcRenderer.invoke('mods:delete', relativePath),
    setModEnabled: (relativePath: string, enabled: boolean) =>
        ipcRenderer.invoke('mods:set-enabled', relativePath, enabled),

    // Asset Manager preloads
    getAssetStatus: () => ipcRenderer.invoke('asset:get-status'),
    backupAsset: (type: 'font' | 'asset') => ipcRenderer.invoke('asset:backup', type),
    restoreAssetBackup: (type: 'font' | 'asset') => ipcRenderer.invoke('asset:restore-backup', type),
    getTextureCatalog: () => ipcRenderer.invoke('asset:get-texture-catalog'),
    getAssetCatalog: () => ipcRenderer.invoke('asset:get-catalog'),
    getCatalogEditorData: () => ipcRenderer.invoke('asset:get-catalog-editor-data'),
    saveCatalogEditorData: (catalog: any) => ipcRenderer.invoke('asset:save-catalog-editor-data', catalog),
    getCurrentAssetPacks: () => ipcRenderer.invoke('asset:get-current-asset-packs'),
    saveCurrentAssetPacks: (entries: any[]) => ipcRenderer.invoke('asset:save-current-asset-packs', entries),
    clearCurrentAssetPacks: () => ipcRenderer.invoke('asset:clear-current-asset-packs'),
    importCatalogPreviewImage: (params: any) => ipcRenderer.invoke('asset:import-catalog-preview-image', params),
    getFontTargets: () => ipcRenderer.invoke('asset:get-font-targets'),
    getStoredFonts: () => ipcRenderer.invoke('asset:get-stored-fonts'),
    importFont: (sourcePath: string) => ipcRenderer.invoke('asset:import-font', sourcePath),
    selectReplacementImage: () => ipcRenderer.invoke('asset:select-replacement-image'),
    patchTexture: (params: any) => ipcRenderer.invoke('texture:patch', params),
    runClothesPatch: (params: any) => ipcRenderer.invoke('asset:run-clothes-patch', params),
    runFontExtract: (params: any) => ipcRenderer.invoke('asset:run-font-extract', params),
    runFontPatch: (params: any) => ipcRenderer.invoke('asset:run-font-patch', params),
    runFontRestore: (params: any) => ipcRenderer.invoke('asset:run-font-restore', params),
    runFontList: (params: any) => ipcRenderer.invoke('asset:run-font-list', params),

    // Mod packing
    packMod: (data: {
        name: string;
        author: string;
        description: string;
        packageType: 'collection' | 'single';
        version?: string;
        dependency?: { target: string; displayName?: string; installBase?: string };
        files: Array<{ filePath: string; name: string; author: string }>;
        settingsScript?: unknown;
        sources?: Array<{
            sourcePath: string;
            sourceKind: 'dll' | 'zip' | 'file';
            name: string;
            author: string;
            description?: string;
            packageType: 'collection' | 'single';
            files: Array<{
                entryName: string;
                type: string;
                name?: string;
                author?: string;
                dependsOn?: string;
                contentTextOverride?: string;
            }>;
        }>;
        savePath: string;
    }) => ipcRenderer.invoke('mods:pack-mod', data),
    selectSavePath: (defaultName?: string) => ipcRenderer.invoke('mods:select-save-path', defaultName),

    // Graphics Tool
    getGraphicsAssets: () => ipcRenderer.invoke('graphics:get-assets'),
    getGraphicsConfig: () => ipcRenderer.invoke('graphics:get-config'),
    selectGraphicsVideo: () => ipcRenderer.invoke('graphics:select-video'),
    selectGraphicsImage: () => ipcRenderer.invoke('graphics:select-image'),
    resolveDroppedGraphicsFile: (file: File, kind: 'video' | 'image') => {
        const filePath = webUtils.getPathForFile(file);
        return ipcRenderer.invoke('graphics:resolve-dropped-file', { filePath, kind });
    },
    checkFfmpeg: () => ipcRenderer.invoke('graphics:check-ffmpeg'),
    createPortraitLoop: (params: any) => ipcRenderer.invoke('graphics:create-loop', params),
    exportPortraitVideo: (params: any) => ipcRenderer.invoke('graphics:export-video', params),
    exportPortraitImage: (params: any) => ipcRenderer.invoke('graphics:export-image', params),
    onGraphicsProgress: (listener: (status: any) => void): (() => void) => {
        const subscription = (_event: Electron.IpcRendererEvent, status: any) => listener(status);

        ipcRenderer.on('graphics:progress', subscription);

        return () => {
            ipcRenderer.removeListener('graphics:progress', subscription);
        };
    },

    // Asset Pack preloads
    getAssetPacks: () => ipcRenderer.invoke('asset:get-packs'),
    getOnlineAssetPackCatalog: (): Promise<OnlineAssetPackCatalogItem[]> =>
        ipcRenderer.invoke('asset:get-online-packs'),
    downloadOnlineAssetPack: (item: OnlineAssetPackCatalogItem) =>
        ipcRenderer.invoke('asset:download-online-pack', item),
    updateOnlineAssetPack: (item: OnlineAssetPackCatalogItem) =>
        ipcRenderer.invoke('asset:update-online-pack', item),
    selectAssetPackZip: () => ipcRenderer.invoke('asset:select-pack-zip'),
    selectAssetPackThumbnail: () => ipcRenderer.invoke('asset:select-pack-thumbnail'),
    selectAssetPackPngs: () => ipcRenderer.invoke('asset:select-pack-pngs'),
    importAssetPack: (zipPath: string) => ipcRenderer.invoke('asset:import-pack', zipPath),
    createAssetPackDistribution: (input: AssetPackDistributionInput) =>
        ipcRenderer.invoke('asset:create-pack-distribution', input),
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);

export type ElectronAPI = typeof electronAPI;
