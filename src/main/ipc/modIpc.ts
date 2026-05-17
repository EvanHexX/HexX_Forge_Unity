// src/main/ipc/modIpc.ts
// 모드 관리자 IPC 핸들러입니다.

import fs from 'node:fs';
import path from 'node:path';
import { dialog, ipcMain } from 'electron';
import AdmZip from 'adm-zip';
import {
    applyCfgValue,
    applyPackageSettings,
    copyResourceFile,
    createAndImportPackage,
    deleteMod,
    deletePackage,
    exportPackage,
    getPackageSettings,
    importDllMod,
    importZipMod,
    importZipWithConfig,
    inspectZip,
    packMod,
    readPackageReadme,
    readConfigFileText,
    scanMods,
    setDllEnabled,
    setModEnabled,
    setPackageEnabled,
    writeConfigFileText,
} from '../services/modService';
import type { ApplyPackageSettingsChanges, ModFileType, ScriptConfig, UpdatePolicy } from '../services/modService';
import {
    deleteModDistributionItem,
    getModDistributionCatalog,
    getOnlineModCatalog,
    getOnlineModReadme,
    installOnlineMod,
    saveModDistributionItem,
    type ModDistributionInput,
    updateOnlineMod,
    type OnlineModCatalogItem,
} from '../services/modCatalogService';

export function registerModIpc(): void {
    ipcMain.handle('mods:scan', () => scanMods());

    ipcMain.handle('mods:get-online-catalog', () => getOnlineModCatalog());

    ipcMain.handle('mods:get-online-readme', (_event, readmePath: string) =>
        getOnlineModReadme(readmePath)
    );

    ipcMain.handle('mods:get-distribution-catalog', () => getModDistributionCatalog());

    ipcMain.handle('mods:save-distribution-item', (_event, input: ModDistributionInput) =>
        saveModDistributionItem(input)
    );

    ipcMain.handle('mods:delete-distribution-item', (_event, id: string) =>
        deleteModDistributionItem(id)
    );

    ipcMain.handle('mods:download-online-mod', (_event, item: OnlineModCatalogItem) =>
        installOnlineMod(item)
    );

    ipcMain.handle('mods:update-online-mod', (_event, item: OnlineModCatalogItem, confirmedReplace?: boolean) =>
        updateOnlineMod(item, confirmedReplace === true)
    );

    ipcMain.handle('mods:set-package-enabled', (_event, packageId: string, enabled: boolean) =>
        setPackageEnabled(packageId, enabled)
    );

    ipcMain.handle('mods:set-dll-enabled', (_event, relativePath: string, enabled: boolean) =>
        setDllEnabled(relativePath, enabled)
    );

    ipcMain.handle('mods:set-enabled', (_event, relativePath: string, enabled: boolean) =>
        setModEnabled(relativePath, enabled)
    );

    ipcMain.handle('mods:delete-package', (_event, packageId: string) =>
        deletePackage(packageId)
    );

    ipcMain.handle('mods:export-package', (_event, packageId: string, savePath: string) =>
        exportPackage(packageId, savePath)
    );

    ipcMain.handle('mods:delete', (_event, relativePath: string) =>
        deleteMod(relativePath)
    );

    ipcMain.handle('mods:select-import-file', async () => {
        const result = await dialog.showOpenDialog({
            title: '모드 파일 선택',
            properties: ['openFile'],
            filters: [
                { name: 'Mod File', extensions: ['dll', 'zip', 'md', 'markdown'] },
                { name: 'DLL', extensions: ['dll'] },
                { name: 'ZIP', extensions: ['zip'] },
                { name: 'Markdown', extensions: ['md', 'markdown'] },
            ],
        });
        if (result.canceled || result.filePaths.length === 0) return null;
        return result.filePaths[0];
    });

    ipcMain.handle('mods:select-file', async (_event, accept?: string) => {
        const extensions = accept
            ? accept.split(',').map((s) => s.trim().replace(/^\./, ''))
            : ['*'];
        const result = await dialog.showOpenDialog({
            title: '파일 선택',
            properties: ['openFile'],
            filters: [{ name: 'Files', extensions }],
        });
        if (result.canceled || result.filePaths.length === 0) return null;
        return result.filePaths[0];
    });

    ipcMain.handle('mods:read-text-file', (_event, filePath: string) =>
        fs.readFileSync(filePath, 'utf-8')
    );

    ipcMain.handle('mods:read-zip-entry-text', (_event, zipPath: string, entryName: string) => {
        const zip = new AdmZip(zipPath);
        const normalized = entryName.replaceAll('\\', '/').replace(/^\/+/, '').replace(/\/+/g, '/');
        const candidates = [
            entryName,
            normalized,
            normalized.toLowerCase().startsWith('plugins/')
                ? normalized.slice('plugins/'.length)
                : '',
        ].filter(Boolean);
        const entry = candidates
            .map((candidate) => zip.getEntry(candidate))
            .find((candidateEntry) => candidateEntry && !candidateEntry.isDirectory);
        if (!entry || entry.isDirectory) throw new Error(`ZIP entry를 찾을 수 없습니다: ${entryName}`);
        return entry.getData().toString('utf-8');
    });

    ipcMain.handle('mods:get-pack-guide', () => {
        const candidates = [
            path.join(process.cwd(), 'docs', 'modules', 'mod-packing-guide.md'),
            path.join(__dirname, '..', '..', 'docs', 'modules', 'mod-packing-guide.md'),
        ];
        const guidePath = candidates.find((candidate) => fs.existsSync(candidate));
        if (!guidePath) return '모드 패킹 설명서를 찾을 수 없습니다.';
        return fs.readFileSync(guidePath, 'utf-8');
    });

    ipcMain.handle('mods:import-dll', (_event, filePath: string, name: string, author: string, version?: string) =>
        importDllMod(filePath, name, author, version)
    );

    ipcMain.handle('mods:import-zip', (_event, filePath: string) =>
        importZipMod(filePath)
    );

    ipcMain.handle(
        'mods:import-zip-configured',
        (
            _event,
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
                    type: ModFileType;
                    name?: string;
                    author?: string;
                    dependsOn?: string;
                }>;
            }
        ) => importZipWithConfig(zipPath, config)
    );

    ipcMain.handle('mods:inspect-zip', (_event, zipPath: string) =>
        inspectZip(zipPath)
    );

    ipcMain.handle(
        'mods:create-and-import',
        (
            _event,
            data: {
                name: string;
                author: string;
                description: string;
                packageType: 'collection' | 'single';
                version?: string;
                dependency?: { target: string; displayName?: string; installBase?: string };
                updatePolicy?: UpdatePolicy;
                files: Array<{ filePath: string; name: string; author: string }>;
            }
        ) => createAndImportPackage(data)
    );

    ipcMain.handle('mods:get-package-settings', (_event, packageId: string) =>
        getPackageSettings(packageId)
    );

    ipcMain.handle('mods:get-package-readme', (_event, packageId: string) =>
        readPackageReadme(packageId)
    );

    ipcMain.handle(
        'mods:apply-package-settings',
        (_event, packageId: string, changes: ApplyPackageSettingsChanges) =>
            applyPackageSettings(packageId, changes)
    );

    ipcMain.handle(
        'mods:apply-cfg-value',
        (_event, configPath: string, section: string, key: string, value: string) =>
            applyCfgValue(configPath, section, key, value)
    );

    ipcMain.handle('mods:read-config-text', (_event, configPath: string) =>
        readConfigFileText(configPath)
    );

    ipcMain.handle('mods:write-config-text', (_event, configPath: string, content: string) =>
        writeConfigFileText(configPath, content)
    );

    ipcMain.handle('mods:copy-resource', (_event, sourcePath: string, targetRelativePath: string) =>
        copyResourceFile(sourcePath, targetRelativePath)
    );

    ipcMain.handle(
        'mods:pack-mod',
        (
            _event,
            data: {
                name: string;
                author: string;
                description: string;
                packageType: 'collection' | 'single';
                version?: string;
                dependency?: { target: string; displayName?: string; installBase?: string };
                files: Array<{ filePath: string; name: string; author: string }>;
                settingsScript?: ScriptConfig | null;
                sources?: Array<{
                    sourcePath: string;
                    sourceKind: 'dll' | 'zip' | 'file';
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
                }>;
                savePath: string;
            }
        ) => packMod(data)
    );

    ipcMain.handle('mods:select-save-path', async (_event, defaultName?: string) => {
        const result = await dialog.showSaveDialog({
            title: 'ZIP 저장 경로 선택',
            defaultPath: defaultName ? `${defaultName}.zip` : 'mod.zip',
            filters: [{ name: 'ZIP', extensions: ['zip'] }],
        });
        if (result.canceled || !result.filePath) return null;
        return result.filePath;
    });
}
