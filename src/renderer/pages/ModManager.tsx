// src/renderer/pages/ModManager.tsx
// BepInEx 기반 모드 패키지 관리 (활성/비활성, 추가, 삭제, 설정, 패킹)

import { useEffect, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import {
    Alert,
    Box,
    Button,
    Checkbox,
    Chip,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    FormControlLabel,
    IconButton,
    ListItemIcon,
    ListItemText,
    Menu,
    MenuItem,
    Paper,
    Select,
    Stack,
    Switch,
    Tab,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TextField,
    Tooltip,
    Typography,
    Tabs,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ArchiveIcon from '@mui/icons-material/Archive';
import DeleteIcon from '@mui/icons-material/Delete';
import RefreshIcon from '@mui/icons-material/Refresh';
import SettingsIcon from '@mui/icons-material/Settings';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import TuneIcon from '@mui/icons-material/Tune';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import SaveIcon from '@mui/icons-material/Save';
import ImageIcon from '@mui/icons-material/Image';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutlined';
import HelpIcon from '@mui/icons-material/Help';
import DownloadIcon from '@mui/icons-material/Download';
import UpdateIcon from '@mui/icons-material/SystemUpdateAlt';

import { useNotification } from '../context/NotificationContext';
import DeveloperGateDialog from '../components/DeveloperGateDialog';
import { useDeveloperShortcut } from '../hooks/useDeveloperShortcut';
import type {
    ModFileType,
    ModPackage,
    ModUpdatePolicy,
    OnlineModCatalogItem,
    PackageDependency,
    ApplyPackageSettingsChanges,
    PackageSettings,
    ScriptField,
    ScriptFeature,
    ScriptSection,
    ToggleResult,
    ZipEntryInfo,
    ZipInspectResult,
} from '../types/modTypes';
import { COMMON_FOLDER_NAMES, MOD_FILE_TYPE_LABELS } from '../types/modTypes';
import { getSafeLanguage, t, type LanguageCode } from '../i18n';

// ── Shared sx helpers ──────────────────────────────────────────────

const inputSx = {
    input: { color: 'var(--text-color)' },
    label: { color: 'var(--text-color-light)' },
    '& .MuiOutlinedInput-root': {
        backgroundColor: 'var(--input-bg-color)',
        '& fieldset': { borderColor: 'var(--border-color)' },
        '&:hover fieldset': { borderColor: 'var(--primary-color)' },
    },
};

const multilineSx = {
    '& .MuiOutlinedInput-root': {
        backgroundColor: 'var(--input-bg-color)',
        color: 'var(--text-color)',
        '& fieldset': { borderColor: 'var(--border-color)' },
        '&:hover fieldset': { borderColor: 'var(--primary-color)' },
    },
    label: { color: 'var(--text-color-light)' },
};

const selectSx = {
    color: 'var(--text-color)',
    background: 'var(--input-bg-color)',
    fontSize: 12,
    height: 32,
    '& .MuiOutlinedInput-notchedOutline': { borderColor: 'var(--border-color)' },
    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'var(--primary-color)' },
    '& .MuiSvgIcon-root': { color: 'var(--text-color-light)' },
};

const dialogPaperSx = {
    background: 'var(--sidebar-bg-color)',
    color: 'var(--text-color)',
    border: '1px solid var(--border-color)',
};

const menuItemSx = {
    background: 'var(--sidebar-bg-color)',
    color: 'var(--text-color)',
    border: '1px solid var(--border-color)',
};

const selectMenuProps = {
    disableRestoreFocus: true,
    onClose: () => releaseNativeDialogFocus(),
    slotProps: { paper: { sx: menuItemSx } },
};

const FILE_TYPES: ModFileType[] = ['dll', 'asset', 'mod-info', 'script', 'config', 'folder', 'readme'];

function getUpdatePolicyMode(item?: { updatePolicy?: ModUpdatePolicy }): ModUpdatePolicy['mode'] {
    return item?.updatePolicy?.mode || 'replace-confirm';
}

function confirmReplaceUpdate(itemName: string): boolean {
    return window.confirm(`${itemName} 업데이트는 기존 모드를 삭제 후 새로 설치합니다.\n사용자 파일이 보존되지 않을 수 있습니다. 계속할까요?`);
}

// ── Types ──────────────────────────────────────────────────────────

type CtxMenuState = {
    mouseX: number;
    mouseY: number;
    packageId: string;
    hasSettings: boolean;
};

type DllFileEntry = {
    filePath: string;
    name: string;
    author: string;
    type: ModFileType;
};

type ZipEditableEntry = ZipEntryInfo & {
    sourceEntryName?: string;
    contentTextOverride?: string;
    selectedType: ModFileType;
    editName: string;
    editAuthor: string;
    editDependsOn: string;
};

type PackSourceEntry = {
    id: string;
    sourcePath: string;
    sourceKind: 'dll' | 'zip';
    sourceName: string;
    packageName: string;
    author: string;
    description: string;
    packageType: 'single' | 'collection';
    entries: ZipEditableEntry[];
    warnings: string[];
};

type JsonArrayPathCandidate = {
    path: string;
    itemType: 'string' | 'object' | 'objectMap';
    valueKeys: string[];
    fields: string[];
    filterValues: Record<string, string[]>;
    examples: Array<{ key: string; data: Record<string, unknown> }>;
};

type LinkedConfigPreview = {
    candidate: JsonArrayPathCandidate;
    example: { key: string; data: Record<string, unknown> };
    targetPath: string;
    fields: string[];
    filteredCount: number;
    fileName: string;
};

type LinkedConfigReconcileItem = {
    key: string;
    fileName?: string;
    assetPath?: string;
};

type LinkedConfigReconcilePlan = {
    registryCount: number;
    assetCount: number;
    removeCandidates: LinkedConfigReconcileItem[];
    addCandidates: LinkedConfigReconcileItem[];
};

type ModDistributionForm = {
    id: string;
    name: string;
    author: string;
    description: string;
    version: string;
    zipPath: string;
    readmeFilePath: string;
    readmePath: string;
    updatePolicyMode: ModUpdatePolicy['mode'];
    updatePolicyPreserveText: string;
    updatePolicyRemoveMissing: boolean;
    downloadPath: string;
    sha256: string;
    gameIdsText: string;
};

type ScriptBuilderFeature = ScriptFeature & {
    sampleText?: string;
    cfgText?: string;
    collapsed?: boolean;
    linkedConfigContentCollapsed?: boolean;
    linkedConfigSourceId?: string;
    linkedConfigSourceEntryName?: string;
    linkedConfigText?: string;
    linkedConfigPreviewText?: string;
    linkedConfigArrayCandidates?: JsonArrayPathCandidate[];
    linkedConfigData?: unknown;
    linkedConfigReconcileRemoveKeys?: string[];
    linkedConfigReconcileAddKeys?: string[];
    linkedConfigReconcileAddValues?: Record<string, Record<string, unknown>>;
};

// Parses the result from setPackageEnabled / setDllEnabled (legacy array or new ToggleResult)
function parseToggleResult(result: unknown): ToggleResult {
    if (Array.isArray(result)) return { packages: result as ModPackage[], warnings: [] };
    return result as ToggleResult;
}

type PackageTreeRow = {
    pkg: ModPackage;
    depth: number;
    hasDependents: boolean;
};

function getPackageDependencyKey(pkg: ModPackage): string[] {
    return [pkg.source?.catalogId, pkg.id, pkg.name]
        .filter((value): value is string => Boolean(value?.trim()))
        .map((value) => value.trim().toLowerCase());
}

function getDependencyTarget(pkg: ModPackage): string {
    return pkg.dependency?.target?.trim().toLowerCase() ?? '';
}

function getPackageDependencyTarget(pkg: ModPackage): string {
    return pkg.source?.catalogId || pkg.id || pkg.name;
}

function getPackageDependencyLabel(pkg: ModPackage): string {
    return pkg.source?.catalogId ? `${pkg.name} (${pkg.source.catalogId})` : pkg.name;
}

function getDependencyPackage(packages: ModPackage[], target: string): ModPackage | undefined {
    const normalized = target.trim().toLowerCase();
    if (!normalized) return undefined;
    return packages.find((pkg) => getPackageDependencyKey(pkg).includes(normalized));
}

function getDependencyInstallPathHints(packages: ModPackage[], target: string): string[] {
    const pkg = getDependencyPackage(packages, target);
    return pkg?.installPathHints ?? [];
}

function buildPackageTreeRows(packages: ModPackage[], expandedDependencyIds: Set<string>): PackageTreeRow[] {
    const sorted = [...packages].sort((a, b) => a.name.localeCompare(b.name));
    const childrenByParentId = new Map<string, ModPackage[]>();
    const childIds = new Set<string>();

    for (const pkg of sorted) {
        if (!pkg.dependency?.target) continue;
        const parent = sorted.find((candidate) => candidate.id !== pkg.id && getPackageDependencyKey(candidate).includes(getDependencyTarget(pkg)));
        if (!parent) continue;
        childIds.add(pkg.id);
        if (!childrenByParentId.has(parent.id)) childrenByParentId.set(parent.id, []);
        childrenByParentId.get(parent.id)!.push(pkg);
    }

    const rows: PackageTreeRow[] = [];
    const visited = new Set<string>();
    const visit = (pkg: ModPackage, depth: number) => {
        if (visited.has(pkg.id)) return;
        visited.add(pkg.id);
        const children = childrenByParentId.get(pkg.id) ?? [];
        rows.push({
            pkg,
            depth,
            hasDependents: children.length > 0,
        });
        if (!expandedDependencyIds.has(pkg.id)) return;
        for (const child of children) visit(child, depth + 1);
    };

    for (const pkg of sorted) {
        if (!childIds.has(pkg.id)) visit(pkg, 0);
    }
    for (const pkg of sorted) {
        if (!visited.has(pkg.id) && !childIds.has(pkg.id)) visit(pkg, 0);
    }

    return rows;
}

// ── Settings Dialog ────────────────────────────────────────────────

function SettingsDialog({ packageId, onClose }: { packageId: string; onClose: () => void }) {
    const { showNotification } = useNotification();
    const [settings, setSettings] = useState<PackageSettings | null>(null);
    const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
    const [jsonValues, setJsonValues] = useState<Record<string, string | number | boolean>>({});
    const [selectedFiles, setSelectedFiles] = useState<Record<string, string>>({});
    const [pendingImports, setPendingImports] = useState<Array<{ featureId: string; sourcePath: string; metadata?: Record<string, unknown> }>>([]);
    const [pendingImportValues, setPendingImportValues] = useState<Record<string, Record<string, unknown>>>({});
    const [pendingDeletes, setPendingDeletes] = useState<Array<{ featureId: string; fileName: string }>>([]);
    const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});
    const [selectedConfigPath, setSelectedConfigPath] = useState<string | null>(null);
    const [configContent, setConfigContent] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [helpOpen, setHelpOpen] = useState(false);
    const [guideText] = useState('');

    useEffect(() => {
        window.electronAPI.getPackageSettings(packageId).then((data: PackageSettings) => {
            setSettings(data);
            setFieldValues(data.cfgValues);
            setJsonValues(data.jsonValues ?? {});
        });
    }, [packageId]);

    const handleSelectFile = async (field: ScriptField) => {
        const filePath = await window.electronAPI.selectFile(field.accept ?? '*');
        releaseNativeDialogFocus();
        if (!filePath) return;
        setSelectedFiles((prev) => ({ ...prev, [field.id]: filePath }));
        if (field.preview) {
            const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
            if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'webm'].includes(ext)) {
                setPreviewUrls((prev) => ({ ...prev, [field.id]: `file://${filePath}` }));
            }
        }
    };

    const handleLoadConfig = async (configPath: string) => {
        setSelectedConfigPath(configPath);
        setConfigContent(await window.electronAPI.readConfigText(configPath));
    };

    const handleApply = async () => {
        setSaving(true);
        setError('');
        try {
            if ((settings?.features?.length ?? 0) > 0) {
                const changes: ApplyPackageSettingsChanges = {
                    cfgValues: fieldValues,
                    jsonValues,
                    fileImports: pendingImports.map((item) => ({
                        ...item,
                        metadata: pendingImportValues[`${item.featureId}:${item.sourcePath}`] ?? item.metadata,
                    })),
                    fileDeletes: pendingDeletes,
                    configText: selectedConfigPath ? { path: selectedConfigPath, content: configContent } : null,
                };
                const updated = await window.electronAPI.applyPackageSettings(packageId, changes);
                setSettings(updated);
                setFieldValues(updated.cfgValues ?? {});
                setJsonValues(updated.jsonValues ?? {});
                setPendingImports([]);
                setPendingImportValues({});
                setPendingDeletes([]);
                showNotification('설정이 저장되었습니다.');
                onClose();
                return;
            }
            if (settings) {
                for (const { config } of settings.scripts) {
                    for (const section of config.sections ?? []) {
                        for (const field of section.fields ?? []) {
                            if (field.ui_type === 'switch' && field.target?.type === 'cfg') {
                                const val = fieldValues[field.id];
                                if (val !== undefined) {
                                    await window.electronAPI.applyCfgValue(
                                        field.target.path,
                                        field.target.section,
                                        field.target.key,
                                        val
                                    );
                                }
                            }
                        }
                    }
                }
            }
            for (const [fieldId, filePath] of Object.entries(selectedFiles)) {
                const field = settings?.scripts
                    .flatMap((s) => s.config.sections ?? [])
                    .flatMap((section) => section.fields ?? [])
                    .find((f) => f.id === fieldId);
                if (field?.action === 'replace_resource' && field.target_path) {
                    await window.electronAPI.copyResource(filePath, field.target_path);
                }
            }
            if (selectedConfigPath && configContent !== null) {
                await window.electronAPI.writeConfigText(selectedConfigPath, configContent);
            }
            showNotification('설정이 저장되었습니다.');
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : '설정 저장 실패');
        } finally {
            setSaving(false);
        }
    };

    const renderField = (field: ScriptField) => {
        if (field.ui_type === 'switch') {
            const checked =
                (fieldValues[field.id] ?? String(field.default ?? 'true')).toLowerCase() === 'true';
            return (
                <FormControlLabel
                    key={field.id}
                    control={
                        <Switch
                            checked={checked}
                            onChange={(e) =>
                                setFieldValues((prev) => ({
                                    ...prev,
                                    [field.id]: e.target.checked ? 'true' : 'false',
                                }))
                            }
                            sx={{ '& .MuiSwitch-thumb': { background: 'var(--primary-color)' } }}
                        />
                    }
                    label={
                        <Typography sx={{ color: 'var(--text-color)', fontSize: 14 }}>
                            {field.label}
                        </Typography>
                    }
                />
            );
        }
        if (field.ui_type === 'image_picker') {
            const preview = previewUrls[field.id];
            const selected = selectedFiles[field.id];
            return (
                <Box key={field.id}>
                    <Typography sx={{ color: 'var(--text-color)', fontSize: 14, mb: 0.5 }}>
                        {field.label}
                    </Typography>
                    <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                        <Button
                            size="small"
                            variant="outlined"
                            startIcon={<FolderOpenIcon />}
                            onClick={() => handleSelectFile(field)}
                            sx={{ borderColor: 'var(--border-color)', color: 'var(--text-color)' }}
                        >
                            파일 선택
                        </Button>
                        {selected && (
                            <Typography sx={{ color: 'var(--text-color-light)', fontSize: 12 }}>
                                {selected.split(/[\\/]/).pop()}
                            </Typography>
                        )}
                    </Stack>
                    {preview && (
                        <Box
                            component="img"
                            src={preview}
                            alt="preview"
                            sx={{
                                mt: 1,
                                maxWidth: 160,
                                maxHeight: 120,
                                borderRadius: 1,
                                border: '1px solid var(--border-color)',
                            }}
                        />
                    )}
                    {!preview && selected && (
                        <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <ImageIcon sx={{ color: 'var(--text-color-light)', fontSize: 18 }} />
                            <Typography sx={{ color: 'var(--text-color-light)', fontSize: 12 }}>
                                미리보기 없음
                            </Typography>
                        </Box>
                    )}
                </Box>
            );
        }
        return null;
    };

    const renderConfigField = (field: ScriptField, valueId: string, value: string | number | boolean) => {
        if (field.ui_type === 'switch') {
            const checked = value === true || String(value).toLowerCase() === 'true';
            return (
                <FormControlLabel
                    control={
                        <Switch
                            checked={checked}
                            onChange={(e) => setFieldValues((prev) => ({ ...prev, [valueId]: e.target.checked ? 'true' : 'false' }))}
                        />
                    }
                    label={<Typography sx={{ color: 'var(--text-color)', fontSize: 14 }}>{field.label}</Typography>}
                />
            );
        }
        if (field.ui_type === 'select') {
            return (
                <Box>
                    <Typography sx={{ color: 'var(--text-color)', fontSize: 13, mb: 0.5 }}>{field.label}</Typography>
                    <Select
                        size="small"
                        value={String(value ?? '')}
                        onChange={(e) => setFieldValues((prev) => ({ ...prev, [valueId]: String(e.target.value) }))}
                        sx={{ ...selectSx, minWidth: 220 }}
                        MenuProps={selectMenuProps}
                    >
                        {(field.options ?? []).map((option) => (
                            <MenuItem key={option.value} value={option.value}>
                                {option.label}
                            </MenuItem>
                        ))}
                    </Select>
                </Box>
            );
        }
        return (
            <TextField
                size="small"
                label={field.label}
                type={field.ui_type === 'number' ? 'number' : 'text'}
                value={String(value ?? '')}
                onChange={(e) => setFieldValues((prev) => ({ ...prev, [valueId]: e.target.value }))}
                sx={inputSx}
            />
        );
    };

    const renderJsonField = (feature: ScriptFeature, field: ScriptField) => {
        const valueId = `${feature.id}:${field.id}`;
        const value = jsonValues[valueId] ?? field.default ?? field.value ?? '';
        if (field.ui_type === 'switch') {
            const checked = value === true || String(value).toLowerCase() === 'true';
            return (
                <FormControlLabel
                    key={valueId}
                    control={
                        <Switch
                            checked={checked}
                            onChange={(e) => setJsonValues((prev) => ({ ...prev, [valueId]: e.target.checked }))}
                        />
                    }
                    label={<Typography sx={{ color: 'var(--text-color)', fontSize: 14 }}>{field.label}</Typography>}
                />
            );
        }
        if (field.ui_type === 'select') {
            return (
                <Box key={valueId}>
                    <Typography sx={{ color: 'var(--text-color)', fontSize: 13, mb: 0.5 }}>{field.label}</Typography>
                    <Select
                        size="small"
                        value={String(value ?? '')}
                        onChange={(e) => setJsonValues((prev) => ({ ...prev, [valueId]: String(e.target.value) }))}
                        sx={{ ...selectSx, minWidth: 220 }}
                        MenuProps={selectMenuProps}
                    >
                        {(field.options ?? []).map((option) => (
                            <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
                        ))}
                    </Select>
                </Box>
            );
        }
        return (
            <TextField
                key={valueId}
                size="small"
                label={field.label}
                type={field.ui_type === 'number' ? 'number' : 'text'}
                value={String(value ?? '')}
                onChange={(e) =>
                    setJsonValues((prev) => ({
                        ...prev,
                        [valueId]: field.ui_type === 'number' ? Number(e.target.value) : e.target.value,
                    }))
                }
                sx={inputSx}
            />
        );
    };

    const getFileManagerFields = (feature: ScriptFeature) =>
        feature.linkedConfigSelectedFields && feature.linkedConfigSelectedFields.length > 0
            ? feature.linkedConfigSelectedFields
            : Object.keys(feature.linkedConfigFieldDefaults ?? {});

    const renderMetadataInput = (feature: ScriptFeature, sourcePath: string, field: string) => {
        const valueId = `${feature.id}:${sourcePath}`;
        const values = pendingImportValues[valueId] ?? {};
        const fallback = feature.linkedConfigFieldDefaults?.[field] ?? '';
        const value = values[field] ?? fallback;
        return (
            <TextField
                key={field}
                size="small"
                label={field}
                type={typeof fallback === 'number' ? 'number' : 'text'}
                value={Array.isArray(value) ? value.join(', ') : String(value ?? '')}
                onChange={(e) => {
                    const nextValue =
                        Array.isArray(fallback)
                            ? e.target.value.split(',').map((item) => item.trim()).filter(Boolean)
                            : typeof fallback === 'number'
                              ? Number(e.target.value)
                              : e.target.value;
                    setPendingImportValues((prev) => ({
                        ...prev,
                        [valueId]: { ...(prev[valueId] ?? {}), [field]: nextValue },
                    }));
                }}
                sx={{ ...inputSx, minWidth: 150, flex: '1 1 160px' }}
            />
        );
    };

    const renderFeature = (feature: ScriptFeature) => {
        const managedGroup = settings?.managedFiles.find((group) => group.featureId === feature.id);
        return (
            <Box
                key={feature.id}
                sx={{ p: 1.5, border: '1px solid var(--border-color)', borderRadius: 1, background: 'var(--input-bg-color)' }}
            >
                <Typography sx={{ color: 'var(--primary-color)', fontWeight: 800, mb: 1 }}>
                    {feature.name}
                </Typography>
                {feature.type === 'cfg_fields' && (
                    <Stack spacing={1}>
                        {(feature.fields ?? []).map((field) => {
                            const valueId = `${feature.id}:${field.id}`;
                            return <Box key={valueId}>{renderConfigField(field, valueId, fieldValues[valueId] ?? field.default ?? '')}</Box>;
                        })}
                    </Stack>
                )}
                {feature.type === 'json_manager' && (
                    <Stack spacing={1}>{(feature.fields ?? []).map((field) => renderJsonField(feature, field))}</Stack>
                )}
                {feature.type === 'file_manager' && (
                    <Stack spacing={1}>
                        <Typography sx={{ color: 'var(--text-color-light)', fontSize: 12 }}>
                            {feature.targetDir} / {(feature.extensions ?? []).join(', ')}
                        </Typography>
                        <Button
                            size="small"
                            variant="outlined"
                            startIcon={<UploadFileIcon />}
                            onClick={async () => {
                                const filePath = await window.electronAPI.selectManagedFile((feature.extensions ?? []).map((ext) => `.${ext.replace(/^\./, '')}`).join(','));
                                if (filePath) {
                                    setPendingImports((prev) => [...prev, { featureId: feature.id, sourcePath: filePath }]);
                                    const valueId = `${feature.id}:${filePath}`;
                                    setPendingImportValues((prev) => ({
                                        ...prev,
                                        [valueId]: Object.fromEntries(
                                            getFileManagerFields(feature).map((field) => [field, feature.linkedConfigFieldDefaults?.[field] ?? ''])
                                        ),
                                    }));
                                }
                            }}
                            sx={{ alignSelf: 'flex-start', borderColor: 'var(--border-color)', color: 'var(--text-color)' }}
                        >
                            import
                        </Button>
                        {pendingImports.filter((item) => item.featureId === feature.id).map((item) => {
                            const fileName = item.sourcePath.split(/[\\/]/).pop() ?? item.sourcePath;
                            const fields = getFileManagerFields(feature);
                            return (
                                <Box key={item.sourcePath} sx={{ p: 1, border: '1px solid var(--border-color)', borderRadius: 1 }}>
                                    <Typography sx={{ color: 'var(--text-color)', fontSize: 13, mb: 1 }}>{fileName}</Typography>
                                    {fields.length > 0 && (
                                        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', rowGap: 1 }}>
                                            {fields.map((field) => renderMetadataInput(feature, item.sourcePath, field))}
                                        </Stack>
                                    )}
                                </Box>
                            );
                        })}
                        {(managedGroup?.files ?? []).map((fileName) => {
                            const deleting = pendingDeletes.some((item) => item.featureId === feature.id && item.fileName === fileName);
                            return (
                                <Stack key={fileName} direction="row" spacing={1} sx={{ alignItems: 'center', opacity: deleting ? 0.45 : 1 }}>
                                    <Typography sx={{ color: 'var(--text-color)', fontSize: 13, flex: 1 }}>{fileName}</Typography>
                                    {(managedGroup?.files ?? []).includes(fileName) && (
                                        <Button
                                            size="small"
                                            color="error"
                                            disabled={deleting || saving}
                                            onClick={() =>
                                                setPendingDeletes((prev) =>
                                                    prev.some((item) => item.featureId === feature.id && item.fileName === fileName)
                                                        ? prev
                                                        : [...prev, { featureId: feature.id, fileName }]
                                                )
                                            }
                                        >
                                            delete
                                        </Button>
                                    )}
                                </Stack>
                            );
                        })}
                    </Stack>
                )}
            </Box>
        );
    };

    const renderSection = (section: ScriptSection, idx: number) => (
        <Box key={idx} sx={{ mb: 2 }}>
            <Typography
                variant="subtitle2"
                sx={{
                    color: 'var(--primary-color)',
                    fontWeight: 700,
                    mb: 1,
                    borderBottom: '1px solid var(--border-color)',
                    pb: 0.5,
                }}
            >
                {section.title}
            </Typography>
            <Stack spacing={1}>
                {section.fields.map((field) => (
                    <Box key={field.id}>{renderField(field)}</Box>
                ))}
            </Stack>
        </Box>
    );

    return (
        <>
        <Dialog
            open
            onClose={onClose}
            maxWidth="sm"
            fullWidth
            slotProps={{ paper: { sx: { ...dialogPaperSx, maxHeight: '80vh' } } }}
        >
            <DialogTitle sx={{ color: 'var(--text-color)', borderBottom: '1px solid var(--border-color)' }}>
                모드 설정
            </DialogTitle>
            <DialogContent sx={{ pt: 2 }}>
                {!settings ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                        <CircularProgress sx={{ color: 'var(--primary-color)' }} />
                    </Box>
                ) : (
                    <Stack spacing={2}>
                        {error && <Alert severity="error">{error}</Alert>}
                        {(settings.warnings ?? []).map((warning, idx) => (
                            <Alert key={idx} severity="warning">{warning}</Alert>
                        ))}
                        {(settings.features ?? []).length > 0 && (
                            <Stack spacing={1.5}>
                                {settings.features.map((feature) => renderFeature(feature))}
                            </Stack>
                        )}
                        {settings.scripts.map(({ scriptPath, config }) => (
                            <Box key={scriptPath}>
                                {(config.sections ?? []).map((section, idx) => renderSection(section, idx))}
                            </Box>
                        ))}
                        {settings.configPaths.length > 0 && (
                            <Box>
                                <Typography
                                    variant="subtitle2"
                                    sx={{
                                        color: 'var(--primary-color)',
                                        fontWeight: 700,
                                        mb: 1,
                                        borderBottom: '1px solid var(--border-color)',
                                        pb: 0.5,
                                    }}
                                >
                                    설정 파일
                                </Typography>
                                <Stack spacing={0.5} sx={{ mb: 1 }}>
                                    {settings.configPaths.map((cfgPath) => (
                                        <Button
                                            key={cfgPath}
                                            size="small"
                                            variant={selectedConfigPath === cfgPath ? 'contained' : 'outlined'}
                                            onClick={() => handleLoadConfig(cfgPath)}
                                            sx={{
                                                justifyContent: 'flex-start',
                                                borderColor: 'var(--border-color)',
                                                color:
                                                    selectedConfigPath === cfgPath
                                                        ? 'var(--button-text-color)'
                                                        : 'var(--text-color)',
                                                background:
                                                    selectedConfigPath === cfgPath
                                                        ? 'var(--button-bg-color)'
                                                        : 'transparent',
                                                fontSize: 12,
                                            }}
                                        >
                                            {cfgPath}
                                        </Button>
                                    ))}
                                </Stack>
                                {selectedConfigPath && (
                                    <TextField
                                        multiline
                                        minRows={6}
                                        maxRows={14}
                                        fullWidth
                                        value={configContent}
                                        onChange={(e) => setConfigContent(e.target.value)}
                                        sx={multilineSx}
                                        slotProps={{
                                            htmlInput: { style: { fontFamily: 'monospace', fontSize: 12 } },
                                        }}
                                    />
                                )}
                            </Box>
                        )}
                        {settings.scripts.length === 0 && settings.configPaths.length === 0 && settings.features.length === 0 && (
                            <Typography
                                sx={{ color: 'var(--text-color-light)', textAlign: 'center', py: 2 }}
                            >
                                설정 항목이 없습니다.
                            </Typography>
                        )}
                    </Stack>
                )}
            </DialogContent>
            <DialogActions sx={{ borderTop: '1px solid var(--border-color)' }}>
                <Button onClick={onClose} sx={{ color: 'var(--text-color-light)' }}>
                    닫기
                </Button>
                <Button
                    variant="contained"
                    onClick={handleApply}
                    disabled={saving}
                    sx={{ background: 'var(--button-bg-color)', color: 'var(--button-text-color)' }}
                >
                    {saving ? <CircularProgress size={18} /> : '적용'}
                </Button>
            </DialogActions>
        </Dialog>
        <Dialog
            open={helpOpen}
            onClose={() => setHelpOpen(false)}
            maxWidth="md"
            fullWidth
            slotProps={{ paper: { sx: { ...dialogPaperSx, maxHeight: '80vh' } } }}
        >
            <DialogTitle sx={{ color: 'var(--text-color)', borderBottom: '1px solid var(--border-color)' }}>
                모드 패킹 설명서
            </DialogTitle>
            <DialogContent sx={{ pt: 2 }}>
                <Typography
                    component="pre"
                    sx={{
                        color: 'var(--text-color)',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        fontFamily: 'inherit',
                        fontSize: 13,
                        m: 0,
                    }}
                >
                    {guideText || '설명서를 불러오는 중입니다.'}
                </Typography>
            </DialogContent>
            <DialogActions sx={{ borderTop: '1px solid var(--border-color)' }}>
                <Button onClick={() => setHelpOpen(false)} sx={{ color: 'var(--text-color-light)' }}>
                    닫기
                </Button>
            </DialogActions>
        </Dialog>
        </>
    );
}

// ── Detail Dialog ──────────────────────────────────────────────────

function DetailDialog({ pkg, onClose }: { pkg: ModPackage; onClose: () => void }) {
    const [readmeText, setReadmeText] = useState('');
    const [readmeError, setReadmeError] = useState('');

    useEffect(() => {
        if (!pkg.readmePath) return;
        window.electronAPI.getPackageReadme(pkg.id)
            .then(setReadmeText)
            .catch((err) => setReadmeError(err instanceof Error ? err.message : 'README를 불러오지 못했습니다.'));
    }, [pkg.id, pkg.readmePath]);

    return (
        <>
        <Dialog
            open
            onClose={onClose}
            maxWidth="md"
            fullWidth
            slotProps={{ paper: { sx: { ...dialogPaperSx, maxHeight: '85vh' } } }}
        >
            <DialogTitle sx={{ color: 'var(--text-color)', borderBottom: '1px solid var(--border-color)' }}>
                모드 상세 정보
            </DialogTitle>
            <DialogContent sx={{ pt: 2 }}>
                <Stack spacing={1.5}>
                    <Box>
                        <Typography variant="caption" sx={{ color: 'var(--text-color-light)' }}>
                            이름
                        </Typography>
                        <Typography sx={{ color: 'var(--text-color)' }}>{pkg.name}</Typography>
                    </Box>
                    {pkg.author && (
                        <Box>
                            <Typography variant="caption" sx={{ color: 'var(--text-color-light)' }}>
                                제작자
                            </Typography>
                            <Typography sx={{ color: 'var(--text-color)' }}>{pkg.author}</Typography>
                        </Box>
                    )}
                    {pkg.description && (
                        <Box>
                            <Typography variant="caption" sx={{ color: 'var(--text-color-light)' }}>
                                설명
                            </Typography>
                            <Typography sx={{ color: 'var(--text-color)' }}>{pkg.description}</Typography>
                        </Box>
                    )}
                    {pkg.readmePath && (
                        <Box>
                            <Typography variant="caption" sx={{ color: 'var(--text-color-light)' }}>
                                자세한 설명
                            </Typography>
                            {readmeError ? (
                                <Alert severity="warning" sx={{ mt: 0.5 }}>{readmeError}</Alert>
                            ) : (
                                <Typography
                                    component="pre"
                                    sx={{
                                        mt: 0.5,
                                        p: 1,
                                        border: '1px solid var(--border-color)',
                                        borderRadius: 1,
                                        background: 'var(--input-bg-color)',
                                        color: 'var(--text-color)',
                                        whiteSpace: 'pre-wrap',
                                        wordBreak: 'break-word',
                                        fontFamily: 'inherit',
                                        fontSize: 13,
                                    }}
                                >
                                    {readmeText || 'README를 불러오는 중입니다.'}
                                </Typography>
                            )}
                        </Box>
                    )}
                    {pkg.version && (
                        <Box>
                            <Typography variant="caption" sx={{ color: 'var(--text-color-light)' }}>
                                버전
                            </Typography>
                            <Typography sx={{ color: 'var(--text-color)' }}>v{pkg.version}</Typography>
                        </Box>
                    )}
                    <Box>
                        <Typography variant="caption" sx={{ color: 'var(--text-color-light)' }}>
                            패키지 타입
                        </Typography>
                        <Box sx={{ mt: 0.5 }}>
                            <Chip
                                label={pkg.packageType === 'collection' ? '컬렉션' : '단일'}
                                size="small"
                                sx={{ background: 'var(--primary-color)', color: '#fff', fontSize: 11 }}
                            />
                        </Box>
                    </Box>
                    <Box>
                        <Typography variant="caption" sx={{ color: 'var(--text-color-light)' }}>
                            DLL 파일 목록
                        </Typography>
                        <Stack spacing={0.5} sx={{ mt: 0.5 }}>
                            {pkg.dlls.map((dll) => (
                                <Box
                                    key={dll.relativePath}
                                    sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                                >
                                    <Chip
                                        label={dll.enabled ? '활성' : '비활성'}
                                        size="small"
                                        sx={{
                                            fontSize: 10,
                                            background: dll.enabled
                                                ? 'var(--primary-color)'
                                                : 'var(--accent-color)',
                                            color: '#fff',
                                        }}
                                    />
                                    <Typography sx={{ color: 'var(--text-color)', fontSize: 13 }}>
                                        {dll.displayName}
                                    </Typography>
                                    <Typography sx={{ color: 'var(--text-color-light)', fontSize: 11 }}>
                                        ({dll.relativePath})
                                    </Typography>
                                </Box>
                            ))}
                        </Stack>
                    </Box>
                </Stack>
            </DialogContent>
            <DialogActions sx={{ borderTop: '1px solid var(--border-color)' }}>
                <Button onClick={onClose} sx={{ color: 'var(--text-color-light)' }}>
                    닫기
                </Button>
            </DialogActions>
        </Dialog>
        </>
    );
}

// ── ZIP Entry Table (shared between AddModDialog and PackModDialog) ─

const smallInputSx = {
    ...inputSx,
    '& .MuiOutlinedInput-root': {
        fontSize: 12,
        height: 30,
        backgroundColor: 'var(--input-bg-color)',
        '& fieldset': { borderColor: 'var(--border-color)' },
    },
    input: { color: 'var(--text-color)', p: '4px 8px' },
};

function ZipEntryTable({
    entries,
    onChange,
    onDelete,
    dependsOnOptions = [],
    showDependsOn = false,
    readOnly = false,
    lockDllAndFolderTypes = false,
    getDisabledTypes,
}: {
    entries: ZipEditableEntry[];
    onChange: (idx: number, patch: Partial<ZipEditableEntry>) => void;
    onDelete: (idx: number) => void;
    dependsOnOptions?: string[];
    showDependsOn?: boolean;
    readOnly?: boolean;
    lockDllAndFolderTypes?: boolean;
    getDisabledTypes?: (entry: ZipEditableEntry) => ModFileType[];
}) {
    const headSx = {
        color: 'var(--text-color-light)',
        fontSize: 11,
        background: 'var(--sidebar-bg-color)',
    };

    return (
        <TableContainer
            component={Paper}
            sx={{
                background: 'var(--input-bg-color)',
                border: '1px solid var(--border-color)',
                maxHeight: 320,
                overflowY: 'auto',
            }}
        >
            <Table size="small" stickyHeader>
                <TableHead>
                    <TableRow>
                        <TableCell sx={{ ...headSx, width: 200 }}>경로</TableCell>
                        <TableCell sx={{ ...headSx, width: 110 }}>타입</TableCell>
                        <TableCell sx={headSx}>이름</TableCell>
                        <TableCell sx={headSx}>제작자</TableCell>
                        {showDependsOn && <TableCell sx={{ ...headSx, width: 180 }}>Depends On</TableCell>}
                        <TableCell sx={{ ...headSx, width: 52 }} />
                    </TableRow>
                </TableHead>
                <TableBody>
                    {entries.map((entry, idx) => {
                        const disabledTypes = getDisabledTypes?.(entry) ?? [];
                        const isCommonFolder =
                            entry.selectedType === 'folder' &&
                            COMMON_FOLDER_NAMES.includes(
                                entry.entryName.replace(/\/$/, '').split('/').pop()?.toLowerCase() ?? ''
                            );

                        return (
                            <TableRow
                                key={idx}
                                sx={{
                                    opacity: entry.mismatch === 'missing_in_zip' ? 0.5 : 1,
                                    background:
                                        entry.mismatch === 'missing_in_zip'
                                            ? 'rgba(255,100,100,0.05)'
                                            : entry.mismatch === 'missing_in_modinfo'
                                              ? 'rgba(255,200,0,0.05)'
                                              : 'transparent',
                                }}
                            >
                                <TableCell sx={{ color: 'var(--text-color)', fontSize: 11, fontFamily: 'monospace' }}>
                                    {entry.entryName}
                                </TableCell>
                                <TableCell sx={{ py: 0.5 }}>
                                    <Select
                                        value={entry.selectedType}
                                        size="small"
                                        disabled={
                                            readOnly ||
                                            (lockDllAndFolderTypes &&
                                                (entry.selectedType === 'dll' || entry.selectedType === 'folder'))
                                        }
                                        onChange={(e) =>
                                            onChange(idx, { selectedType: e.target.value as ModFileType })
                                        }
                                        sx={selectSx}
                                        MenuProps={selectMenuProps}
                                    >
                                        {FILE_TYPES.map((t) => (
                                            <MenuItem
                                                key={t}
                                                value={t}
                                                disabled={disabledTypes.includes(t)}
                                                sx={{ fontSize: 12 }}
                                            >
                                                {MOD_FILE_TYPE_LABELS[t]}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </TableCell>
                                <TableCell sx={{ py: 0.5 }}>
                                    <TextField
                                        size="small"
                                        value={entry.editName}
                                        disabled={readOnly}
                                        onChange={(e) => onChange(idx, { editName: e.target.value })}
                                        placeholder="표시 이름"
                                        sx={smallInputSx}
                                    />
                                </TableCell>
                                <TableCell sx={{ py: 0.5 }}>
                                    <TextField
                                        size="small"
                                        value={entry.editAuthor}
                                        disabled={readOnly}
                                        onChange={(e) => onChange(idx, { editAuthor: e.target.value })}
                                        placeholder="제작자"
                                        sx={smallInputSx}
                                    />
                                </TableCell>
                                {showDependsOn && (
                                    <TableCell sx={{ py: 0.5 }}>
                                        <Select
                                            value={entry.editDependsOn}
                                            size="small"
                                            disabled={readOnly}
                                            onChange={(e) => onChange(idx, { editDependsOn: e.target.value })}
                                            sx={{ ...selectSx, width: '100%' }}
                                            MenuProps={selectMenuProps}
                                        >
                                            <MenuItem value="" sx={{ fontSize: 12 }}>
                                                Package
                                            </MenuItem>
                                            <MenuItem value="modpack" sx={{ fontSize: 12 }}>
                                                Modpack
                                            </MenuItem>
                                            {dependsOnOptions.map((dllPath) => (
                                                <MenuItem key={dllPath} value={dllPath} sx={{ fontSize: 12 }}>
                                                    {dllPath}
                                                </MenuItem>
                                            ))}
                                        </Select>
                                    </TableCell>
                                )}
                                <TableCell sx={{ py: 0.5, textAlign: 'center' }}>
                                    <Stack direction="row" spacing={0} sx={{ alignItems: 'center' }}>
                                        {entry.mismatch === 'missing_in_zip' && (
                                            <Tooltip title="ZIP에 파일 없음">
                                                <ErrorOutlineIcon sx={{ color: 'var(--accent-color)', fontSize: 15 }} />
                                            </Tooltip>
                                        )}
                                        {entry.mismatch === 'missing_in_modinfo' && (
                                            <Tooltip title="mod-info에 미등록">
                                                <WarningAmberIcon sx={{ color: '#e6a817', fontSize: 15 }} />
                                            </Tooltip>
                                        )}
                                        {isCommonFolder && (
                                            <Tooltip title="공통 폴더명 — 다른 모드와 충돌 가능성">
                                                <WarningAmberIcon sx={{ color: '#e6a817', fontSize: 15 }} />
                                            </Tooltip>
                                        )}
                                        {!readOnly && (
                                            <IconButton
                                                size="small"
                                                onClick={() => onDelete(idx)}
                                                sx={{ color: 'var(--text-color-light)', p: '2px' }}
                                            >
                                                <DeleteIcon sx={{ fontSize: 14 }} />
                                            </IconButton>
                                        )}
                                    </Stack>
                                </TableCell>
                            </TableRow>
                        );
                    })}
                </TableBody>
            </Table>
        </TableContainer>
    );
}

function parseCfgFields(cfgPath: string, cfgText: string): ScriptField[] {
    const fields: ScriptField[] = [];
    let section = '';
    for (const line of cfgText.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith(';') || trimmed.startsWith('//')) continue;
        if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
            section = trimmed.slice(1, -1).trim();
            continue;
        }
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx === -1 || !section) continue;
        const key = trimmed.slice(0, eqIdx).trim();
        const value = trimmed.slice(eqIdx + 1).trim();
        const lower = value.toLowerCase();
        const uiType: ScriptField['ui_type'] =
            lower === 'true' || lower === 'false' ? 'switch' : Number.isFinite(Number(value)) ? 'number' : 'text';
        fields.push({
            id: `${section}_${key}`.replace(/[^a-zA-Z0-9_]/g, '_'),
            label: key,
            ui_type: uiType,
            default: value,
            target: { type: 'cfg', path: cfgPath, section, key },
        });
    }
    return fields;
}

function stripJsonBom(text: string): string {
    return text.replace(/^[\uFEFF\u200B\u200C\u200D\u2060]+/, '');
}

function parseJsonText<T>(text: string | undefined, fallback: T): T {
    const source = stripJsonBom(text ?? '');
    if (!source.trim()) return fallback;
    try {
        return JSON.parse(source) as T;
    } catch {
        return fallback;
    }
}

function inferJsonFields(sampleText: string): ScriptField[] {
    const data = parseJsonText<unknown>(sampleText, {});
    const fields: ScriptField[] = [];
    const walk = (value: unknown, pathParts: string[]) => {
        if (value && typeof value === 'object' && !Array.isArray(value)) {
            for (const [key, child] of Object.entries(value as Record<string, unknown>)) walk(child, [...pathParts, key]);
            return;
        }
        const jsonPath = pathParts.join('.');
        const id = jsonPath.replace(/[^a-zA-Z0-9_]/g, '_');
        if (typeof value === 'boolean') fields.push({ id, label: jsonPath, ui_type: 'switch', value, default: value, jsonPath });
        else if (typeof value === 'number') fields.push({ id, label: jsonPath, ui_type: 'number', value, default: value, jsonPath });
        else if (Array.isArray(value) && value.every((item) => ['string', 'number', 'boolean'].includes(typeof item))) {
            fields.push({
                id,
                label: jsonPath,
                ui_type: 'select',
                value: String(value[0] ?? ''),
                default: String(value[0] ?? ''),
                jsonPath,
                options: value.map((item) => ({ label: String(item), value: String(item) })),
            });
        } else {
            fields.push({ id, label: jsonPath, ui_type: 'text', value: String(value ?? ''), default: String(value ?? ''), jsonPath });
        }
    };
    walk(data, []);
    return fields;
}

function inferLinkedConfigArrayCandidates(sampleText: string): JsonArrayPathCandidate[] {
    const data = parseJsonText<unknown>(sampleText, null);
    if (!data) return [];
    const candidates: JsonArrayPathCandidate[] = [];
    const likelyValueKeys = ['file', 'fileName', 'filename', 'path', 'name', 'id'];
    const readObjectFields = (items: Record<string, unknown>[]) =>
        [...new Set(items.flatMap((item) => Object.keys(item)))];
    const readFilterValues = (items: Record<string, unknown>[]) => {
        const values: Record<string, string[]> = {};
        for (const item of items) {
            for (const [key, value] of Object.entries(item)) {
                if (!['string', 'number', 'boolean'].includes(typeof value)) continue;
                const text = String(value);
                values[key] = values[key] ?? [];
                if (!values[key].includes(text)) values[key].push(text);
            }
        }
        return values;
    };
    const walk = (value: unknown, pathParts: string[]) => {
        if (value && typeof value === 'object' && !Array.isArray(value)) {
            const record = value as Record<string, unknown>;
            const objectMapItems = Object.entries(record).filter(
                ([, child]) => child && typeof child === 'object' && !Array.isArray(child)
            ) as Array<[string, Record<string, unknown>]>;
            if (objectMapItems.length > 0 && objectMapItems.length === Object.keys(record).length) {
                const pathName = pathParts.length > 0 ? pathParts.join('/') : '$';
                const items = objectMapItems.map(([, child]) => child);
                candidates.push({
                    path: pathName,
                    itemType: 'objectMap',
                    valueKeys: ['path', ...likelyValueKeys],
                    fields: readObjectFields(items),
                    filterValues: readFilterValues(items),
                    examples: objectMapItems.map(([key, child]) => ({ key, data: child })),
                });
            }
        }
        if (Array.isArray(value)) {
            const pathName = pathParts.length > 0 ? pathParts.join('/') : '$';
            if (value.every((item) => typeof item === 'string')) {
                candidates.push({ path: pathName, itemType: 'string', valueKeys: [], fields: [], filterValues: {}, examples: [] });
            } else if (value.every((item) => item && typeof item === 'object' && !Array.isArray(item))) {
                const items = value as Array<Record<string, unknown>>;
                const valueKeys = likelyValueKeys.filter((key) =>
                    value.some((item) => {
                        const child = (item as Record<string, unknown>)[key];
                        return ['string', 'number', 'boolean'].includes(typeof child);
                    })
                );
                candidates.push({
                    path: pathName,
                    itemType: 'object',
                    valueKeys,
                    fields: readObjectFields(items),
                    filterValues: readFilterValues(items),
                    examples: items.map((item, idx) => ({ key: String(idx), data: item })),
                });
            }
            return;
        }
        if (value && typeof value === 'object') {
            for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
                walk(child, [...pathParts, key]);
            }
        }
    };
    walk(data, []);
    return candidates;
}

function getDefaultLinkedConfigPatch(
    candidates: JsonArrayPathCandidate[],
    extensions: string[] = []
): Partial<ScriptBuilderFeature> {
    const normalizedExtensions = extensions.map((ext) => ext.replace(/^\./, '').toLowerCase()).filter(Boolean);
    const candidate: JsonArrayPathCandidate | undefined =
        candidates.find((item) =>
            item.path === 'files' ||
            normalizedExtensions.some((ext) => item.filterValues.type?.some((value) => value.toLowerCase() === ext))
        ) ?? candidates[0];
    if (!candidate) {
        return {
            linkedConfigArrayPath: '',
            linkedConfigTargetPath: '',
            linkedConfigFilterKey: '',
            linkedConfigFilterValue: '',
            linkedConfigValueKey: '',
            linkedConfigSelectedFields: [],
            linkedConfigFieldDefaults: {},
        };
    }
    const firstExample = candidate.examples[0]?.data ?? {};
    return {
        linkedConfigArrayPath: candidate.path,
        linkedConfigTargetPath: candidate.path,
        linkedConfigPathSegments: getPathSegments(candidate.path),
        linkedConfigKeyTemplate: inferKeyTemplateFromExample(candidate.examples[0]?.key),
        linkedConfigFilterKey: '',
        linkedConfigFilterValue: '',
        linkedConfigValueKey: candidate.valueKeys[0] ?? '',
        linkedConfigSelectedFields: candidate.fields,
        linkedConfigFieldDefaults: Object.fromEntries(candidate.fields.map((field) => [field, firstExample[field] ?? ''])),
    };
}

function getFileNameFromPath(value: string): string {
    return normalizePackPath(value).split('/').pop() ?? value;
}

function replaceLastPathPart(value: string, fileName: string): string {
    const normalized = normalizePackPath(value);
    const parts = normalized.split('/');
    parts[parts.length - 1] = fileName;
    return parts.join('/');
}

function normalizeLinkedConfigPath(value = ''): string {
    const trimmed = value.trim();
    if (!trimmed || trimmed === '$' || trimmed.toLowerCase() === 'root') return '$';
    return trimmed
        .replace(/\\/g, '/')
        .replace(/\./g, '/')
        .replace(/\/+/g, '/')
        .replace(/^\/+|\/+$/g, '');
}

function getLinkedConfigPathParts(value: string): string[] {
    const normalized = normalizeLinkedConfigPath(value);
    return normalized === '$' ? [] : normalized.split('/').filter(Boolean);
}

function getLinkedConfigPathLabel(value: string): string {
    const normalized = normalizeLinkedConfigPath(value);
    return normalized === '$' ? 'root' : normalized;
}

function getEditableLinkedConfigPath(value: string | undefined): string {
    return !value || value === '$' ? '' : getLinkedConfigPathLabel(value);
}

function findLinkedConfigCandidate(
    candidates: JsonArrayPathCandidate[] | undefined,
    pathValue: string | undefined
): JsonArrayPathCandidate | undefined {
    const normalized = normalizeLinkedConfigPath(pathValue || '$');
    return candidates?.find((item) => normalizeLinkedConfigPath(item.path) === normalized);
}

function getObjectAtPath(data: unknown, pathValue: string): Record<string, unknown> | null {
    const parts = getLinkedConfigPathParts(pathValue);
    if (parts.length === 0) {
        return data && typeof data === 'object' && !Array.isArray(data) ? data as Record<string, unknown> : null;
    }
    const value = parts.reduce<unknown>((acc, part) => {
        if (acc && typeof acc === 'object' && !Array.isArray(acc)) return (acc as Record<string, unknown>)[part];
        return undefined;
    }, data);
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function getObjectPathOptions(data: unknown, parentPath: string): Array<{ label: string; value: string }> {
    const target = getObjectAtPath(data, parentPath);
    if (!target) return [];
    return Object.entries(target)
        .filter(([, value]) => value && typeof value === 'object' && !Array.isArray(value))
        .map(([key]) => ({
            label: parentPath === '$' || parentPath === 'root' || parentPath === '' ? key : `${getLinkedConfigPathLabel(parentPath)}/${key}`,
            value: parentPath === '$' || parentPath === 'root' || parentPath === '' ? key : `${getLinkedConfigPathLabel(parentPath)}/${key}`,
        }));
}

function buildLinkedConfigCandidateFromObject(data: unknown, pathValue: string): JsonArrayPathCandidate | undefined {
    const target = getObjectAtPath(data, pathValue);
    if (!target) return undefined;
    const objectMapItems = Object.entries(target).filter(
        ([, child]) => child && typeof child === 'object' && !Array.isArray(child)
    ) as Array<[string, Record<string, unknown>]>;
    if (objectMapItems.length === 0) return undefined;
    const preferredFields = ['author', 'displayName', 'displayname', 'gender', 'lv', 'tags', 'description', 'bonus', 'amount'];
    const fields = [...new Set(objectMapItems.flatMap(([, child]) => Object.keys(child)))];
    const orderedFields = [
        ...preferredFields.filter((field) => fields.includes(field)),
        ...fields.filter((field) => !preferredFields.includes(field)),
    ];
    const filterValues: Record<string, string[]> = {};
    for (const [, child] of objectMapItems) {
        for (const [key, value] of Object.entries(child)) {
            if (!['string', 'number', 'boolean'].includes(typeof value)) continue;
            const text = String(value);
            filterValues[key] = filterValues[key] ?? [];
            if (!filterValues[key].includes(text)) filterValues[key].push(text);
        }
    }
    return {
        path: normalizeLinkedConfigPath(pathValue),
        itemType: 'objectMap',
        valueKeys: ['path', 'file', 'fileName', 'filename', 'name', 'id'],
        fields: orderedFields,
        filterValues,
        examples: objectMapItems.map(([key, child]) => ({ key, data: child })),
    };
}

function getPathSegments(pathValue: string): string[] {
    return getLinkedConfigPathParts(pathValue);
}

function inferKeyTemplateFromExample(exampleKey = ''): string {
    return exampleKey ? replaceLastPathPart(exampleKey, '$') : '$';
}

function applyKeyTemplate(template: string | undefined, fileName: string): string {
    const normalized = normalizePackPath(template || '$');
    return normalized.includes('$') ? normalized.replaceAll('$', fileName) : normalizePackPath(pathJoinPosix(normalized, fileName));
}

function pathJoinPosix(...parts: string[]): string {
    return parts.map((part) => normalizePackPath(part).replace(/^\/+|\/+$/g, '')).filter(Boolean).join('/');
}

function getLinkedConfigBasePath(linkedConfigPath = ''): string {
    const parts = normalizePackPath(linkedConfigPath).split('/').filter(Boolean);
    return parts[0]?.toLowerCase() === 'plugins' && parts.length >= 2 ? parts.slice(0, 2).join('/') : '';
}

function inferTargetDirFromLinkedConfig(
    linkedConfigPath: string | undefined,
    candidate: JsonArrayPathCandidate | undefined,
    extensions: string[] = [],
    filterKey = '',
    filterValue = ''
): string {
    if (!candidate) return '';
    const normalizedExtensions = extensions.map((ext) => ext.replace(/^\./, '').toLowerCase()).filter(Boolean);
    const example =
        candidate.examples.find((item) => filterKey && filterValue && String(item.data[filterKey] ?? '') === filterValue) ??
        candidate.examples.find((item) => normalizedExtensions.some((ext) => String(item.data.type ?? '').toLowerCase() === ext)) ??
        candidate.examples[0];
    if (!example?.key.includes('/')) return '';
    const base = getLinkedConfigBasePath(linkedConfigPath);
    const entryDir = example.key.split('/').slice(0, -1).join('/');
    return normalizePackPath(base ? `${base}/${entryDir}` : entryDir);
}

function getAutoPreviewFileName(feature: ScriptBuilderFeature, assetOptions: Array<{ value: string; extension: string }>): string {
    const allowedExtensions = (feature.extensions ?? []).map((ext) => ext.replace(/^\./, '').toLowerCase()).filter(Boolean);
    const matchingAsset = assetOptions.find((option) => allowedExtensions.length === 0 || allowedExtensions.includes(option.extension));
    if (matchingAsset) return getFileNameFromPath(matchingAsset.value);
    if (feature.linkedConfigAssetPath) return getFileNameFromPath(feature.linkedConfigAssetPath);
    return `test.${allowedExtensions[0] || 'png'}`;
}

function getLinkedConfigPreview(feature: ScriptBuilderFeature, assetOptions: Array<{ value: string; extension: string }> = []): LinkedConfigPreview | null {
    const candidate: JsonArrayPathCandidate | undefined = findLinkedConfigCandidate(
        feature.linkedConfigArrayCandidates,
        feature.linkedConfigTargetPath || feature.linkedConfigArrayPath
    ) ?? buildLinkedConfigCandidateFromObject(feature.linkedConfigData, feature.linkedConfigTargetPath || feature.linkedConfigArrayPath || '$');
    if (!candidate) return null;
    const filtered = candidate.examples.filter((example) => {
        if (!feature.linkedConfigFilterKey || !feature.linkedConfigFilterValue) return true;
        return String(example.data[feature.linkedConfigFilterKey] ?? '') === feature.linkedConfigFilterValue;
    });
    const example = filtered[0] ?? candidate.examples[0];
    if (!example) return null;
    const fileName = getAutoPreviewFileName(feature, assetOptions);
    return {
        candidate,
        example,
        targetPath: applyKeyTemplate(feature.linkedConfigKeyTemplate || inferKeyTemplateFromExample(example.key), fileName),
        fields: candidate.fields.filter((field) => field !== feature.linkedConfigFilterKey),
        filteredCount: filtered.length,
        fileName,
    };
}

function getLinkedConfigAssetOptions(
    feature: ScriptBuilderFeature,
    assetOptions: Array<{ value: string; extension: string }>
): Array<{ value: string; extension: string; fileName: string; key: string }> {
    const allowedExtensions = (feature.extensions ?? []).map((ext) => ext.replace(/^\./, '').toLowerCase()).filter(Boolean);
    return assetOptions
        .filter((option) => allowedExtensions.length === 0 || allowedExtensions.includes(option.extension))
        .map((option) => {
            const fileName = getFileNameFromPath(option.value);
            return {
                ...option,
                fileName,
                key: applyKeyTemplate(feature.linkedConfigKeyTemplate || '$', fileName),
            };
        });
}

function getLinkedConfigRegistryEntries(feature: ScriptBuilderFeature): Array<{ key: string; data: Record<string, unknown> }> {
    const target = getObjectAtPath(feature.linkedConfigData, feature.linkedConfigTargetPath || feature.linkedConfigArrayPath || '$');
    if (!target) return [];
    return Object.entries(target)
        .filter(([, value]) => value && typeof value === 'object' && !Array.isArray(value))
        .map(([key, data]) => ({ key, data: data as Record<string, unknown> }))
        .filter(({ data }) => {
            if (!feature.linkedConfigFilterKey || !feature.linkedConfigFilterValue) return true;
            return String(data[feature.linkedConfigFilterKey] ?? '') === feature.linkedConfigFilterValue;
        });
}

function getLinkedConfigReconcilePlan(
    feature: ScriptBuilderFeature,
    assetOptions: Array<{ value: string; extension: string }>
): LinkedConfigReconcilePlan | null {
    if (!feature.linkedConfigPath || !feature.linkedConfigKeyTemplate) return null;
    const registryEntries = getLinkedConfigRegistryEntries(feature);
    const assets = getLinkedConfigAssetOptions(feature, assetOptions);
    const registryKeys = new Set(registryEntries.map((entry) => entry.key));
    const assetKeys = new Set(assets.map((asset) => asset.key));
    return {
        registryCount: registryEntries.length,
        assetCount: assets.length,
        removeCandidates: registryEntries
            .filter((entry) => !assetKeys.has(entry.key))
            .map((entry) => ({ key: entry.key })),
        addCandidates: assets
            .filter((asset) => !registryKeys.has(asset.key))
            .map((asset) => ({
                key: asset.key,
                fileName: asset.fileName,
                assetPath: asset.value,
            })),
    };
}

function normalizeDefaultValue(value: unknown, templateValue: unknown): unknown {
    if (Array.isArray(templateValue)) {
        if (Array.isArray(value)) return value;
        return String(value ?? '')
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean);
    }
    if (typeof templateValue === 'number') {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : templateValue;
    }
    if (typeof templateValue === 'boolean') {
        if (typeof value === 'boolean') return value;
        if (String(value).toLowerCase() === 'true') return true;
        if (String(value).toLowerCase() === 'false') return false;
        return templateValue;
    }
    return value ?? templateValue ?? '';
}

function buildLinkedConfigAddValue(
    feature: ScriptBuilderFeature,
    preview: LinkedConfigPreview | null,
    overrides?: Record<string, unknown>
): Record<string, unknown> {
    const template = preview?.example.data ?? {};
    const fields = preview?.candidate.fields ?? Object.keys(feature.linkedConfigFieldDefaults ?? {});
    const value: Record<string, unknown> = { ...template, ...(overrides ?? {}) };
    for (const field of fields) {
        const overrideValue = overrides && Object.prototype.hasOwnProperty.call(overrides, field)
            ? overrides[field]
            : undefined;
        value[field] = normalizeDefaultValue(
            overrideValue ?? feature.linkedConfigFieldDefaults?.[field] ?? template[field] ?? '',
            template[field]
        );
    }
    if (feature.linkedConfigFilterKey && feature.linkedConfigFilterValue) {
        value[feature.linkedConfigFilterKey] = feature.linkedConfigFilterValue;
    }
    return value;
}

function getLinkedConfigAddFields(feature: ScriptBuilderFeature, preview: LinkedConfigPreview | null, values?: Record<string, unknown>): string[] {
    const preferred = preview?.candidate.fields ?? Object.keys(feature.linkedConfigFieldDefaults ?? {});
    return [...new Set([...preferred, ...Object.keys(values ?? {})])];
}

function getLinkedConfigFieldTemplateValue(feature: ScriptBuilderFeature, preview: LinkedConfigPreview | null, field: string): unknown {
    return preview?.example.data[field] ?? feature.linkedConfigFieldDefaults?.[field] ?? '';
}

function formatLinkedConfigFieldValue(value: unknown): string {
    if (Array.isArray(value)) return value.join(', ');
    return String(value ?? '');
}

function applyLinkedConfigReconcile(
    feature: ScriptBuilderFeature,
    assetOptions: Array<{ value: string; extension: string }>
): { text: string; data: unknown; candidates: JsonArrayPathCandidate[] } | null {
    const data = parseJsonText<Record<string, unknown>>(feature.linkedConfigText ?? feature.linkedConfigPreviewText ?? '', {});
    if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
    const targetPath = feature.linkedConfigTargetPath || feature.linkedConfigArrayPath || '$';
    const parts = getLinkedConfigPathParts(targetPath);
    let target: Record<string, unknown> = data;
    for (const part of parts) {
        const current = target[part];
        if (!current || typeof current !== 'object' || Array.isArray(current)) target[part] = {};
        target = target[part] as Record<string, unknown>;
    }
    const plan = getLinkedConfigReconcilePlan(feature, assetOptions);
    if (!plan) return null;
    const removeKeys = new Set(feature.linkedConfigReconcileRemoveKeys ?? plan.removeCandidates.map((item) => item.key));
    const addKeys = new Set(feature.linkedConfigReconcileAddKeys ?? []);
    const preview = getLinkedConfigPreview(feature, assetOptions);
    for (const key of removeKeys) delete target[key];
    for (const item of plan.addCandidates) {
        if (!addKeys.has(item.key)) continue;
        target[item.key] = buildLinkedConfigAddValue(feature, preview, feature.linkedConfigReconcileAddValues?.[item.key]);
    }
    const text = JSON.stringify(data, null, 2);
    return {
        text,
        data,
        candidates: inferLinkedConfigArrayCandidates(text),
    };
}

function buildSettingsScript(features: ScriptBuilderFeature[]) {
    return {
        type: 'configurator' as const,
        version: 1,
        features: features.map(({
            sampleText,
            cfgText,
            collapsed,
            linkedConfigContentCollapsed,
            linkedConfigSourceId,
            linkedConfigSourceEntryName,
            linkedConfigText,
            linkedConfigPreviewText,
            linkedConfigArrayCandidates,
            linkedConfigData,
            linkedConfigReconcileRemoveKeys,
            linkedConfigReconcileAddKeys,
            linkedConfigReconcileAddValues,
            ...feature
        }) => ({
            ...feature,
            sample: feature.type === 'json_manager' ? parseJsonText(sampleText, {}) : undefined,
        })),
    };
}

function getFeatureScriptJson(feature: ScriptBuilderFeature): string {
    try {
        return JSON.stringify(buildSettingsScript([feature]), null, 2);
    } catch {
        return '';
    }
}

function releaseNativeDialogFocus() {
    const recover = () => {
        const active = document.activeElement;
        const isEditable =
            active instanceof HTMLInputElement ||
            active instanceof HTMLTextAreaElement ||
            (active instanceof HTMLElement && active.isContentEditable);
        if (!isEditable && active instanceof HTMLElement) active.blur();
        window.focus();
    };

    window.setTimeout(recover, 0);
    window.requestAnimationFrame(() => {
        recover();
        window.setTimeout(recover, 50);
        window.setTimeout(recover, 150);
    });
}

function normalizePackPath(value: string): string {
    return value.replaceAll('\\', '/').replace(/^\/+/, '').replace(/\/+/g, '/');
}

function isBepInExRootedPackPath(value: string): boolean {
    const top = normalizePackPath(value).split('/')[0]?.toLowerCase();
    return top === 'plugins' || top === 'config' || top === 'patchers';
}

function getDependentInstallPreviewPath(installBase: string, entryName: string): string {
    const normalizedEntry = normalizePackPath(entryName).replace(/\/+$/, '');
    const normalizedBase = normalizePackPath(installBase).replace(/\/+$/, '');
    if (!normalizedBase || isBepInExRootedPackPath(normalizedEntry)) return normalizedEntry;
    return normalizePackPath(`${normalizedBase}/${normalizedEntry}`);
}

function getDependentLinkedConfigPath(installBase: string, entryName: string): string {
    return getDependentInstallPreviewPath(installBase, entryName);
}

function isGeneratedModInfoPath(value: string): boolean {
    const base = normalizePackPath(value).split('/').pop()?.toLowerCase();
    return base === 'mod-info.json' || base === 'hexx-mod-info.json';
}

function withPluginsPrefix(value: string): string {
    const normalized = normalizePackPath(value);
    return normalized.toLowerCase().startsWith('plugins/') ? normalized : `plugins/${normalized}`;
}

function normalizedPackEntryPath(entry: ZipEditableEntry): string {
    return normalizePackPath(entry.entryName).toLowerCase();
}

function findDuplicateEntryPaths(sources: PackSourceEntry[]): string[] {
    const seen = new Set<string>();
    const duplicates = new Set<string>();
    for (const source of sources) {
        for (const entry of source.entries) {
            if (isGeneratedModInfoPath(entry.entryName)) continue;
            const key = normalizedPackEntryPath(entry);
            if (!key) continue;
            if (seen.has(key)) duplicates.add(key);
            else seen.add(key);
        }
    }
    return [...duplicates];
}

function getPackEntryDisabledTypes(entry: ZipEditableEntry): ModFileType[] {
    const disabled: ModFileType[] = [];
    if (!entry.entryName.toLowerCase().endsWith('.dll')) disabled.push('dll');
    if (!entry.isDirectory) disabled.push('folder');
    return disabled;
}

// ── Pack Mod Dialog ────────────────────────────────────────────────

function PackModDialog({
    open,
    onClose,
    onPacked,
    packages = [],
}: {
    open: boolean;
    onClose: () => void;
    onPacked: (pkgs: ModPackage[], name: string) => void;
    packages?: ModPackage[];
}) {
    const [packageType, setPackageType] = useState<'single' | 'collection'>('single');
    const [name, setName] = useState('');
    const [author, setAuthor] = useState('');
    const [description, setDescription] = useState('');
    const [version, setVersion] = useState('1.0.0');
    const [dependencyEnabled, setDependencyEnabled] = useState(false);
    const [dependencyTarget, setDependencyTarget] = useState('');
    const [dependencyDisplayName, setDependencyDisplayName] = useState('');
    const [dependencyInstallBase, setDependencyInstallBase] = useState('');
    const [updatePolicyMode, setUpdatePolicyMode] = useState<ModUpdatePolicy['mode']>('replace-confirm');
    const [updatePolicyPreserveText, setUpdatePolicyPreserveText] = useState('');
    const [updatePolicyRemoveMissing, setUpdatePolicyRemoveMissing] = useState(false);
    const [packStep, setPackStep] = useState<1 | 2 | 3>(1);
    const [helpOpen, setHelpOpen] = useState(false);
    const [guideText, setGuideText] = useState('');
    const [sources, setSources] = useState<PackSourceEntry[]>([]);
    const [savePath, setSavePath] = useState('');
    const [packing, setPacking] = useState(false);
    const [error, setError] = useState('');
    const [loadingZip, setLoadingZip] = useState(false);
    const [scriptFeatures, setScriptFeatures] = useState<ScriptBuilderFeature[]>([]);
    const [scriptJsonText, setScriptJsonText] = useState('');
    const [scriptJsonDirty, setScriptJsonDirty] = useState(false);
    const sourceCount = sources.length;
    const canLeaveBasicInfo = name.trim() !== '' && author.trim() !== '' && description.trim() !== '';
    const totalDllEntries = sources.reduce(
        (count, source) => count + source.entries.filter((entry) => entry.selectedType === 'dll').length,
        0
    );
    const isForcedCollection =
        sources.length > 1 ||
        sources.filter((source) => source.sourceKind === 'dll').length > 1 ||
        sources.filter((source) => source.sourceKind === 'zip').length > 1 ||
        totalDllEntries > 1;
    const hasMixedZip = sources.some(
        (source) =>
            source.sourceKind === 'zip' &&
            source.entries.filter((entry) => entry.selectedType === 'dll').length > 1 &&
            source.entries.some((entry) => entry.selectedType === 'asset')
    );
    const dependencyInstallPathHints = getDependencyInstallPathHints(packages, dependencyTarget);

    const reset = () => {
        setPackageType('single');
        setName('');
        setAuthor('');
        setDescription('');
        setVersion('1.0.0');
        setDependencyEnabled(false);
        setDependencyTarget('');
        setDependencyDisplayName('');
        setDependencyInstallBase('');
        setUpdatePolicyMode('replace-confirm');
        setUpdatePolicyPreserveText('');
        setUpdatePolicyRemoveMissing(false);
        setPackStep(1);
        setHelpOpen(false);
        setSources([]);
        setSavePath('');
        setError('');
        setLoadingZip(false);
        setScriptFeatures([]);
        setScriptJsonText('');
        setScriptJsonDirty(false);
    };

    useEffect(() => {
        if (isForcedCollection && packageType !== 'collection') {
            setPackageType('collection');
        }
    }, [isForcedCollection, packageType]);

    const handleClose = () => {
        reset();
        onClose();
    };

    useEffect(() => {
        if (scriptJsonDirty) return;
        if (scriptFeatures.length === 0) {
            setScriptJsonText('');
            return;
        }
        try {
            setScriptJsonText(JSON.stringify(buildSettingsScript(scriptFeatures), null, 2));
        } catch {
            setScriptJsonText('');
        }
    }, [scriptFeatures, scriptJsonDirty]);

    const openGuide = async () => {
        setHelpOpen(true);
        if (guideText) return;
        try {
            setGuideText(await window.electronAPI.getModPackGuide());
        } catch (err) {
            setGuideText(err instanceof Error ? err.message : '모드 패킹 설명서를 불러오지 못했습니다.');
        }
    };

    const validateNextSources = (next: PackSourceEntry[]): boolean => {
        const duplicates = findDuplicateEntryPaths(next);
        if (duplicates.length > 0) {
            setError(`중복 경로가 있습니다: ${duplicates.join(', ')}`);
            return false;
        }
        return true;
    };

    const goToStep = (step: 1 | 2 | 3) => {
        if (step > 1 && !canLeaveBasicInfo) {
            setError('패키지 이름, 제작자, 설명을 모두 입력해주세요.');
            return;
        }
        setError('');
        setPackStep(step);
    };

    const handleAddFile = async () => {
        setError('');
        const selected = await window.electronAPI.selectModImportFile();
        releaseNativeDialogFocus();
        if (!selected) return;
        const fileName = selected.split(/[\\/]/).pop() ?? '';
        const baseName = fileName.replace(/\.(dll|zip)$/i, '');
        const selectedKey = selected.toLowerCase();
        if (sources.some((source) => source.sourcePath.toLowerCase() === selectedKey)) {
            setError(`이미 추가된 파일입니다: ${fileName}`);
            return;
        }

        if (selected.toLowerCase().endsWith('.zip')) {
            setLoadingZip(true);
            try {
                const result: ZipInspectResult = await window.electronAPI.inspectZip(selected);
                const rootDlls = result.entries.filter(
                    (entry) =>
                        !entry.isDirectory &&
                        entry.suggestedType === 'dll' &&
                        !normalizePackPath(entry.entryName).includes('/')
                );
                const shouldPrefixPlugins =
                    rootDlls.length > 0 &&
                    window.confirm(
                        'DLL이 루트에 있습니다. 이 경우 BepInEx폴더에 DLL파일이 위치하게 됩니다. zip파일이 plugins폴더 기준으로 생성되었을 수 있습니다. 기준을 변경하시겠습니까?'
                    );
                const editable: ZipEditableEntry[] = result.entries.map((entry) => ({
                    ...entry,
                    sourceEntryName: normalizePackPath(entry.entryName),
                    entryName:
                        shouldPrefixPlugins && !isGeneratedModInfoPath(entry.entryName)
                            ? withPluginsPrefix(entry.entryName)
                            : normalizePackPath(entry.entryName),
                    mismatch:
                        entry.mismatch ??
                        (!result.hasModInfo && !entry.isDirectory && !isGeneratedModInfoPath(entry.entryName)
                            ? 'missing_in_modinfo'
                            : undefined),
                    selectedType: entry.suggestedType,
                    editName: entry.modInfoData?.name ?? '',
                    editAuthor: entry.modInfoData?.author ?? result.modInfo?.author ?? author,
                    editDependsOn: entry.modInfoData?.dependsOn ?? '',
                }));
                const inferredType =
                    result.modInfo?.packageType ??
                    (editable.filter((entry) => entry.selectedType === 'dll').length > 1
                        ? 'collection'
                        : 'single');

                setSources((prev) => {
                    const next: PackSourceEntry[] = [
                        ...prev,
                        {
                            id: `${Date.now()}-${prev.length}`,
                            sourcePath: selected,
                            sourceKind: 'zip',
                            sourceName: fileName,
                            packageName: result.modInfo?.name || baseName,
                            author: result.modInfo?.author || author,
                            description: result.modInfo?.description || '',
                            packageType: inferredType,
                            entries: editable,
                            warnings: result.warnings,
                        },
                    ];
                    if (!validateNextSources(next)) return prev;
                    if (next.length > 1) setPackageType('collection');
                    return next;
                });
                if (sourceCount === 0 && inferredType === 'collection') setPackageType('collection');
                if (!name) setName(result.modInfo?.name || baseName);
                if (!author && result.modInfo?.author) setAuthor(result.modInfo.author);
                if (!description && result.modInfo?.description) setDescription(result.modInfo.description);
                if (result.modInfo?.version) setVersion(result.modInfo.version);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'ZIP inspect failed');
            } finally {
                setLoadingZip(false);
            }
            return;
        }

        if (selected.toLowerCase().endsWith('.md') || selected.toLowerCase().endsWith('.markdown')) {
            setSources((prev) => {
                const next: PackSourceEntry[] = [
                    ...prev,
                    {
                        id: `${Date.now()}-${prev.length}`,
                        sourcePath: selected,
                        sourceKind: 'file',
                        sourceName: fileName,
                        packageName: baseName,
                        author,
                        description: '',
                        packageType: 'single',
                        warnings: [],
                        entries: [
                            {
                                entryName: fileName,
                                sourceEntryName: fileName,
                                isDirectory: false,
                                size: 0,
                                suggestedType: 'readme',
                                fromModInfo: false,
                                selectedType: 'readme',
                                editName: baseName,
                                editAuthor: author,
                                editDependsOn: '',
                            },
                        ],
                    },
                ];
                if (!validateNextSources(next)) return prev;
                if (next.length > 1) setPackageType('collection');
                return next;
            });
            return;
        }

        setSources((prev) => {
            const next: PackSourceEntry[] = [
                ...prev,
                {
                    id: `${Date.now()}-${prev.length}`,
                    sourcePath: selected,
                    sourceKind: 'dll',
                            sourceName: fileName,
                            packageName: baseName,
                            author,
                            description: '',
                    packageType: 'single',
                    warnings: [],
                    entries: [
                        {
                            entryName: `plugins/${fileName}`,
                            sourceEntryName: fileName,
                            isDirectory: false,
                            size: 0,
                            suggestedType: 'dll',
                            fromModInfo: false,
                            selectedType: 'dll',
                            editName: baseName,
                            editAuthor: '',
                            editDependsOn: '',
                        },
                    ],
                },
            ];
            if (!validateNextSources(next)) return prev;
            if (next.length > 1) setPackageType('collection');
            return next;
        });
        if (!name) setName(baseName);
    };

    const updateSource = (sourceId: string, patch: Partial<PackSourceEntry>) => {
        setSources((prev) =>
            prev.map((source) => (source.id === sourceId ? { ...source, ...patch } : source))
        );
    };

    const updateSourceEntry = (sourceId: string, idx: number, patch: Partial<ZipEditableEntry>) => {
        setSources((prev) =>
            prev.map((source) =>
                source.id === sourceId
                    ? {
                          ...source,
                          entries: source.entries.map((entry, entryIdx) =>
                              entryIdx === idx ? { ...entry, ...patch } : entry
                          ),
                      }
                    : source
            )
        );
    };

    const deleteSourceEntry = (sourceId: string, idx: number) => {
        setSources((prev) =>
            prev.map((source) =>
                source.id === sourceId
                    ? { ...source, entries: source.entries.filter((_, entryIdx) => entryIdx !== idx) }
                    : source
            )
        );
    };

    const deleteSource = (sourceId: string) => {
        setSources((prev) => {
            const next = prev.filter((source) => source.id !== sourceId);
            if (next.length <= 1) setPackageType('single');
            return next;
        });
    };

    const addScriptFeature = (type: ScriptBuilderFeature['type']) => {
        const id = `${type}_${Date.now()}`;
        const base = { id, type, collapsed: true, name: type === 'file_manager' ? '어셋파일관리' : type === 'json_manager' ? 'JSON 관리' : 'CFG 설정' };
        const feature: ScriptBuilderFeature =
            type === 'file_manager'
                ? { ...base, targetDir: 'plugins', extensions: ['png'], fields: [] }
                : type === 'json_manager'
                  ? { ...base, jsonPath: 'plugins/config.json', sampleText: '{\n  \"enabled\": true\n}', fields: [] }
                  : { ...base, cfgPath: 'config/config.cfg', cfgText: '', fields: [] };
        setScriptFeatures((prev) => [...prev, feature]);
        setScriptJsonDirty(false);
    };

    const updateScriptFeature = (featureId: string, patch: Partial<ScriptBuilderFeature>) => {
        setScriptFeatures((prev) => prev.map((feature) => (feature.id === featureId ? { ...feature, ...patch } : feature)));
        setScriptJsonDirty(false);
    };

    const updateLinkedConfigSourceOverride = (feature: ScriptBuilderFeature, text: string) => {
        if (!feature.linkedConfigSourceId || !feature.linkedConfigPath) return;
        setSources((prev) =>
            prev.map((source) =>
                source.id !== feature.linkedConfigSourceId
                    ? source
                    : {
                          ...source,
                          entries: source.entries.map((entry) =>
                              entry.entryName === feature.linkedConfigPath ||
                              (feature.linkedConfigSourceEntryName && entry.sourceEntryName === feature.linkedConfigSourceEntryName)
                                  ? { ...entry, contentTextOverride: text }
                                  : entry
                          ),
                      }
            )
        );
    };

    const jsonEntryOptions = sources.flatMap((source) =>
        source.entries
            .filter((entry) => !entry.isDirectory && entry.entryName.toLowerCase().endsWith('.json') && !isGeneratedModInfoPath(entry.entryName))
            .map((entry) => ({
                value: `${source.id}::${entry.sourceEntryName ?? entry.entryName}::${entry.entryName}`,
                label: `${source.sourceName} / ${entry.entryName}`,
                sourceId: source.id,
                sourcePath: source.sourcePath,
                entryName: entry.entryName,
                sourceEntryName: entry.sourceEntryName ?? entry.entryName,
                contentTextOverride: entry.contentTextOverride,
            }))
    );
    const assetEntryOptions = sources.flatMap((source) =>
        source.entries
            .filter((entry) => !entry.isDirectory && entry.selectedType === 'asset')
            .map((entry) => ({
                value: entry.entryName,
                label: `${source.sourceName} / ${entry.entryName}`,
                extension: getFileNameFromPath(entry.entryName).split('.').pop()?.toLowerCase() ?? '',
            }))
    );

    const handleSelectLinkedConfig = async (featureId: string, value: string) => {
        const option = jsonEntryOptions.find((item) => item.value === value);
        if (!option) return;
        try {
            const linkedConfigPath =
                dependencyEnabled && normalizePackPath(dependencyInstallBase).trim()
                    ? getDependentLinkedConfigPath(dependencyInstallBase, option.entryName)
                    : option.entryName;
            const text = option.contentTextOverride ?? await window.electronAPI.readZipEntryText(option.sourcePath, option.sourceEntryName);
            const candidates = inferLinkedConfigArrayCandidates(text);
            const linkedConfigData = parseJsonText<unknown>(text, null);
            const defaultPatch = getDefaultLinkedConfigPatch(candidates, scriptFeatures.find((feature) => feature.id === featureId)?.extensions);
            const currentFeature = scriptFeatures.find((feature) => feature.id === featureId);
            const defaultCandidate = findLinkedConfigCandidate(candidates, defaultPatch.linkedConfigTargetPath);
            const inferredTargetDir = inferTargetDirFromLinkedConfig(
                linkedConfigPath,
                defaultCandidate,
                currentFeature?.extensions
            );
            updateScriptFeature(featureId, {
                linkedConfigPath,
                linkedConfigSourceId: option.sourceId,
                linkedConfigSourceEntryName: option.sourceEntryName,
                linkedConfigText: text,
                linkedConfigPreviewText: text,
                linkedConfigContentCollapsed: true,
                linkedConfigArrayCandidates: candidates,
                linkedConfigData,
                ...(currentFeature?.targetDir && currentFeature.targetDir !== 'plugins'
                    ? {}
                    : inferredTargetDir
                      ? { targetDir: inferredTargetDir }
                      : {}),
                ...defaultPatch,
            });
            releaseNativeDialogFocus();
        } catch (err) {
            setError(err instanceof Error ? err.message : '연동 설정 JSON을 읽지 못했습니다.');
        }
    };

    const handleLinkedConfigTextChange = (feature: ScriptBuilderFeature, text: string) => {
        const candidates = inferLinkedConfigArrayCandidates(text);
        const linkedConfigData = parseJsonText<unknown>(text, null);
        const selectedCandidate =
            findLinkedConfigCandidate(candidates, feature.linkedConfigTargetPath || feature.linkedConfigArrayPath) ?? candidates[0];
        const defaultPatch = getDefaultLinkedConfigPatch(candidates, feature.extensions);
        const nextValueKey =
            selectedCandidate?.valueKeys.includes(feature.linkedConfigValueKey || '')
                ? feature.linkedConfigValueKey
                : selectedCandidate?.valueKeys[0] ?? '';
        updateScriptFeature(feature.id, {
            linkedConfigText: text,
            linkedConfigPreviewText: text,
            linkedConfigArrayCandidates: candidates,
            linkedConfigData,
            linkedConfigArrayPath: feature.linkedConfigArrayPath || defaultPatch.linkedConfigArrayPath || '',
            linkedConfigTargetPath: feature.linkedConfigTargetPath || defaultPatch.linkedConfigTargetPath || '',
            linkedConfigFilterKey: feature.linkedConfigFilterKey || defaultPatch.linkedConfigFilterKey || '',
            linkedConfigFilterValue: feature.linkedConfigFilterValue || defaultPatch.linkedConfigFilterValue || '',
            linkedConfigValueKey: nextValueKey,
            linkedConfigSelectedFields: feature.linkedConfigSelectedFields?.length
                ? feature.linkedConfigSelectedFields
                : defaultPatch.linkedConfigSelectedFields,
        });
        updateLinkedConfigSourceOverride(feature, text);
    };

    const handleApplyLinkedConfigReconcile = (feature: ScriptBuilderFeature) => {
        const result = applyLinkedConfigReconcile(feature, assetEntryOptions);
        if (!result) {
            setError('연동 JSON 정리를 적용할 수 없습니다. JSON 내용과 대상 path를 확인해주세요.');
            return;
        }
        updateScriptFeature(feature.id, {
            linkedConfigText: result.text,
            linkedConfigPreviewText: result.text,
            linkedConfigData: result.data,
            linkedConfigArrayCandidates: result.candidates,
            linkedConfigReconcileRemoveKeys: [],
            linkedConfigReconcileAddKeys: [],
            linkedConfigReconcileAddValues: {},
        });
        updateLinkedConfigSourceOverride(feature, result.text);
    };

    const regenerateFeatureFields = (feature: ScriptBuilderFeature) => {
        if (feature.type === 'cfg_fields') {
            updateScriptFeature(feature.id, { fields: parseCfgFields(feature.cfgPath || '', feature.cfgText || '') });
        }
        if (feature.type === 'json_manager') {
            updateScriptFeature(feature.id, { fields: inferJsonFields(feature.sampleText || '{}') });
        }
    };

    const handleSelectSavePath = async () => {
        const selected = await window.electronAPI.selectSavePath(name || 'mod');
        if (selected) setSavePath(selected);
        releaseNativeDialogFocus();
    };

    const buildPackUpdatePolicy = (): ModUpdatePolicy => ({
        mode: updatePolicyMode,
        preserve: updatePolicyPreserveText
            .split(/\r?\n|,/)
            .map((item) => normalizePackPath(item.trim()).replace(/\/+$/, ''))
            .filter(Boolean),
        removeMissing: updatePolicyRemoveMissing,
    });

    const handlePack = async () => {
        if (!canLeaveBasicInfo) { setError('패키지 이름, 제작자, 설명을 모두 입력해주세요.'); return; }
        if (sources.length === 0) { setError('Add at least one DLL or ZIP file.'); return; }
        if (dependencyEnabled && !dependencyTarget.trim()) { setError('종속 모드의 메인 모드를 선택하거나 식별자를 입력해 주세요.'); return; }
        if (!savePath) { setError('저장 경로를 선택해주세요.'); return; }
        if (dependencyEnabled && (dependencyInstallBase.includes('..') || /^[a-zA-Z]:/.test(dependencyInstallBase))) { setError('종속 모드 설치 경로는 BepInEx 기준 상대 경로만 허용합니다.'); return; }
        const duplicates = findDuplicateEntryPaths(sources);
        if (duplicates.length > 0) { setError(`중복 경로가 있습니다: ${duplicates.join(', ')}`); return; }
        setPacking(true);
        setError('');
        try {
            const settingsScript =
                scriptJsonText.trim()
                    ? JSON.parse(stripJsonBom(scriptJsonText))
                    : scriptFeatures.length > 0
                      ? buildSettingsScript(scriptFeatures)
                      : null;
            const dependency: PackageDependency | undefined = dependencyEnabled
                ? {
                      target: dependencyTarget.trim(),
                      displayName: dependencyDisplayName.trim() || undefined,
                      installBase: normalizePackPath(dependencyInstallBase.trim()).replace(/\/+$/, '') || undefined,
                  }
                : undefined;
            const result = await window.electronAPI.packMod({
                name: name || sources[0]?.packageName || '알 수 없음',
                author,
                description,
                packageType,
                version: version.trim() || undefined,
                dependency,
                updatePolicy: buildPackUpdatePolicy(),
                files: [],
                settingsScript,
                sources: sources.map((source) => ({
                    sourcePath: source.sourcePath,
                    sourceKind: source.sourceKind,
                    name: source.packageName,
                    author: source.author,
                    description: source.description,
                    packageType: source.packageType,
                    files: source.entries.map((entry) => ({
                        entryName: entry.entryName,
                        type: entry.selectedType,
                        name: entry.editName || undefined,
                        author: entry.editAuthor || undefined,
                        dependsOn: entry.editDependsOn || undefined,
                        contentTextOverride: entry.contentTextOverride,
                    })),
                })),
                savePath,
            });
            onPacked(result as ModPackage[], name || sources[0]?.packageName || '모드');
            handleClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : '패킹 실패');
        } finally {
            setPacking(false);
        }
    };

    const renderPreviewField = (field: ScriptField) => {
        if (field.ui_type === 'switch') {
            return (
                <FormControlLabel
                    key={field.id}
                    control={<Switch size="small" checked={String(field.default ?? field.value ?? 'false').toLowerCase() === 'true'} disabled />}
                    label={<Typography sx={{ color: 'var(--text-color)', fontSize: 13 }}>{field.label}</Typography>}
                />
            );
        }
        if (field.ui_type === 'select') {
            return (
                <Box key={field.id}>
                    <Typography sx={{ color: 'var(--text-color-light)', fontSize: 12 }}>{field.label}</Typography>
                    <Select size="small" value={String(field.default ?? field.value ?? '')} disabled sx={{ ...selectSx, minWidth: 180 }}>
                        {(field.options ?? []).map((option) => (
                            <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
                        ))}
                    </Select>
                </Box>
            );
        }
        return (
            <TextField
                key={field.id}
                size="small"
                label={field.label}
                value={String(field.default ?? field.value ?? '')}
                disabled
                sx={inputSx}
            />
        );
    };

    const renderSettingsPreview = (features: ScriptBuilderFeature[] = scriptFeatures) => {
        if (features.length === 0) return null;
        return (
            <Box sx={{ mt: 1, p: 1, border: '1px solid var(--border-color)', borderRadius: 1, background: 'var(--input-bg-color)' }}>
                <Typography sx={{ color: 'var(--text-color)', fontWeight: 800, mb: 1 }}>
                    설정 UI 미리보기
                </Typography>
                <Stack spacing={1}>
                    {features.map((feature) => (
                        <Box key={feature.id} sx={{ p: 1, border: '1px solid var(--border-color)', borderRadius: 1 }}>
                            <Typography sx={{ color: 'var(--primary-color)', fontWeight: 700, mb: 1 }}>
                                {feature.name}
                            </Typography>
                            {feature.type === 'file_manager' ? (
                                <Stack spacing={0.75}>
                                    <Typography sx={{ color: 'var(--text-color-light)', fontSize: 12 }}>
                                        대상 폴더: {feature.targetDir || '-'} / 확장자: {(feature.extensions ?? []).join(', ') || '-'}
                                    </Typography>
                                    <Button size="small" variant="outlined" disabled sx={{ alignSelf: 'flex-start' }}>
                                        파일 추가
                                    </Button>
                                    <Typography sx={{ color: 'var(--text-color-light)', fontSize: 12 }}>
                                        관리 파일 예시: example.{(feature.extensions ?? ['png'])[0]}
                                    </Typography>
                                    {feature.linkedConfigPath && (
                                        <Alert severity="info" sx={{ '& .MuiAlert-message': { fontSize: 12 } }}>
                                            파일 추가/삭제 시 {feature.linkedConfigPath}의 {feature.linkedConfigArrayPath || '(배열 path 미지정)'} 배열에 파일명이 반영됩니다.
                                        </Alert>
                                    )}
                                </Stack>
                            ) : (
                                <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', rowGap: 1 }}>
                                    {(feature.fields ?? []).map((field) => renderPreviewField(field))}
                                    {(feature.fields ?? []).length === 0 && (
                                        <Typography sx={{ color: 'var(--text-color-light)', fontSize: 12 }}>
                                            자동 생성된 필드가 없습니다.
                                        </Typography>
                                    )}
                                </Stack>
                            )}
                        </Box>
                    ))}
                </Stack>
            </Box>
        );
    };

    return (
        <>
        <Dialog
            open={open}
            onClose={handleClose}
            maxWidth={false}
            fullWidth
            disableEnforceFocus
            disableRestoreFocus
            slotProps={{
                paper: {
                    sx: {
                        ...dialogPaperSx,
                        width: 'calc(100vw - var(--sidebar-width, 240px) - 48px)',
                        maxWidth: 'none',
                        height: '86vh',
                        maxHeight: '86vh',
                    },
                },
            }}
        >
            <DialogTitle
                sx={{
                    color: 'var(--text-color)',
                    borderBottom: '1px solid var(--border-color)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 1,
                }}
            >
                <span>모드 패킹</span>
                <IconButton size="small" onClick={openGuide} sx={{ color: 'var(--text-color-light)' }}>
                    <HelpIcon fontSize="small" />
                </IconButton>
            </DialogTitle>
            <DialogContent sx={{ pt: 2 }}>
                <Stack spacing={2}>
                    {error && <Alert severity="error">{error}</Alert>}

                    <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap', pt: 1 }}>
                        {([1, 2, 3] as const).map((step) => (
                            <Chip
                                key={step}
                                label={
                                    step === 1
                                        ? '1. 기본 정보'
                                        : step === 2
                                          ? '2. 파일 추가'
                                          : '3. 설정 Script'
                                }
                                clickable={step === 1 || canLeaveBasicInfo}
                                disabled={step > 1 && !canLeaveBasicInfo}
                                onClick={() => goToStep(step)}
                                sx={{
                                    background: packStep === step ? 'var(--primary-color)' : 'transparent',
                                    color: packStep === step ? '#fff' : 'var(--text-color)',
                                    border: '1px solid var(--border-color)',
                                }}
                            />
                        ))}
                    </Stack>

                    {packStep === 2 && (
                    <>
                    <Button
                        variant="outlined"
                        startIcon={loadingZip ? <CircularProgress size={16} /> : <UploadFileIcon />}
                        onClick={handleAddFile}
                        disabled={packing || loadingZip}
                        sx={{ borderColor: 'var(--border-color)', color: 'var(--text-color)', alignSelf: 'flex-start' }}
                    >
                        파일 추가 (DLL / ZIP / MD)
                    </Button>

                    {hasMixedZip && (
                        <Alert severity="warning" icon={<WarningAmberIcon />}>
                            여러 DLL과 asset이 섞인 ZIP입니다. 권장하지 않는 구성이라, 아래 Depends On에서 asset이 어떤 DLL에 종속되는지 지정해주세요.
                        </Alert>
                    )}

                    {dependencyEnabled && dependencyInstallBase && sources.length > 0 && (
                        <Alert severity="info">
                            종속 모드 에셋 설치 기준: {normalizePackPath(dependencyInstallBase).replace(/\/+$/, '')}
                            {sources
                                .flatMap((source) => source.entries)
                                .filter((entry) => entry.selectedType === 'asset' || entry.selectedType === 'folder')
                                .slice(0, 3)
                                .map((entry) => ` / ${entry.entryName} -> ${getDependentInstallPreviewPath(dependencyInstallBase, entry.entryName)}`)
                                .join('')}
                        </Alert>
                    )}

                    {sources.length > 0 && (
                        <Stack spacing={1}>
                            {sources.map((source) => {
                                const dllOptions = source.entries
                                    .filter((entry) => entry.selectedType === 'dll')
                                    .map((entry) => entry.entryName);

                                return (
                                <Box
                                    key={source.id}
                                    sx={{
                                        p: 1,
                                        borderRadius: 1,
                                        border: '1px solid var(--border-color)',
                                        background: 'var(--input-bg-color)',
                                    }}
                                >
                                    <Stack spacing={1}>
                                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                                    <Typography
                                        sx={{
                                            color: 'var(--text-color-light)',
                                            fontSize: 12,
                                            flex: '0 0 auto',
                                            maxWidth: 140,
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap',
                                        }}
                                        title={source.sourcePath}
                                    >
                                        {source.sourceName}
                                    </Typography>
                                    <TextField
                                        size="small"
                                        label="이름"
                                        value={source.packageName}
                                        onChange={(e) => updateSource(source.id, { packageName: e.target.value })}
                                        sx={{ ...inputSx, flex: 1, minWidth: 80 }}
                                    />
                                    <TextField
                                        size="small"
                                        label="제작자"
                                        value={source.author}
                                        onChange={(e) => updateSource(source.id, { author: e.target.value })}
                                        sx={{ ...inputSx, flex: 1, minWidth: 80 }}
                                    />
                                    <IconButton
                                        size="small"
                                        onClick={() => deleteSource(source.id)}
                                        sx={{ color: 'var(--accent-color)' }}
                                    >
                                        <DeleteIcon fontSize="small" />
                                    </IconButton>
                                        </Box>
                                        {source.warnings.length > 0 && (
                                            <Alert severity="warning" sx={{ '& .MuiAlert-message': { fontSize: 12 } }}>
                                                {source.warnings.join(' / ')}
                                            </Alert>
                                        )}
                                        {source.sourceKind === 'zip' && (
                                            <ZipEntryTable
                                                entries={source.entries}
                                                onChange={(idx, patch) => updateSourceEntry(source.id, idx, patch)}
                                                onDelete={(idx) => deleteSourceEntry(source.id, idx)}
                                                dependsOnOptions={dllOptions}
                                                showDependsOn={dllOptions.length > 1}
                                                lockDllAndFolderTypes
                                                getDisabledTypes={getPackEntryDisabledTypes}
                                            />
                                        )}
                                    </Stack>
                                </Box>
                                );
                            })}
                        </Stack>
                    )}
                    </>
                    )}

                    {packStep === 1 && (
                    <>
                    <Alert severity="info">
                        패키지 이름, 제작자, 설명을 먼저 입력한 뒤 다음 단계에서 파일을 추가합니다.
                    </Alert>

                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                        <Typography sx={{ color: 'var(--text-color)', fontSize: 14 }}>패키지 타입</Typography>
                        {(['single', 'collection'] as const).map((t) => (
                            <Chip
                                key={t}
                                label={t === 'single' ? '단일' : '컬렉션'}
                                size="small"
                                clickable={!(t === 'single' && isForcedCollection)}
                                disabled={t === 'single' && isForcedCollection}
                                onClick={() => {
                                    if (t === 'single' && isForcedCollection) return;
                                    setPackageType(t);
                                }}
                                sx={{
                                    background: packageType === t ? 'var(--primary-color)' : 'transparent',
                                    color: packageType === t ? '#fff' : 'var(--text-color)',
                                    border: '1px solid var(--border-color)',
                                }}
                            />
                        ))}
                    </Box>
                    <TextField label="패키지 이름" value={name} onChange={(e) => setName(e.target.value)} sx={inputSx} />
                    <TextField label="제작자" value={author} onChange={(e) => setAuthor(e.target.value)} sx={inputSx} />
                    <TextField label="버전" value={version} onChange={(e) => setVersion(e.target.value)} sx={inputSx} />
                    <TextField
                        label="설명"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        multiline
                        minRows={2}
                        sx={multilineSx}
                    />
                    <Box sx={{ p: 1.25, border: '1px solid var(--border-color)', borderRadius: 1 }}>
                        <FormControlLabel
                            control={<Switch size="small" checked={dependencyEnabled} onChange={(e) => setDependencyEnabled(e.target.checked)} />}
                            label={<Typography sx={{ color: 'var(--text-color)' }}>종속 모드로 패킹</Typography>}
                        />
                        {dependencyEnabled && (
                            <Stack spacing={1} sx={{ mt: 1 }}>
                                <Select
                                    size="small"
                                    displayEmpty
                                    value=""
                                    onChange={(e) => {
                                        const selected = packages.find((pkg) => pkg.id === e.target.value);
                                        if (!selected) return;
                                        setDependencyTarget(getPackageDependencyTarget(selected));
                                        setDependencyDisplayName(selected.name);
                                        setDependencyInstallBase(selected.installPathHints?.[0] ?? '');
                                    }}
                                    sx={selectSx}
                                    MenuProps={selectMenuProps}
                                >
                                    <MenuItem value="">설치된 메인 모드 선택</MenuItem>
                                    {packages.map((pkg) => (
                                        <MenuItem key={pkg.id} value={pkg.id}>
                                            {getPackageDependencyLabel(pkg)}
                                        </MenuItem>
                                    ))}
                                </Select>
                                <TextField
                                    label="메인 모드 식별자"
                                    value={dependencyTarget}
                                    onChange={(e) => setDependencyTarget(e.target.value)}
                                    helperText="GitHub catalog id, package id, package name 중 하나와 매칭됩니다."
                                    sx={inputSx}
                                />
                                <TextField
                                    label="표시 이름"
                                    value={dependencyDisplayName}
                                    onChange={(e) => setDependencyDisplayName(e.target.value)}
                                    sx={inputSx}
                                />
                                {dependencyInstallPathHints.length > 0 && (
                                    <Select
                                        size="small"
                                        displayEmpty
                                        value={dependencyInstallBase}
                                        onChange={(e) => setDependencyInstallBase(String(e.target.value))}
                                        sx={selectSx}
                                        MenuProps={selectMenuProps}
                                    >
                                        <MenuItem value="" sx={{ fontSize: 12 }}>기존 BepInEx 기준 경로 사용</MenuItem>
                                        {dependencyInstallPathHints.map((hint) => (
                                            <MenuItem key={hint} value={hint} sx={{ fontSize: 12 }}>
                                                {hint}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                )}
                                <TextField
                                    label="종속 모드 설치 기준 경로"
                                    value={dependencyInstallBase}
                                    onChange={(e) => setDependencyInstallBase(normalizePackPath(e.target.value))}
                                    helperText="BepInEx 기준 상대 경로입니다. 예: plugins/ResourceInjector/pack"
                                    sx={inputSx}
                                />
                            </Stack>
                        )}
                    </Box>
                    <Box sx={{ p: 1.25, border: '1px solid var(--border-color)', borderRadius: 1 }}>
                        <Typography sx={{ color: 'var(--text-color)', fontWeight: 800, mb: 1 }}>
                            업데이트 방식
                        </Typography>
                        <Stack spacing={1}>
                            <Select
                                size="small"
                                value={updatePolicyMode}
                                onChange={(e) => setUpdatePolicyMode(e.target.value as ModUpdatePolicy['mode'])}
                                sx={selectSx}
                                MenuProps={selectMenuProps}
                            >
                                <MenuItem value="replace-confirm">새로 설치 필요 (확인 후 교체)</MenuItem>
                                <MenuItem value="merge">보존 경로 유지 후 병합</MenuItem>
                                <MenuItem value="overwrite">단순 덮어쓰기</MenuItem>
                            </Select>
                            <Typography sx={{ color: 'var(--text-color-light)', fontSize: 12 }}>
                                업데이트 정책은 온라인 업데이트 시 적용됩니다. 기존 catalog/ZIP에 없으면 새로 설치 확인 방식으로 동작합니다.
                            </Typography>
                            {updatePolicyMode === 'merge' && (
                                <>
                                    <TextField
                                        size="small"
                                        label="보존 경로"
                                        value={updatePolicyPreserveText}
                                        onChange={(e) => setUpdatePolicyPreserveText(e.target.value)}
                                        helperText="한 줄에 하나씩 입력합니다. 예: config/MyMod.cfg, plugins/ResourceInjector/packs"
                                        multiline
                                        minRows={3}
                                        sx={multilineSx}
                                    />
                                    <FormControlLabel
                                        control={
                                            <Checkbox
                                                checked={updatePolicyRemoveMissing}
                                                onChange={(e) => setUpdatePolicyRemoveMissing(e.target.checked)}
                                            />
                                        }
                                        label={<Typography sx={{ color: 'var(--text-color)' }}>새 ZIP에 없는 비보존 파일 삭제</Typography>}
                                    />
                                </>
                            )}
                        </Stack>
                    </Box>
                    </>
                    )}

                    {packStep === 3 && (
                    <>

                    <Box>
                        <Typography sx={{ color: 'var(--text-color)', fontWeight: 800, mb: 1 }}>
                            설정 Script 작성
                        </Typography>
                        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', rowGap: 1, mb: 1 }}>
                            <Button size="small" variant="outlined" onClick={() => addScriptFeature('cfg_fields')} sx={{ borderColor: 'var(--border-color)', color: 'var(--text-color)' }}>
                                CFG 필드
                            </Button>
                            <Button size="small" variant="outlined" onClick={() => addScriptFeature('file_manager')} sx={{ borderColor: 'var(--border-color)', color: 'var(--text-color)' }}>
                                파일관리
                            </Button>
                            <Button size="small" variant="outlined" onClick={() => addScriptFeature('json_manager')} sx={{ borderColor: 'var(--border-color)', color: 'var(--text-color)' }}>
                                JSON 파일관리
                            </Button>
                        </Stack>
                        <Stack spacing={1}>
                            {scriptFeatures.map((feature) => (
                                <Box key={feature.id} sx={{ p: 1, border: '1px solid var(--border-color)', borderRadius: 1, background: 'var(--input-bg-color)' }}>
                                    <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                                        <IconButton
                                            size="small"
                                            onClick={() => updateScriptFeature(feature.id, { collapsed: !feature.collapsed })}
                                            sx={{ color: 'var(--text-color-light)' }}
                                        >
                                            {feature.collapsed ? <ChevronRightIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                                        </IconButton>
                                        <Typography sx={{ color: 'var(--text-color)', fontWeight: 700, flex: 1 }}>
                                            {feature.name}
                                        </Typography>
                                        <Chip label={feature.type} size="small" />
                                        <Chip label={`${feature.fields?.length ?? 0} fields`} size="small" />
                                        <IconButton size="small" onClick={() => { setScriptFeatures((prev) => prev.filter((item) => item.id !== feature.id)); setScriptJsonDirty(false); }} sx={{ color: 'var(--accent-color)' }}>
                                            <DeleteIcon fontSize="small" />
                                        </IconButton>
                                    </Stack>
                                    {!feature.collapsed && (
                                        <Stack spacing={1} sx={{ mt: 1 }}>
                                            <TextField size="small" label="관리명" value={feature.name} onChange={(e) => updateScriptFeature(feature.id, { name: e.target.value })} sx={inputSx} />
                                            {feature.type === 'file_manager' && (
                                                <Stack spacing={1}>
                                                    <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
                                                        <TextField
                                                            size="small"
                                                            label="파일 복사 위치 (BepInEx 기준)"
                                                            value={feature.targetDir || ''}
                                                            onChange={(e) => updateScriptFeature(feature.id, { targetDir: e.target.value })}
                                                            helperText="종속 모드에서도 BepInEx 기준 상대경로를 입력합니다."
                                                            sx={{ ...inputSx, flex: 1 }}
                                                        />
                                                        {dependencyEnabled && normalizePackPath(dependencyInstallBase).trim() && (
                                                            <Tooltip title="종속 모드 설치 기준 경로를 파일관리 대상 폴더로 복사합니다.">
                                                                <Button
                                                                    size="small"
                                                                    variant="outlined"
                                                                    onClick={() =>
                                                                        updateScriptFeature(feature.id, {
                                                                            targetDir: normalizePackPath(dependencyInstallBase).replace(/\/+$/, ''),
                                                                        })
                                                                    }
                                                                    sx={{ borderColor: 'var(--border-color)', color: 'var(--text-color)', whiteSpace: 'nowrap', mt: 0.5 }}
                                                                >
                                                                    종속 설치 기준 사용
                                                                </Button>
                                                            </Tooltip>
                                                        )}
                                                        <TextField size="small" label="확장자" value={(feature.extensions ?? []).join(',')} onChange={(e) => updateScriptFeature(feature.id, { extensions: e.target.value.split(',').map((v) => v.trim()).filter(Boolean) })} sx={{ ...inputSx, flex: 1 }} />
                                                    </Stack>
                                                    <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                                                        <Select
                                                            size="small"
                                                            value={
                                                                feature.linkedConfigPath
                                                                    ? jsonEntryOptions.find((option) =>
                                                                        option.entryName === feature.linkedConfigPath ||
                                                                        (feature.linkedConfigSourceId === option.sourceId &&
                                                                            feature.linkedConfigSourceEntryName === option.sourceEntryName)
                                                                    )?.value ?? ''
                                                                    : ''
                                                            }
                                                            displayEmpty
                                                            onChange={(e) => handleSelectLinkedConfig(feature.id, String(e.target.value))}
                                                            sx={{ ...selectSx, minWidth: 280 }}
                                                            MenuProps={selectMenuProps}
                                                        >
                                                            <MenuItem value="" sx={{ fontSize: 12 }}>
                                                                연동 설정 JSON 선택
                                                            </MenuItem>
                                                            {jsonEntryOptions.map((option) => (
                                                                <MenuItem key={option.value} value={option.value} sx={{ fontSize: 12 }}>
                                                                    {option.label}
                                                                </MenuItem>
                                                            ))}
                                                        </Select>
                                                        <Button
                                                            size="small"
                                                            variant="outlined"
                                                            disabled={jsonEntryOptions.length === 0}
                                                            onClick={() => {
                                                                const first = jsonEntryOptions[0];
                                                                if (first) void handleSelectLinkedConfig(feature.id, first.value);
                                                            }}
                                                            sx={{ borderColor: 'var(--border-color)', color: 'var(--text-color)' }}
                                                        >
                                                            연동설정파일추가
                                                        </Button>
                                                    </Stack>
                                                    <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                                                        <TextField
                                                            size="small"
                                                            label="연동 배열 JSON path"
                                                            value={getEditableLinkedConfigPath(feature.linkedConfigArrayPath)}
                                                            onChange={(e) => {
                                                                const pathValue = e.target.value.trim() === '' ? '' : normalizeLinkedConfigPath(e.target.value);
                                                                updateScriptFeature(feature.id, {
                                                                    linkedConfigArrayPath: pathValue,
                                                                    linkedConfigTargetPath: pathValue,
                                                                    linkedConfigPathSegments: getPathSegments(pathValue),
                                                                });
                                                            }}
                                                            sx={{ ...inputSx, flex: 1 }}
                                                        />
                                                        <Tooltip title="/ 구분자를 사용합니다. 예: root, files, files/pngs">
                                                            <IconButton size="small" sx={{ color: 'var(--text-color-light)' }}>
                                                                <InfoOutlinedIcon fontSize="small" />
                                                            </IconButton>
                                                        </Tooltip>
                                                    </Stack>
                                                    {feature.linkedConfigPath && (
                                                        <Stack spacing={1}>
                                                            <Button
                                                                size="small"
                                                                variant="outlined"
                                                                startIcon={feature.linkedConfigContentCollapsed ? <ChevronRightIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                                                                onClick={() => updateScriptFeature(feature.id, { linkedConfigContentCollapsed: !feature.linkedConfigContentCollapsed })}
                                                                sx={{ alignSelf: 'flex-start', borderColor: 'var(--border-color)', color: 'var(--text-color)' }}
                                                            >
                                                                연동 JSON 내용
                                                            </Button>
                                                            {feature.linkedConfigContentCollapsed && (
                                                                <Typography sx={{ color: 'var(--text-color-light)', fontSize: 12 }}>
                                                                    {feature.linkedConfigData
                                                                        ? `JSON 분석됨 / 후보 ${(feature.linkedConfigArrayCandidates ?? []).length}개`
                                                                        : 'JSON 내용 없음 또는 파싱 실패'}
                                                                </Typography>
                                                            )}
                                                            {!feature.linkedConfigContentCollapsed && (
                                                                <TextField
                                                                    multiline
                                                                    minRows={5}
                                                                label="연동 JSON 내용"
                                                                value={feature.linkedConfigText ?? feature.linkedConfigPreviewText ?? ''}
                                                                onChange={(e) => handleLinkedConfigTextChange(feature, e.target.value)}
                                                                sx={multilineSx}
                                                                placeholder="처음 패킹하는 빈 JSON이면 여기에 예시 JSON을 붙여넣어 배열 path를 추론할 수 있습니다."
                                                                />
                                                            )}
                                                            {(() => {
                                                                const preview = getLinkedConfigPreview(feature, assetEntryOptions);
                                                                const reconcilePlan = getLinkedConfigReconcilePlan(feature, assetEntryOptions);
                                                                const pathOptions = [
                                                                    { label: 'root', value: '$' },
                                                                    ...getObjectPathOptions(feature.linkedConfigData, '$'),
                                                                ];
                                                                const childPathOptions = getObjectPathOptions(
                                                                    feature.linkedConfigData,
                                                                    feature.linkedConfigTargetPath || feature.linkedConfigArrayPath || '$'
                                                                );
                                                                return (
                                                                    <Stack spacing={1}>
                                                                        {(feature.linkedConfigArrayCandidates ?? []).length > 0 && (
                                                                            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 1 }}>
                                                                                <Select
                                                                                    size="small"
                                                                                    value={normalizeLinkedConfigPath(feature.linkedConfigTargetPath || feature.linkedConfigArrayPath || '$')}
                                                                                    onChange={(e) => {
                                                                                        const pathValue = normalizeLinkedConfigPath(String(e.target.value));
                                                                                        const candidate = findLinkedConfigCandidate(feature.linkedConfigArrayCandidates, pathValue);
                                                                                        const defaultPatch = getDefaultLinkedConfigPatch(candidate ? [candidate] : [], feature.extensions);
                                                                                        const inferredTargetDir = inferTargetDirFromLinkedConfig(feature.linkedConfigPath, candidate, feature.extensions);
                                                                                        updateScriptFeature(feature.id, {
                                                                                            linkedConfigTargetPath: pathValue,
                                                                                            linkedConfigArrayPath: pathValue,
                                                                                            linkedConfigPathSegments: getPathSegments(pathValue),
                                                                                            linkedConfigKeyTemplate: feature.linkedConfigKeyTemplate || inferKeyTemplateFromExample(candidate?.examples[0]?.key),
                                                                                            ...(feature.targetDir && feature.targetDir !== 'plugins'
                                                                                                ? {}
                                                                                                : inferredTargetDir
                                                                                                  ? { targetDir: inferredTargetDir }
                                                                                                  : {}),
                                                                                            linkedConfigFilterKey: '',
                                                                                            linkedConfigFilterValue: '',
                                                                                            linkedConfigValueKey: defaultPatch.linkedConfigValueKey || '',
                                                                                            linkedConfigSelectedFields: defaultPatch.linkedConfigSelectedFields || [],
                                                                                        });
                                                                                    }}
                                                                                    sx={{ ...selectSx, minWidth: 180 }}
                                                                                    MenuProps={selectMenuProps}
                                                                                >
                                                                                    {pathOptions.map((option) => (
                                                                                        <MenuItem key={option.value} value={option.value} sx={{ fontSize: 12 }}>
                                                                                            {option.label}
                                                                                        </MenuItem>
                                                                                    ))}
                                                                                </Select>
                                                                                <Button
                                                                                    size="small"
                                                                                    variant="outlined"
                                                                                    disabled={childPathOptions.length === 0}
                                                                                    onClick={() => {
                                                                                        const next = childPathOptions[0];
                                                                                        if (!next) return;
                                                                                        const candidate = findLinkedConfigCandidate(feature.linkedConfigArrayCandidates, next.value);
                                                                                        updateScriptFeature(feature.id, {
                                                                                            linkedConfigTargetPath: next.value,
                                                                                            linkedConfigArrayPath: next.value,
                                                                                            linkedConfigPathSegments: getPathSegments(next.value),
                                                                                            linkedConfigKeyTemplate: feature.linkedConfigKeyTemplate || inferKeyTemplateFromExample(candidate?.examples[0]?.key),
                                                                                        });
                                                                                    }}
                                                                                    sx={{ borderColor: 'var(--border-color)', color: 'var(--text-color)' }}
                                                                                >
                                                                                    경로 추가
                                                                                </Button>
                                                                                {childPathOptions.length > 0 && (
                                                                                    <Select
                                                                                        size="small"
                                                                                        value=""
                                                                                        displayEmpty
                                                                                        onChange={(e) => {
                                                                                            const pathValue = normalizeLinkedConfigPath(String(e.target.value));
                                                                                            const candidate = findLinkedConfigCandidate(feature.linkedConfigArrayCandidates, pathValue);
                                                                                            updateScriptFeature(feature.id, {
                                                                                                linkedConfigTargetPath: pathValue,
                                                                                                linkedConfigArrayPath: pathValue,
                                                                                                linkedConfigPathSegments: getPathSegments(pathValue),
                                                                                                linkedConfigKeyTemplate: feature.linkedConfigKeyTemplate || inferKeyTemplateFromExample(candidate?.examples[0]?.key),
                                                                                            });
                                                                                        }}
                                                                                        sx={{ ...selectSx, minWidth: 180 }}
                                                                                        MenuProps={selectMenuProps}
                                                                                    >
                                                                                        <MenuItem value="" sx={{ fontSize: 12 }}>다음 경로 선택</MenuItem>
                                                                                        {childPathOptions.map((option) => (
                                                                                            <MenuItem key={option.value} value={option.value} sx={{ fontSize: 12 }}>
                                                                                                {option.label}
                                                                                            </MenuItem>
                                                                                        ))}
                                                                                    </Select>
                                                                                )}
                                                                                {preview && (
                                                                                    <>
                                                                                        <Select
                                                                                            size="small"
                                                                                            value={feature.linkedConfigFilterKey || ''}
                                                                                            displayEmpty
                                                                                            onChange={(e) => {
                                                                                                const filterKey = String(e.target.value);
                                                                                                updateScriptFeature(feature.id, {
                                                                                                    linkedConfigFilterKey: filterKey,
                                                                                                    linkedConfigFilterValue: '',
                                                                                                    linkedConfigSelectedFields: preview.candidate.fields.filter((field) => field !== filterKey),
                                                                                                });
                                                                                            }}
                                                                                            sx={{ ...selectSx, minWidth: 150 }}
                                                                                            MenuProps={selectMenuProps}
                                                                                        >
                                                                                            <MenuItem value="" sx={{ fontSize: 12 }}>필터 없음</MenuItem>
                                                                                            {Object.keys(preview.candidate.filterValues).map((key) => (
                                                                                                <MenuItem key={key} value={key} sx={{ fontSize: 12 }}>{key}</MenuItem>
                                                                                            ))}
                                                                                        </Select>
                                                                                        <Select
                                                                                            size="small"
                                                                                            value={feature.linkedConfigFilterValue || ''}
                                                                                            displayEmpty
                                                                                            onChange={(e) => {
                                                                                                const filterValue = String(e.target.value);
                                                                                                const inferredTargetDir = inferTargetDirFromLinkedConfig(
                                                                                                    feature.linkedConfigPath,
                                                                                                    preview.candidate,
                                                                                                    feature.extensions,
                                                                                                    feature.linkedConfigFilterKey,
                                                                                                    filterValue
                                                                                                );
                                                                                                updateScriptFeature(feature.id, {
                                                                                                    linkedConfigFilterValue: filterValue,
                                                                                                    ...(feature.targetDir && feature.targetDir !== 'plugins'
                                                                                                        ? {}
                                                                                                        : inferredTargetDir
                                                                                                          ? { targetDir: inferredTargetDir }
                                                                                                          : {}),
                                                                                                });
                                                                                            }}
                                                                                            sx={{ ...selectSx, minWidth: 120 }}
                                                                                            MenuProps={selectMenuProps}
                                                                                        >
                                                                                            <MenuItem value="" sx={{ fontSize: 12 }}>전체</MenuItem>
                                                                                            {(preview.candidate.filterValues[feature.linkedConfigFilterKey || ''] ?? []).map((value) => (
                                                                                                <MenuItem key={value} value={value} sx={{ fontSize: 12 }}>{value}</MenuItem>
                                                                                            ))}
                                                                                        </Select>
                                                                                    </>
                                                                                )}
                                                                            </Stack>
                                                                        )}
                                                                        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                                                                            <TextField
                                                                                size="small"
                                                                                label="JSON key 생성 규칙"
                                                                                value={feature.linkedConfigKeyTemplate || ''}
                                                                                onChange={(e) => updateScriptFeature(feature.id, { linkedConfigKeyTemplate: e.target.value })}
                                                                                sx={{ ...inputSx, flex: 1 }}
                                                                                placeholder="예: portraits/png/$"
                                                                            />
                                                                            <Tooltip title="$는 추가되는 파일명으로 치환됩니다. 예: portraits/png/$ → portraits/png/test.png">
                                                                                <IconButton size="small" sx={{ color: 'var(--text-color-light)' }}>
                                                                                    <InfoOutlinedIcon fontSize="small" />
                                                                                </IconButton>
                                                                            </Tooltip>
                                                                        </Stack>
                                                                        {preview && (
                                                                            <Box sx={{ p: 1, border: '1px solid var(--border-color)', borderRadius: 1 }}>
                                                                                <Typography sx={{ color: 'var(--text-color-light)', fontSize: 12 }}>
                                                                                    대상: {preview.example.key} → {preview.targetPath} / 예시 파일 {preview.fileName} / 필터 결과 {preview.filteredCount}개
                                                                                </Typography>
                                                                                <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', rowGap: 0.5, mt: 0.75 }}>
                                                                                    {preview.fields.map((field) => {
                                                                                        const checked = feature.linkedConfigSelectedFields?.includes(field) ?? true;
                                                                                        return (
                                                                                            <Stack key={field} direction="row" spacing={0.5} sx={{ alignItems: 'center', flex: '1 1 240px' }}>
                                                                                                <FormControlLabel
                                                                                                    control={
                                                                                                        <Checkbox
                                                                                                            size="small"
                                                                                                            checked={checked}
                                                                                                            onChange={(e) => {
                                                                                                                const current = feature.linkedConfigSelectedFields ?? preview.fields;
                                                                                                                updateScriptFeature(feature.id, {
                                                                                                                    linkedConfigSelectedFields: e.target.checked
                                                                                                                        ? [...new Set([...current, field])]
                                                                                                                        : current.filter((item) => item !== field),
                                                                                                                    linkedConfigFieldDefaults: {
                                                                                                                        ...(feature.linkedConfigFieldDefaults ?? {}),
                                                                                                                        [field]: feature.linkedConfigFieldDefaults?.[field] ?? preview.example.data[field] ?? '',
                                                                                                                    },
                                                                                                                });
                                                                                                            }}
                                                                                                        />
                                                                                                    }
                                                                                                    label={field}
                                                                                                    sx={{ color: 'var(--text-color)', mr: 0 }}
                                                                                                />
                                                                                                {!checked && (
                                                                                                    <TextField
                                                                                                        size="small"
                                                                                                        label="기본값"
                                                                                                        value={String(feature.linkedConfigFieldDefaults?.[field] ?? preview.example.data[field] ?? '')}
                                                                                                        onChange={(e) =>
                                                                                                            updateScriptFeature(feature.id, {
                                                                                                                linkedConfigFieldDefaults: {
                                                                                                                    ...(feature.linkedConfigFieldDefaults ?? {}),
                                                                                                                    [field]: e.target.value,
                                                                                                                },
                                                                                                            })
                                                                                                        }
                                                                                                        sx={{ ...inputSx, flex: 1 }}
                                                                                                    />
                                                                                                )}
                                                                                            </Stack>
                                                                                        );
                                                                                    })}
                                                                                </Stack>
                                                                                <Typography sx={{ color: 'var(--text-color-light)', fontSize: 12, mt: 0.5 }}>
                                                                                    체크 해제한 항목은 모드 설정 UI에서 기본값을 반드시 입력하도록 처리됩니다.
                                                                                </Typography>
                                                                            </Box>
                                                                        )}
                                                                        {reconcilePlan && (
                                                                            <Box sx={{ p: 1, border: '1px solid var(--border-color)', borderRadius: 1 }}>
                                                                                <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 0.5, mb: 1 }}>
                                                                                    <Typography sx={{ color: 'var(--primary-color)', fontWeight: 800, fontSize: 14 }}>
                                                                                        연동 JSON 정리
                                                                                    </Typography>
                                                                                    <Chip size="small" label={`JSON ${reconcilePlan.registryCount}`} />
                                                                                    <Chip size="small" label={`파일 ${reconcilePlan.assetCount}`} />
                                                                                    <Chip size="small" color={reconcilePlan.removeCandidates.length > 0 ? 'warning' : 'default'} label={`제거 후보 ${reconcilePlan.removeCandidates.length}`} />
                                                                                    <Chip size="small" color={reconcilePlan.addCandidates.length > 0 ? 'info' : 'default'} label={`추가 후보 ${reconcilePlan.addCandidates.length}`} />
                                                                                </Stack>
                                                                                {reconcilePlan.removeCandidates.length === 0 && reconcilePlan.addCandidates.length === 0 ? (
                                                                                    <Typography sx={{ color: 'var(--text-color-light)', fontSize: 12 }}>
                                                                                        현재 등록된 파일과 JSON 항목이 일치합니다.
                                                                                    </Typography>
                                                                                ) : (
                                                                                    <Stack spacing={1}>
                                                                                        {reconcilePlan.removeCandidates.length > 0 && (
                                                                                            <Box>
                                                                                                <Typography sx={{ color: 'var(--text-color-light)', fontSize: 12, mb: 0.5 }}>
                                                                                                    JSON에는 있지만 현재 패킹 파일에는 없는 항목입니다. 적용하면 패킹 출력 JSON에서 제거됩니다.
                                                                                                </Typography>
                                                                                                <Stack spacing={0.5}>
                                                                                                    {reconcilePlan.removeCandidates.map((item) => {
                                                                                                        const selected = (feature.linkedConfigReconcileRemoveKeys ?? reconcilePlan.removeCandidates.map((candidate) => candidate.key)).includes(item.key);
                                                                                                        return (
                                                                                                            <FormControlLabel
                                                                                                                key={item.key}
                                                                                                                control={
                                                                                                                    <Checkbox
                                                                                                                        size="small"
                                                                                                                        checked={selected}
                                                                                                                        onChange={(e) => {
                                                                                                                            const current = feature.linkedConfigReconcileRemoveKeys ?? reconcilePlan.removeCandidates.map((candidate) => candidate.key);
                                                                                                                            updateScriptFeature(feature.id, {
                                                                                                                                linkedConfigReconcileRemoveKeys: e.target.checked
                                                                                                                                    ? [...new Set([...current, item.key])]
                                                                                                                                    : current.filter((key) => key !== item.key),
                                                                                                                            });
                                                                                                                        }}
                                                                                                                    />
                                                                                                                }
                                                                                                                label={<Typography sx={{ color: 'var(--text-color)', fontSize: 12 }}>{item.key}</Typography>}
                                                                                                            />
                                                                                                        );
                                                                                                    })}
                                                                                                </Stack>
                                                                                            </Box>
                                                                                        )}
                                                                                        {reconcilePlan.addCandidates.length > 0 && (
                                                                                            <Box>
                                                                                                <Typography sx={{ color: 'var(--text-color-light)', fontSize: 12, mb: 0.5 }}>
                                                                                                    현재 패킹 파일에는 있지만 JSON에 없는 항목입니다. 필요한 항목만 선택해서 등록합니다.
                                                                                                </Typography>
                                                                                                <Stack spacing={0.5}>
                                                                                                    {reconcilePlan.addCandidates.map((item) => {
                                                                                                        const selected = (feature.linkedConfigReconcileAddKeys ?? []).includes(item.key);
                                                                                                        const addValues = feature.linkedConfigReconcileAddValues?.[item.key];
                                                                                                        const addFields = getLinkedConfigAddFields(feature, preview, addValues);
                                                                                                        return (
                                                                                                            <Box key={item.key} sx={{ border: selected ? '1px solid var(--border-color)' : 'none', borderRadius: 1, p: selected ? 1 : 0 }}>
                                                                                                                <FormControlLabel
                                                                                                                    control={
                                                                                                                        <Checkbox
                                                                                                                            size="small"
                                                                                                                            checked={selected}
                                                                                                                            onChange={(e) => {
                                                                                                                                const current = feature.linkedConfigReconcileAddKeys ?? [];
                                                                                                                                const currentValues = feature.linkedConfigReconcileAddValues ?? {};
                                                                                                                                const nextValues = { ...currentValues };
                                                                                                                                if (e.target.checked) {
                                                                                                                                    nextValues[item.key] = currentValues[item.key] ?? buildLinkedConfigAddValue(feature, preview);
                                                                                                                                } else {
                                                                                                                                    delete nextValues[item.key];
                                                                                                                                }
                                                                                                                                updateScriptFeature(feature.id, {
                                                                                                                                    linkedConfigReconcileAddKeys: e.target.checked
                                                                                                                                        ? [...new Set([...current, item.key])]
                                                                                                                                        : current.filter((key) => key !== item.key),
                                                                                                                                    linkedConfigReconcileAddValues: nextValues,
                                                                                                                                });
                                                                                                                            }}
                                                                                                                        />
                                                                                                                    }
                                                                                                                    label={
                                                                                                                        <Typography sx={{ color: 'var(--text-color)', fontSize: 12 }}>
                                                                                                                            {item.assetPath} → {item.key}
                                                                                                                        </Typography>
                                                                                                                    }
                                                                                                                    sx={{ mr: 0 }}
                                                                                                                />
                                                                                                                {selected && (
                                                                                                                    <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', rowGap: 1, ml: 3, mt: 0.5 }}>
                                                                                                                        {addFields.map((field) => {
                                                                                                                            const values = addValues ?? buildLinkedConfigAddValue(feature, preview);
                                                                                                                            const templateValue = getLinkedConfigFieldTemplateValue(feature, preview, field);
                                                                                                                            const currentValue = values[field] ?? templateValue;
                                                                                                                            const isFilterField = Boolean(
                                                                                                                                feature.linkedConfigFilterKey &&
                                                                                                                                feature.linkedConfigFilterValue &&
                                                                                                                                field === feature.linkedConfigFilterKey
                                                                                                                            );
                                                                                                                            const updateFieldValue = (nextValue: unknown) => {
                                                                                                                                const nextValues = {
                                                                                                                                    ...(feature.linkedConfigReconcileAddValues ?? {}),
                                                                                                                                    [item.key]: {
                                                                                                                                        ...(feature.linkedConfigReconcileAddValues?.[item.key] ?? buildLinkedConfigAddValue(feature, preview)),
                                                                                                                                        [field]: nextValue,
                                                                                                                                    },
                                                                                                                                };
                                                                                                                                updateScriptFeature(feature.id, { linkedConfigReconcileAddValues: nextValues });
                                                                                                                            };
                                                                                                                            if (typeof templateValue === 'boolean') {
                                                                                                                                return (
                                                                                                                                    <FormControlLabel
                                                                                                                                        key={field}
                                                                                                                                        control={
                                                                                                                                            <Checkbox
                                                                                                                                                size="small"
                                                                                                                                                checked={Boolean(currentValue)}
                                                                                                                                                disabled={isFilterField}
                                                                                                                                                onChange={(e) => updateFieldValue(e.target.checked)}
                                                                                                                                            />
                                                                                                                                        }
                                                                                                                                        label={<Typography sx={{ color: 'var(--text-color)', fontSize: 12 }}>{field}</Typography>}
                                                                                                                                        sx={{ flex: '1 1 160px', mr: 0 }}
                                                                                                                                    />
                                                                                                                                );
                                                                                                                            }
                                                                                                                            return (
                                                                                                                                <TextField
                                                                                                                                    key={field}
                                                                                                                                    size="small"
                                                                                                                                    label={isFilterField ? `${field} (고정)` : field}
                                                                                                                                    type={typeof templateValue === 'number' ? 'number' : 'text'}
                                                                                                                                    value={formatLinkedConfigFieldValue(currentValue)}
                                                                                                                                    disabled={isFilterField}
                                                                                                                                    onChange={(e) =>
                                                                                                                                        updateFieldValue(normalizeDefaultValue(e.target.value, templateValue))
                                                                                                                                    }
                                                                                                                                    sx={{ ...inputSx, flex: '1 1 180px' }}
                                                                                                                                />
                                                                                                                            );
                                                                                                                        })}
                                                                                                                    </Stack>
                                                                                                                )}
                                                                                                            </Box>
                                                                                                        );
                                                                                                    })}
                                                                                                </Stack>
                                                                                            </Box>
                                                                                        )}
                                                                                        <Button
                                                                                            size="small"
                                                                                            variant="outlined"
                                                                                            onClick={() => handleApplyLinkedConfigReconcile(feature)}
                                                                                            sx={{ alignSelf: 'flex-start', borderColor: 'var(--border-color)', color: 'var(--text-color)' }}
                                                                                        >
                                                                                            선택 항목 적용
                                                                                        </Button>
                                                                                    </Stack>
                                                                                )}
                                                                            </Box>
                                                                        )}
                                                                        {!preview && feature.linkedConfigPath && (
                                                                            <Alert severity="info" sx={{ '& .MuiAlert-message': { fontSize: 12 } }}>
                                                                                연동 JSON 내용을 펼쳐 예시 JSON을 입력하면 metadata field를 추론할 수 있습니다.
                                                                            </Alert>
                                                                        )}
                                                                    </Stack>
                                                                );
                                                            })()}
                                                            {/* Legacy linked array UI removed
                                                                <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                                                                    <Select
                                                                        size="small"
                                                                        value={feature.linkedConfigArrayPath || ''}
                                                                        onChange={(e) => {
                                                                            const pathValue = String(e.target.value);
                                                                            const candidate = feature.linkedConfigArrayCandidates?.find((item) => item.path === pathValue);
                                                                            updateScriptFeature(feature.id, {
                                                                                linkedConfigArrayPath: pathValue,
                                                                                linkedConfigValueKey: candidate?.valueKeys[0] ?? '',
                                                                            });
                                                                        }}
                                                                        sx={{ ...selectSx, minWidth: 220 }}
                                                                        MenuProps={selectMenuProps}
                                                                    >
                                                                        {(feature.linkedConfigArrayCandidates ?? []).map((candidate) => (
                                                                            <MenuItem key={candidate.path} value={candidate.path} sx={{ fontSize: 12 }}>
                                                                                {candidate.path} ({candidate.itemType})
                                                                            </MenuItem>
                                                                        ))}
                                                                    </Select>
                                                                    {(() => {
                                                                        const candidate = feature.linkedConfigArrayCandidates?.find((item) => item.path === feature.linkedConfigArrayPath);
                                                                        if (!candidate || candidate.valueKeys.length === 0) return null;
                                                                        return (
                                                                            <Select
                                                                                size="small"
                                                                                value={feature.linkedConfigValueKey || candidate.valueKeys[0] || ''}
                                                                                onChange={(e) => updateScriptFeature(feature.id, { linkedConfigValueKey: String(e.target.value) })}
                                                                                sx={{ ...selectSx, minWidth: 160 }}
                                                                                MenuProps={selectMenuProps}
                                                                            >
                                                                                {candidate.valueKeys.map((key) => (
                                                                                    <MenuItem key={key} value={key} sx={{ fontSize: 12 }}>
                                                                                        {key}
                                                                                    </MenuItem>
                                                                                ))}
                                                                            </Select>
                                                                        );
                                                                    })()}
                                                                </Stack>
                                                            ) : (
                                                                <Alert severity="info" sx={{ '& .MuiAlert-message': { fontSize: 12 } }}>
                                                                    JSON이 비어 있거나 배열 후보를 찾지 못했습니다. 내용을 붙여넣은 뒤 배열 path를 직접 입력할 수 있습니다.
                                                                </Alert>
                                                            */}
                                                        </Stack>
                                                    )}
                                                    {renderSettingsPreview([feature])}
                                                </Stack>
                                            )}
                                            {feature.type === 'cfg_fields' && (
                                                <Stack spacing={1}>
                                                    <TextField size="small" label="BepInEx 기준 cfg 경로" value={feature.cfgPath || ''} onChange={(e) => updateScriptFeature(feature.id, { cfgPath: e.target.value })} sx={inputSx} />
                                                    <Button
                                                        size="small"
                                                        variant="outlined"
                                                        onClick={async () => {
                                                            const selected = await window.electronAPI.selectFile('.cfg');
                                                            releaseNativeDialogFocus();
                                                            if (!selected) return;
                                                            const text = await window.electronAPI.readTextFile(selected);
                                                            const cfgPath = `config/${selected.split(/[\\/]/).pop()}`;
                                                            updateScriptFeature(feature.id, {
                                                                cfgPath,
                                                                cfgText: text,
                                                                fields: parseCfgFields(cfgPath, text),
                                                            });
                                                        }}
                                                        sx={{ alignSelf: 'flex-start', borderColor: 'var(--border-color)', color: 'var(--text-color)' }}
                                                    >
                                                        CFG 파일 읽기
                                                    </Button>
                                                    <TextField
                                                        multiline
                                                        minRows={3}
                                                        label="cfg 내용 붙여넣기"
                                                        value={feature.cfgText || ''}
                                                        onChange={(e) => updateScriptFeature(feature.id, {
                                                            cfgText: e.target.value,
                                                            fields: parseCfgFields(feature.cfgPath || 'config/config.cfg', e.target.value),
                                                        })}
                                                        sx={multilineSx}
                                                    />
                                                    <Button size="small" variant="outlined" onClick={() => regenerateFeatureFields(feature)} sx={{ alignSelf: 'flex-start', borderColor: 'var(--border-color)', color: 'var(--text-color)' }}>
                                                        필드 자동 생성 ({feature.fields?.length ?? 0})
                                                    </Button>
                                                    <TextField
                                                        multiline
                                                        minRows={6}
                                                        label="CFG 생성 JSON"
                                                        value={getFeatureScriptJson(feature)}
                                                        slotProps={{ input: { readOnly: true } }}
                                                        sx={multilineSx}
                                                        fullWidth
                                                    />
                                                    {renderSettingsPreview([feature])}
                                                </Stack>
                                            )}
                                            {feature.type === 'json_manager' && (
                                                <Stack spacing={1}>
                                                    <TextField size="small" label="BepInEx 기준 JSON 경로" value={feature.jsonPath || ''} onChange={(e) => updateScriptFeature(feature.id, { jsonPath: e.target.value })} sx={inputSx} />
                                                    <TextField multiline minRows={4} label="샘플 JSON" value={feature.sampleText || ''} onChange={(e) => updateScriptFeature(feature.id, { sampleText: e.target.value })} sx={multilineSx} />
                                                    <Button size="small" variant="outlined" onClick={() => regenerateFeatureFields(feature)} sx={{ alignSelf: 'flex-start', borderColor: 'var(--border-color)', color: 'var(--text-color)' }}>
                                                        필드 자동 생성 ({feature.fields?.length ?? 0})
                                                    </Button>
                                                </Stack>
                                            )}
                                        </Stack>
                                    )}
                                </Box>
                            ))}
                        </Stack>
                        {/* Global JSON preview removed; CFG preview lives inside each CFG card.
                            <>
                            <TextField
                                multiline
                                minRows={8}
                                label="생성 JSON"
                                value={scriptJsonText}
                                slotProps={{ input: { readOnly: true } }}
                                sx={{ ...multilineSx, mt: 1 }}
                                fullWidth
                            />
                            {renderSettingsPreview()}
                            </>
                        */}
                    </Box>
                    </>
                    )}

                    <Divider sx={{ borderColor: 'var(--border-color)' }} />

                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                        <TextField
                            size="small"
                            label="저장 경로"
                            value={savePath}
                            onChange={(e) => setSavePath(e.target.value)}
                            sx={{ ...inputSx, flex: 1 }}
                            placeholder="ZIP 저장 위치를 선택하세요"
                        />
                        <Button
                            variant="outlined"
                            startIcon={<SaveIcon />}
                            onClick={handleSelectSavePath}
                            sx={{ borderColor: 'var(--border-color)', color: 'var(--text-color)', whiteSpace: 'nowrap' }}
                        >
                            경로 선택
                        </Button>
                    </Box>
                </Stack>
            </DialogContent>
            <DialogActions sx={{ borderTop: '1px solid var(--border-color)' }}>
                <Button onClick={handleClose} sx={{ color: 'var(--text-color-light)' }}>취소</Button>
                {packStep > 1 && (
                    <Button onClick={() => goToStep((packStep - 1) as 1 | 2 | 3)} sx={{ color: 'var(--text-color)' }}>
                        이전
                    </Button>
                )}
                {packStep < 3 && (
                    <Button
                        variant="outlined"
                        onClick={() => goToStep((packStep + 1) as 1 | 2 | 3)}
                        disabled={!canLeaveBasicInfo}
                        sx={{ borderColor: 'var(--border-color)', color: 'var(--text-color)' }}
                    >
                        다음
                    </Button>
                )}
                <Button
                    variant="contained"
                    onClick={handlePack}
                    disabled={packing || !canLeaveBasicInfo || sourceCount === 0 || !savePath || (dependencyEnabled && !dependencyTarget.trim())}
                    sx={{ background: 'var(--button-bg-color)', color: 'var(--button-text-color)' }}
                >
                    {packing ? <CircularProgress size={18} /> : '패킹'}
                </Button>
            </DialogActions>
        </Dialog>
        <Dialog
            open={helpOpen}
            onClose={() => setHelpOpen(false)}
            maxWidth="md"
            fullWidth
            slotProps={{ paper: { sx: { ...dialogPaperSx, maxHeight: '80vh' } } }}
        >
            <DialogTitle sx={{ color: 'var(--text-color)', borderBottom: '1px solid var(--border-color)' }}>
                모드 패킹 설명서
            </DialogTitle>
            <DialogContent sx={{ pt: 2 }}>
                <Typography
                    component="pre"
                    sx={{
                        color: 'var(--text-color)',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        fontFamily: 'inherit',
                        fontSize: 13,
                        m: 0,
                    }}
                >
                    {guideText || '설명서를 불러오는 중입니다.'}
                </Typography>
            </DialogContent>
            <DialogActions sx={{ borderTop: '1px solid var(--border-color)' }}>
                <Button onClick={() => setHelpOpen(false)} sx={{ color: 'var(--text-color-light)' }}>
                    닫기
                </Button>
            </DialogActions>
        </Dialog>
        </>
    );
}

// ── Add Mod Dialog ─────────────────────────────────────────────────

function AddModDialog({
    open,
    onClose,
    onImport,
}: {
    open: boolean;
    onClose: () => void;
    onImport: (pkgs: ModPackage[], packageName: string) => void;
}) {
    const [activeTab, setActiveTab] = useState<'online' | 'local'>('online');
    const [onlineMods, setOnlineMods] = useState<OnlineModCatalogItem[]>([]);
    const [onlineLoading, setOnlineLoading] = useState(false);
    const [onlineLoaded, setOnlineLoaded] = useState(false);
    const [onlineWorkingId, setOnlineWorkingId] = useState<string | null>(null);
    const [onlineError, setOnlineError] = useState('');
    const [onlineReadme, setOnlineReadme] = useState<{ title: string; text: string } | null>(null);
    const [onlineReadmeError, setOnlineReadmeError] = useState('');

    const [packageType, setPackageType] = useState<'single' | 'collection'>('single');
    const [name, setName] = useState('');
    const [author, setAuthor] = useState('');
    const [description, setDescription] = useState('');
    const [version, setVersion] = useState('1.0.0');
    const [dllFiles, setDllFiles] = useState<DllFileEntry[]>([]);

    const [zipPath, setZipPath] = useState<string | null>(null);
    const [zipEntries, setZipEntries] = useState<ZipEditableEntry[]>([]);
    const [zipPackageType, setZipPackageType] = useState<'single' | 'collection'>('single');
    const [zipName, setZipName] = useState('');
    const [zipAuthor, setZipAuthor] = useState('');
    const [zipDescription, setZipDescription] = useState('');
    const [zipVersion, setZipVersion] = useState('');
    const [zipDependency, setZipDependency] = useState<PackageDependency | undefined>(undefined);
    const [zipWarnings, setZipWarnings] = useState<string[]>([]);

    const [loadingZip, setLoadingZip] = useState(false);
    const [importing, setImporting] = useState(false);
    const [error, setError] = useState('');

    const isZipMode = zipPath !== null;
    const zipDllCount = zipEntries.filter((entry) => entry.selectedType === 'dll' && !entry.isDirectory).length;
    const zipSingleDllError =
        isZipMode && zipPackageType === 'single' && zipDllCount > 1
            ? `단일 ZIP 모드는 DLL 파일이 정확히 1개여야 합니다. 현재 ${zipDllCount}개입니다.`
            : '';

    const reset = () => {
        setActiveTab('online');
        setPackageType('single');
        setName('');
        setAuthor('');
        setDescription('');
        setVersion('1.0.0');
        setDllFiles([]);
        setZipPath(null);
        setZipEntries([]);
        setZipVersion('');
        setZipDependency(undefined);
        setZipWarnings([]);
        setOnlineMods([]);
        setOnlineLoaded(false);
        setOnlineError('');
        setError('');
    };

    const loadOnlineMods = async () => {
        setOnlineLoading(true);
        setOnlineError('');
        try {
            setOnlineMods(await window.electronAPI.getOnlineModCatalog());
        } catch (err) {
            setOnlineMods([]);
            setOnlineError(err instanceof Error ? err.message : '온라인 모드 목록을 불러오지 못했습니다.');
        } finally {
            setOnlineLoaded(true);
            setOnlineLoading(false);
        }
    };

    useEffect(() => {
        if (open && activeTab === 'online' && !onlineLoaded && !onlineLoading) {
            void loadOnlineMods();
        }
    }, [open, activeTab, onlineLoaded, onlineLoading]);

    useEffect(() => {
        if (!open) {
            setOnlineLoaded(false);
            setOnlineMods([]);
        }
    }, [open]);

    const handleOnlineAction = async (item: OnlineModCatalogItem) => {
        const isUpdate = item.installed && item.updateAvailable;
        if (isUpdate && getUpdatePolicyMode(item) === 'replace-confirm' && !confirmReplaceUpdate(item.name)) {
            return;
        }
        setOnlineWorkingId(item.id);
        setOnlineError('');
        try {
            const result = isUpdate
                ? await window.electronAPI.updateOnlineMod(item, getUpdatePolicyMode(item) === 'replace-confirm')
                : await window.electronAPI.downloadOnlineMod(item);
            onImport(result as ModPackage[], item.name);
            setOnlineMods(await window.electronAPI.getOnlineModCatalog());
        } catch (err) {
            setOnlineError(err instanceof Error ? err.message : '온라인 모드 처리 실패');
        } finally {
            setOnlineWorkingId(null);
        }
    };

    const handleShowOnlineReadme = async (item: OnlineModCatalogItem) => {
        if (!item.readmePath) return;
        setOnlineReadmeError('');
        setOnlineReadme({ title: item.name, text: 'README를 불러오는 중입니다.' });
        try {
            const text = await window.electronAPI.getOnlineModReadme(item.readmePath);
            setOnlineReadme({ title: item.name, text });
        } catch (err) {
            setOnlineReadmeError(err instanceof Error ? err.message : 'README를 불러오지 못했습니다.');
        }
    };

    const handleClose = () => {
        reset();
        onClose();
    };

    const handleAddFile = async () => {
        setError('');
        const selected = await window.electronAPI.selectModImportFile();
        releaseNativeDialogFocus();
        if (!selected) return;

        if (selected.toLowerCase().endsWith('.zip')) {
            setLoadingZip(true);
            try {
                const result: ZipInspectResult = await window.electronAPI.inspectZip(selected);
                if (!result.hasModInfo) {
                    setError('ZIP 모드는 mod-info.json 또는 hexx-mod-info.json이 포함된 패킹 ZIP만 추가할 수 있습니다.');
                    return;
                }
                const editable: ZipEditableEntry[] = result.entries.map((e) => ({
                    ...e,
                    selectedType: e.suggestedType,
                    editName: e.modInfoData?.name ?? '',
                    editAuthor: e.modInfoData?.author ?? '',
                    editDependsOn: e.modInfoData?.dependsOn ?? '',
                }));
                setZipPath(selected);
                setZipEntries(editable);
                setZipWarnings(result.warnings);
                setZipPackageType(result.modInfo?.packageType ?? 'single');
                setZipName(result.modInfo?.name ?? selected.split(/[\\/]/).pop()?.replace(/\.zip$/i, '') ?? '');
                setZipAuthor(result.modInfo?.author ?? '');
                setZipDescription(result.modInfo?.description ?? '');
                setZipVersion(result.modInfo?.version ?? '');
                setZipDependency(result.modInfo?.dependency);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'ZIP 분석 실패');
            } finally {
                setLoadingZip(false);
            }
            return;
        }

        if (!selected.toLowerCase().endsWith('.dll')) {
            setError('로컬 모드 추가는 DLL 또는 패킹 ZIP만 지원합니다. MD 파일은 모드 패킹에서 패키지 설명 파일로 추가하세요.');
            return;
        }

        const fileName = selected.split(/[\\/]/).pop() ?? '';
        const baseName = fileName.replace(/\.dll$/i, '');
        setDllFiles((prev) => {
            const next = [...prev, { filePath: selected, name: baseName, author: '', type: 'dll' as ModFileType }];
            if (next.length > 1) setPackageType('collection');
            return next;
        });
        if (!name) setName(baseName);
    };

    const handleImportDll = async () => {
        if (dllFiles.length === 0) { setError('파일을 추가해주세요.'); return; }
        setImporting(true);
        setError('');
        try {
            const result = await window.electronAPI.createAndImportPackage({
                name: name || dllFiles[0]?.name || '알 수 없음',
                author,
                description,
                packageType,
                version: version.trim() || undefined,
                files: dllFiles,
            });
            onImport(result as ModPackage[], name || dllFiles[0]?.name || '모드');
            handleClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : '모드 추가 실패');
        } finally {
            setImporting(false);
        }
    };

    const handleImportZip = async () => {
        if (!zipPath) return;
        if (zipSingleDllError) { setError(zipSingleDllError); return; }
        setImporting(true);
        setError('');
        try {
            const result = await window.electronAPI.importZipConfigured(zipPath, {
                name: zipName,
                author: zipAuthor,
                description: zipDescription,
                packageType: zipPackageType,
                version: zipVersion.trim() || undefined,
                dependency: zipDependency,
                files: zipEntries.map((e) => ({
                    entryName: e.entryName,
                    type: e.selectedType,
                    name: e.editName || undefined,
                    author: e.editAuthor || undefined,
                    dependsOn: e.editDependsOn || undefined,
                })),
            });
            onImport(result as ModPackage[], zipName);
            handleClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'ZIP 추가 실패');
        } finally {
            setImporting(false);
        }
    };

    const updateZipEntry = (idx: number, patch: Partial<ZipEditableEntry>) => {
        setZipEntries((prev) => prev.map((e, i) => (i === idx ? { ...e, ...patch } : e)));
    };

    const deleteZipEntry = (idx: number) => {
        setZipEntries((prev) => prev.filter((_, i) => i !== idx));
    };

    const renderTabs = () => (
        <Tabs
            value={activeTab}
            onChange={(_, value) => setActiveTab(value)}
            sx={{
                minHeight: 38,
                borderBottom: '1px solid var(--border-color)',
                '& .MuiTab-root': { color: 'var(--text-color-light)', minHeight: 38 },
                '& .Mui-selected': { color: 'var(--primary-color)' },
                '& .MuiTabs-indicator': { backgroundColor: 'var(--primary-color)' },
            }}
        >
            <Tab value="online" label="온라인" />
            <Tab value="local" label="로컬" />
        </Tabs>
    );

    const renderOnlineContent = () => (
        <Stack spacing={2}>
            {onlineError && <Alert severity="error">{onlineError}</Alert>}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, alignItems: 'center' }}>
                <Typography sx={{ color: 'var(--text-color-light)', fontSize: 13 }}>
                    GitHub catalog에서 등록된 모드를 확인하고 설치/업데이트합니다.
                </Typography>
                <Button
                    size="small"
                    variant="outlined"
                    startIcon={onlineLoading ? <CircularProgress size={14} /> : <RefreshIcon />}
                    onClick={loadOnlineMods}
                    disabled={onlineLoading}
                    sx={{ borderColor: 'var(--border-color)', color: 'var(--text-color)', whiteSpace: 'nowrap' }}
                >
                    새로고침
                </Button>
            </Box>
            <Stack spacing={1}>
                {onlineMods.map((item) => {
                    const working = onlineWorkingId === item.id;
                    const actionLabel = item.installed
                        ? item.updateAvailable
                            ? '업데이트'
                            : '설치됨'
                        : '다운로드';
                    return (
                        <Box
                            key={item.id}
                            sx={{
                                p: 1.25,
                                borderRadius: 1,
                                border: '1px solid var(--border-color)',
                                background: 'var(--input-bg-color)',
                            }}
                        >
                            <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                    <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                                        <Typography sx={{ color: 'var(--text-color)', fontWeight: 800 }}>
                                            {item.name}
                                        </Typography>
                                        <Chip label={`v${item.version}`} size="small" sx={{ height: 20, fontSize: 11 }} />
                                        {item.installed && (
                                            <Chip
                                                label={item.updateAvailable ? `업데이트 가능: ${item.installedVersion}` : '설치됨'}
                                                size="small"
                                                sx={{
                                                    height: 20,
                                                    fontSize: 11,
                                                    background: item.updateAvailable
                                                        ? 'var(--warn-color, #e6a817)'
                                                        : 'var(--primary-color)',
                                                    color: '#fff',
                                                }}
                                            />
                                        )}
                                    </Stack>
                                    <Typography sx={{ color: 'var(--text-color-light)', fontSize: 12, mt: 0.25 }}>
                                        {item.author || '-'}
                                    </Typography>
                                    <Typography sx={{ color: 'var(--text-color-light)', fontSize: 12, mt: 0.75 }}>
                                        {item.description || '설명 없음'}
                                    </Typography>
                                </Box>
                                <Stack spacing={1} sx={{ alignItems: 'flex-end' }}>
                                <Button
                                    size="small"
                                    variant={item.updateAvailable || !item.installed ? 'contained' : 'outlined'}
                                    startIcon={
                                        working ? (
                                            <CircularProgress size={14} />
                                        ) : item.updateAvailable ? (
                                            <UpdateIcon />
                                        ) : (
                                            <DownloadIcon />
                                        )
                                    }
                                    disabled={working || (item.installed && !item.updateAvailable)}
                                    onClick={() => handleOnlineAction(item)}
                                    sx={{
                                        background:
                                            item.updateAvailable || !item.installed
                                                ? 'var(--button-bg-color)'
                                                : 'transparent',
                                        color:
                                            item.updateAvailable || !item.installed
                                                ? 'var(--button-text-color)'
                                                : 'var(--text-color)',
                                        borderColor: 'var(--border-color)',
                                        whiteSpace: 'nowrap',
                                    }}
                                >
                                    {actionLabel}
                                </Button>
                                {item.readmePath && (
                                    <Button
                                        size="small"
                                        variant="text"
                                        onClick={() => void handleShowOnlineReadme(item)}
                                        sx={{ color: 'var(--primary-color)', minWidth: 0 }}
                                    >
                                        자세히보기
                                    </Button>
                                )}
                                </Stack>
                            </Box>
                        </Box>
                    );
                })}
                {!onlineLoading && onlineMods.length === 0 && (
                    <Typography sx={{ color: 'var(--text-color-light)', textAlign: 'center', py: 3 }}>
                        {onlineError ? '온라인 모드 목록을 표시할 수 없습니다.' : '표시할 온라인 모드가 없습니다.'}
                    </Typography>
                )}
                {onlineLoading && (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                        <CircularProgress size={24} />
                    </Box>
                )}
            </Stack>
        </Stack>
    );

    // ── ZIP mode ────────────────────────────────────────────────────
    if (isZipMode) {
        return (
            <Dialog
                open={open}
                onClose={handleClose}
                maxWidth="md"
                fullWidth
                slotProps={{ paper: { sx: { ...dialogPaperSx, maxHeight: '85vh' } } }}
            >
                <DialogTitle sx={{ color: 'var(--text-color)', borderBottom: '1px solid var(--border-color)' }}>
                    ZIP 모드 추가 — {zipName || '이름 없음'}
                </DialogTitle>
                {renderTabs()}
                <DialogContent sx={{ pt: 2 }}>
                    {activeTab === 'online' ? renderOnlineContent() : (
                    <Stack spacing={2}>
                        {error && <Alert severity="error">{error}</Alert>}
                        {zipSingleDllError && <Alert severity="error">{zipSingleDllError}</Alert>}

                        {zipWarnings.length > 0 && (
                            <Alert
                                severity="warning"
                                icon={<WarningAmberIcon />}
                                sx={{ '& .MuiAlert-message': { fontSize: 12 } }}
                            >
                                <Stack spacing={0.25}>
                                    {zipWarnings.map((w, i) => (
                                        <Typography key={i} variant="caption">{w}</Typography>
                                    ))}
                                </Stack>
                            </Alert>
                        )}

                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                            <Typography sx={{ color: 'var(--text-color)', fontSize: 14, mr: 1 }}>패키지 타입</Typography>
                            {(['single', 'collection'] as const).map((t) => (
                                <Chip
                                    key={t}
                                    label={t === 'single' ? '단일' : '컬렉션'}
                                    size="small"
                                    clickable
                                    onClick={() => setZipPackageType(t)}
                                    sx={{
                                        background: zipPackageType === t ? 'var(--primary-color)' : 'transparent',
                                        color: zipPackageType === t ? '#fff' : 'var(--text-color)',
                                        border: '1px solid var(--border-color)',
                                    }}
                                />
                            ))}
                        </Box>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                            <TextField size="small" label="표시 이름" value={zipName}
                                onChange={(e) => setZipName(e.target.value)} sx={{ ...inputSx, flex: 1 }} />
                            <TextField size="small" label="제작자" value={zipAuthor}
                                onChange={(e) => setZipAuthor(e.target.value)} sx={{ ...inputSx, flex: 1 }} />
                        </Box>
                        <TextField size="small" label="버전" value={zipVersion}
                            onChange={(e) => setZipVersion(e.target.value)} sx={inputSx} fullWidth />
                        <TextField size="small" label="설명" value={zipDescription}
                            onChange={(e) => setZipDescription(e.target.value)}
                            sx={multilineSx} multiline minRows={1} fullWidth />

                        <Divider sx={{ borderColor: 'var(--border-color)' }} />

                        <Typography variant="caption" sx={{ color: 'var(--text-color-light)' }}>
                            ZIP 파일 목록 — 패킹된 mod-info 기준으로 읽기 전용 표시됩니다.
                        </Typography>

                        <ZipEntryTable
                            entries={zipEntries}
                            onChange={updateZipEntry}
                            onDelete={deleteZipEntry}
                            readOnly
                        />
                    </Stack>
                    )}
                </DialogContent>
                <DialogActions sx={{ borderTop: '1px solid var(--border-color)' }}>
                    {activeTab === 'local' && (
                    <Button onClick={() => setZipPath(null)} sx={{ color: 'var(--text-color-light)' }}>뒤로</Button>
                    )}
                    <Button onClick={handleClose} sx={{ color: 'var(--text-color-light)' }}>취소</Button>
                    {activeTab === 'local' && (
                    <Button
                        variant="contained"
                        onClick={handleImportZip}
                        disabled={importing || Boolean(zipSingleDllError)}
                        sx={{ background: 'var(--button-bg-color)', color: 'var(--button-text-color)' }}
                    >
                        {importing ? <CircularProgress size={18} /> : '추가'}
                    </Button>
                    )}
                </DialogActions>
            </Dialog>
        );
    }

    // ── DLL mode ────────────────────────────────────────────────────
    const addFileTooltip =
        'asset이 포함된 모드라면 zip파일을 추가해야 하고,\ndll만 있는 모드라면 dll 또는 dll을 압축한 zip파일을 추가할 수 있습니다.';

    return (
        <Dialog
            open={open}
            onClose={handleClose}
            maxWidth="sm"
            fullWidth
            slotProps={{ paper: { sx: dialogPaperSx } }}
        >
            <DialogTitle sx={{ color: 'var(--text-color)', borderBottom: '1px solid var(--border-color)' }}>
                모드 추가
            </DialogTitle>
            {renderTabs()}
            <DialogContent sx={{ pt: 2 }}>
                {activeTab === 'online' ? renderOnlineContent() : (
                <Stack spacing={2}>
                    {error && <Alert severity="error">{error}</Alert>}

                    <Tooltip title={addFileTooltip} placement="right">
                        <span style={{ alignSelf: 'flex-start' }}>
                            <Button
                                variant="outlined"
                                startIcon={loadingZip ? <CircularProgress size={16} /> : <UploadFileIcon />}
                                onClick={handleAddFile}
                                disabled={importing || loadingZip}
                                sx={{ borderColor: 'var(--border-color)', color: 'var(--text-color)' }}
                            >
                                파일 추가 (DLL / ZIP)
                            </Button>
                        </span>
                    </Tooltip>

                    {dllFiles.length > 0 && (
                        <Box>
                            <Typography variant="caption" sx={{ color: 'var(--text-color-light)' }}>
                                추가된 파일 목록
                            </Typography>
                            <Stack spacing={1} sx={{ mt: 0.5 }}>
                                {dllFiles.map((f, idx) => (
                                    <Box
                                        key={idx}
                                        sx={{
                                            display: 'flex',
                                            gap: 1,
                                            alignItems: 'center',
                                            p: 1,
                                            borderRadius: 1,
                                            border: '1px solid var(--border-color)',
                                            background: 'var(--input-bg-color)',
                                            flexWrap: 'wrap',
                                        }}
                                    >
                                        <Typography
                                            sx={{
                                                color: 'var(--text-color-light)',
                                                fontSize: 12,
                                                flex: '0 0 auto',
                                                maxWidth: 140,
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap',
                                            }}
                                            title={f.filePath}
                                        >
                                            {f.filePath.split(/[\\/]/).pop()}
                                        </Typography>
                                        <Select
                                            value={f.type}
                                            size="small"
                                            disabled
                                            sx={{ ...selectSx, width: 90, opacity: 0.6 }}
                                        >
                                            {FILE_TYPES.map((t) => (
                                                <MenuItem key={t} value={t} sx={{ fontSize: 12 }}>
                                                    {MOD_FILE_TYPE_LABELS[t]}
                                                </MenuItem>
                                            ))}
                                        </Select>
                                        <TextField
                                            size="small"
                                            label="이름"
                                            value={f.name}
                                            onChange={(e) =>
                                                setDllFiles((prev) =>
                                                    prev.map((item, i) =>
                                                        i === idx ? { ...item, name: e.target.value } : item
                                                    )
                                                )
                                            }
                                            sx={{ ...inputSx, flex: 1, minWidth: 80 }}
                                        />
                                        <TextField
                                            size="small"
                                            label="제작자"
                                            value={f.author}
                                            onChange={(e) =>
                                                setDllFiles((prev) =>
                                                    prev.map((item, i) =>
                                                        i === idx ? { ...item, author: e.target.value } : item
                                                    )
                                                )
                                            }
                                            sx={{ ...inputSx, flex: 1, minWidth: 80 }}
                                        />
                                        <IconButton
                                            size="small"
                                            onClick={() => {
                                                setDllFiles((prev) => {
                                                    const next = prev.filter((_, i) => i !== idx);
                                                    if (next.length <= 1) setPackageType('single');
                                                    return next;
                                                });
                                            }}
                                            sx={{ color: 'var(--accent-color)' }}
                                        >
                                            <DeleteIcon fontSize="small" />
                                        </IconButton>
                                    </Box>
                                ))}
                            </Stack>
                        </Box>
                    )}

                    <Divider sx={{ borderColor: 'var(--border-color)' }} />

                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                        <Typography sx={{ color: 'var(--text-color)', fontSize: 14 }}>패키지 타입</Typography>
                        {(['single', 'collection'] as const).map((t) => (
                            <Chip
                                key={t}
                                label={t === 'single' ? '단일' : '컬렉션'}
                                size="small"
                                clickable
                                onClick={() => setPackageType(t)}
                                sx={{
                                    background: packageType === t ? 'var(--primary-color)' : 'transparent',
                                    color: packageType === t ? '#fff' : 'var(--text-color)',
                                    border: '1px solid var(--border-color)',
                                }}
                            />
                        ))}
                    </Box>
                    <TextField label="표시 이름" value={name} onChange={(e) => setName(e.target.value)} sx={inputSx} />
                    <TextField label="제작자" value={author} onChange={(e) => setAuthor(e.target.value)} sx={inputSx} />
                    <TextField label="버전" value={version} onChange={(e) => setVersion(e.target.value)} sx={inputSx} />
                    <TextField
                        label="설명"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        multiline
                        minRows={2}
                        sx={multilineSx}
                    />
                </Stack>
                )}
            </DialogContent>
            <DialogActions sx={{ borderTop: '1px solid var(--border-color)' }}>
                <Button onClick={handleClose} sx={{ color: 'var(--text-color-light)' }}>취소</Button>
                {activeTab === 'local' && (
                <Button
                    variant="contained"
                    onClick={handleImportDll}
                    disabled={importing || dllFiles.length === 0}
                    sx={{ background: 'var(--button-bg-color)', color: 'var(--button-text-color)' }}
                >
                    {importing ? <CircularProgress size={18} /> : '추가'}
                </Button>
                )}
            </DialogActions>
            <Dialog
                open={Boolean(onlineReadme)}
                onClose={() => {
                    setOnlineReadme(null);
                    setOnlineReadmeError('');
                }}
                maxWidth="md"
                fullWidth
                slotProps={{ paper: { sx: { ...dialogPaperSx, maxHeight: '80vh' } } }}
            >
                <DialogTitle sx={{ color: 'var(--text-color)' }}>{onlineReadme?.title || '자세히보기'}</DialogTitle>
                <DialogContent>
                    {onlineReadmeError ? (
                        <Alert severity="error">{onlineReadmeError}</Alert>
                    ) : (
                        <Typography component="pre" sx={{ color: 'var(--text-color)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'inherit', fontSize: 13 }}>
                            {onlineReadme?.text || ''}
                        </Typography>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOnlineReadme(null)} sx={{ color: 'var(--text-color)' }}>닫기</Button>
                </DialogActions>
            </Dialog>
        </Dialog>
    );
}

const emptyDistributionForm = (): ModDistributionForm => ({
    id: '',
    name: '',
    author: 'HexX',
    description: '',
    version: '1.0.0',
    zipPath: '',
    readmeFilePath: '',
    readmePath: '',
    updatePolicyMode: 'replace-confirm',
    updatePolicyPreserveText: '',
    updatePolicyRemoveMissing: false,
    downloadPath: '',
    sha256: '',
    gameIdsText: 'long-yin-li-zhi-zhuan',
});

function distributionFormFromItem(item: OnlineModCatalogItem): ModDistributionForm {
    return {
        id: item.id,
        name: item.name,
        author: item.author,
        description: item.description,
        version: item.version,
        zipPath: '',
        readmeFilePath: '',
        readmePath: item.readmePath || '',
        updatePolicyMode: item.updatePolicy?.mode || 'replace-confirm',
        updatePolicyPreserveText: (item.updatePolicy?.preserve || []).join('\n'),
        updatePolicyRemoveMissing: item.updatePolicy?.removeMissing === true,
        downloadPath: item.downloadPath,
        sha256: item.sha256 || '',
        gameIdsText: (item.gameIds || []).join(', '),
    };
}

function parseGameIds(value: string): string[] {
    return value
        .split(/[\n,]/)
        .map((item) => item.trim())
        .filter(Boolean);
}

function bumpPatchVersion(version: string): string {
    const match = version.trim().match(/^(v?)(\d+)(?:\.(\d+))?(?:\.(\d+))?(.*)$/i);
    if (!match) return version.trim() || '1.0.0';
    const prefix = match[1] || '';
    const major = Number(match[2] || 0);
    const minor = Number(match[3] || 0);
    const patch = Number(match[4] || 0) + 1;
    const suffix = match[5] || '';
    return `${prefix}${major}.${minor}.${patch}${suffix}`;
}

function ModDeveloperToolsDialog({
    open,
    onClose,
    onOpenDistribution,
}: {
    open: boolean;
    onClose: () => void;
    onOpenDistribution: () => void;
}) {
    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth slotProps={{ paper: { sx: dialogPaperSx } }}>
            <DialogTitle sx={{ color: 'var(--text-color)', fontWeight: 800 }}>개발자 전용 도구</DialogTitle>
            <DialogContent>
                <Alert severity="warning" sx={{ mb: 2 }}>
                    이 창은 온라인 모드 배포 catalog와 packages 폴더를 직접 수정합니다. 변경 후 커밋 전에 생성된 파일 경로와 JSON 내용을 확인하세요.
                </Alert>
                <Paper sx={{ p: 1.5, background: 'var(--bg-color)', border: '1px solid var(--border-color)' }}>
                    <Typography sx={{ color: 'var(--text-color)', fontWeight: 800 }}>온라인 모드 배포</Typography>
                    <Typography sx={{ color: 'var(--text-color-light)', fontSize: 13, mt: 0.5 }}>
                        mods/index.json과 mods/packages 폴더를 생성, 수정, 삭제합니다.
                    </Typography>
                    <Button
                        variant="outlined"
                        onClick={onOpenDistribution}
                        sx={{ mt: 1, borderColor: 'var(--border-color)', color: 'var(--text-color)' }}
                    >
                        열기
                    </Button>
                </Paper>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} sx={{ color: 'var(--text-color)' }}>닫기</Button>
            </DialogActions>
        </Dialog>
    );
}

function ModDistributionDialog({
    open,
    onClose,
    onSaved,
}: {
    open: boolean;
    onClose: () => void;
    onSaved: () => void;
}) {
    const [items, setItems] = useState<OnlineModCatalogItem[]>([]);
    const [selectedId, setSelectedId] = useState('');
    const [form, setForm] = useState<ModDistributionForm>(() => emptyDistributionForm());
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [resultText, setResultText] = useState('');

    const loadItems = async () => {
        setLoading(true);
        setError('');
        try {
            setItems(await window.electronAPI.getModDistributionCatalog());
        } catch (err) {
            setItems([]);
            setError(err instanceof Error ? err.message : 'mods/index.json을 불러오지 못했습니다.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (open) void loadItems();
    }, [open]);

    const updateForm = (patch: Partial<ModDistributionForm>) => {
        setForm((prev) => ({ ...prev, ...patch }));
    };

    const handleSelectItem = (item: OnlineModCatalogItem) => {
        setSelectedId(item.id);
        setForm(distributionFormFromItem(item));
        setError('');
        setResultText('');
    };

    const handleNew = () => {
        setSelectedId('');
        setForm(emptyDistributionForm());
        setError('');
        setResultText('');
    };

    const handlePrepareNextVersion = () => {
        updateForm({
            version: bumpPatchVersion(form.version),
            zipPath: '',
            downloadPath: '',
            sha256: '',
        });
        setError('');
        setResultText('새 버전 번호를 준비했습니다. 새 ZIP을 선택한 뒤 저장하세요.');
    };

    const handleSelectZip = async () => {
        const selected = await window.electronAPI.selectFile('.zip');
        if (!selected) return;
        const fileName = selected.split(/[\\/]/).pop() || '';
        const baseName = fileName.replace(/\.zip$/i, '');
        updateForm({
            zipPath: selected,
            id: form.id || baseName,
            name: form.name || baseName,
        });
    };

    const handleSelectReadme = async () => {
        const selected = await window.electronAPI.selectFile('.md,.markdown');
        if (!selected) return;
        updateForm({ readmeFilePath: selected });
    };

    const handleSave = async () => {
        setSaving(true);
        setError('');
        setResultText('');
        try {
            const result = await window.electronAPI.saveModDistributionItem({
                id: form.id,
                name: form.name,
                author: form.author,
                description: form.description,
                version: form.version,
                zipPath: form.zipPath || undefined,
                readmeFilePath: form.readmeFilePath || undefined,
                readmePath: form.readmePath || undefined,
                updatePolicy: {
                    mode: form.updatePolicyMode,
                    preserve: form.updatePolicyPreserveText
                        .split(/\r?\n|,/)
                        .map((item) => normalizePackPath(item.trim()).replace(/\/+$/, ''))
                        .filter(Boolean),
                    removeMissing: form.updatePolicyRemoveMissing,
                },
                downloadPath: form.downloadPath || undefined,
                sha256: form.sha256 || undefined,
                gameIds: parseGameIds(form.gameIdsText),
            });
            setResultText([
                `index: ${result.indexPath}`,
                result.zipPath ? `zip: ${result.zipPath}` : '',
                `downloadPath: ${result.item.downloadPath}`,
            ].filter(Boolean).join('\n'));
            setSelectedId(result.item.id);
            setForm(distributionFormFromItem(result.item));
            await loadItems();
            onSaved();
        } catch (err) {
            setError(err instanceof Error ? err.message : '온라인 모드 배포 정보 저장 실패');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (item: OnlineModCatalogItem) => {
        const ok = window.confirm(`온라인 catalog에서 삭제할까요?\n${item.name}\n\nmods/packages/${item.id} 폴더도 함께 삭제됩니다.`);
        if (!ok) return;
        setSaving(true);
        setError('');
        setResultText('');
        try {
            const result = await window.electronAPI.deleteModDistributionItem(item.id);
            setResultText([
                `index: ${result.indexPath}`,
                result.deletedPackageDir ? `deleted: ${result.deletedPackageDir}` : '',
            ].filter(Boolean).join('\n'));
            if (selectedId === item.id) handleNew();
            await loadItems();
            onSaved();
        } catch (err) {
            setError(err instanceof Error ? err.message : '온라인 모드 삭제 실패');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="lg"
            fullWidth
            slotProps={{ paper: { sx: { ...dialogPaperSx, maxHeight: '88vh' } } }}
        >
            <DialogTitle sx={{ color: 'var(--text-color)', fontWeight: 800 }}>온라인 모드 배포 Catalog</DialogTitle>
            <DialogContent sx={{ pt: 1 }}>
                <Typography sx={{ color: 'var(--text-color-light)', mb: 2, fontSize: 13 }}>
                    ZIP을 선택해 배포 파일을 만들면 mods/packages와 mods/index.json이 갱신됩니다. GitHub 반영은 생성된 파일을 커밋하고 push한 뒤 확인하세요.
                </Typography>
                {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                    <Paper sx={{ flex: '1 1 42%', minWidth: 320, p: 1.5, background: 'var(--bg-color)', border: '1px solid var(--border-color)' }}>
                        <Stack direction="row" spacing={1} sx={{ mb: 1, justifyContent: 'space-between' }}>
                            <Typography sx={{ color: 'var(--text-color)', fontWeight: 800 }}>등록된 온라인 모드</Typography>
                            <Button size="small" onClick={() => void loadItems()} disabled={loading} sx={{ color: 'var(--text-color)' }}>
                                새로고침
                            </Button>
                        </Stack>
                        <TableContainer sx={{ maxHeight: 430 }}>
                            <Table size="small" stickyHeader>
                                <TableHead>
                                    <TableRow>
                                        <TableCell sx={{ color: 'var(--text-color)', background: 'var(--sidebar-bg-color)' }}>모드</TableCell>
                                        <TableCell sx={{ color: 'var(--text-color)', background: 'var(--sidebar-bg-color)', width: 90 }}>버전</TableCell>
                                        <TableCell sx={{ color: 'var(--text-color)', background: 'var(--sidebar-bg-color)', width: 110 }} />
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {items.map((item) => (
                                        <TableRow
                                            key={item.id}
                                            selected={selectedId === item.id}
                                            hover
                                            sx={{ cursor: 'pointer' }}
                                            onClick={() => handleSelectItem(item)}
                                        >
                                            <TableCell sx={{ color: 'var(--text-color)' }}>
                                                <Typography sx={{ fontWeight: 700, fontSize: 13 }}>{item.name}</Typography>
                                                <Typography sx={{ color: 'var(--text-color-light)', fontSize: 11 }}>{item.id}</Typography>
                                            </TableCell>
                                            <TableCell sx={{ color: 'var(--text-color-light)' }}>{item.version}</TableCell>
                                            <TableCell>
                                                <Button
                                                    size="small"
                                                    color="error"
                                                    disabled={saving}
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        void handleDelete(item);
                                                    }}
                                                >
                                                    삭제
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {!loading && items.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={3} sx={{ color: 'var(--text-color-light)', textAlign: 'center', py: 3 }}>
                                                등록된 온라인 모드가 없습니다.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </Paper>
                    <Paper sx={{ flex: '1 1 58%', p: 1.5, background: 'var(--bg-color)', border: '1px solid var(--border-color)' }}>
                        <Stack direction="row" spacing={1} sx={{ mb: 1, justifyContent: 'space-between' }}>
                            <Typography sx={{ color: 'var(--text-color)', fontWeight: 800 }}>
                                {selectedId ? '모드 수정' : '모드 추가'}
                            </Typography>
                            <Stack direction="row" spacing={1}>
                                {selectedId && (
                                    <Button size="small" onClick={handlePrepareNextVersion} sx={{ color: 'var(--primary-color)' }}>
                                        다음 버전 준비
                                    </Button>
                                )}
                                <Button size="small" onClick={handleNew} sx={{ color: 'var(--text-color)' }}>새 항목</Button>
                            </Stack>
                        </Stack>
                        <Stack spacing={1.25}>
                            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', rowGap: 1 }}>
                                <TextField
                                    size="small"
                                    label="id"
                                    value={form.id}
                                    disabled={Boolean(selectedId)}
                                    onChange={(e) => updateForm({ id: e.target.value })}
                                    helperText={selectedId ? 'id 변경은 새 항목으로 생성하세요.' : ''}
                                    sx={{ ...inputSx, flex: '1 1 180px' }}
                                />
                                <TextField size="small" label="모드 이름" value={form.name} onChange={(e) => updateForm({ name: e.target.value })} sx={{ ...inputSx, flex: '1 1 220px' }} />
                                <TextField size="small" label="version" value={form.version} onChange={(e) => updateForm({ version: e.target.value })} sx={{ ...inputSx, flex: '1 1 120px' }} />
                                <TextField size="small" label="제작자" value={form.author} onChange={(e) => updateForm({ author: e.target.value })} sx={{ ...inputSx, flex: '1 1 160px' }} />
                            </Stack>
                            <TextField
                                size="small"
                                label="설명"
                                value={form.description}
                                onChange={(e) => updateForm({ description: e.target.value })}
                                multiline
                                minRows={3}
                                sx={multilineSx}
                            />
                            <TextField
                                size="small"
                                label="gameIds"
                                value={form.gameIdsText}
                                onChange={(e) => updateForm({ gameIdsText: e.target.value })}
                                helperText="쉼표 또는 줄바꿈으로 구분합니다. 용윤입지전: long-yin-li-zhi-zhuan"
                                sx={inputSx}
                            />
                            <Box sx={{ p: 1.25, border: '1px solid var(--border-color)', borderRadius: 1 }}>
                                <Typography sx={{ color: 'var(--text-color)', fontWeight: 800, mb: 1 }}>
                                    업데이트 정책
                                </Typography>
                                <Stack spacing={1}>
                                    <Select
                                        size="small"
                                        value={form.updatePolicyMode}
                                        onChange={(e) => updateForm({ updatePolicyMode: e.target.value as ModUpdatePolicy['mode'] })}
                                        sx={selectSx}
                                        MenuProps={selectMenuProps}
                                    >
                                        <MenuItem value="replace-confirm">새로 설치 필요 (확인 후 교체)</MenuItem>
                                        <MenuItem value="merge">보존 경로 유지 후 병합</MenuItem>
                                        <MenuItem value="overwrite">단순 덮어쓰기</MenuItem>
                                    </Select>
                                    {form.updatePolicyMode === 'merge' && (
                                        <>
                                            <TextField
                                                size="small"
                                                label="보존 경로"
                                                value={form.updatePolicyPreserveText}
                                                onChange={(e) => updateForm({ updatePolicyPreserveText: e.target.value })}
                                                helperText="한 줄에 하나씩 입력합니다. 예: config/MyMod.cfg, plugins/ResourceInjector/packs"
                                                multiline
                                                minRows={3}
                                                sx={multilineSx}
                                            />
                                            <FormControlLabel
                                                control={
                                                    <Checkbox
                                                        checked={form.updatePolicyRemoveMissing}
                                                        onChange={(e) => updateForm({ updatePolicyRemoveMissing: e.target.checked })}
                                                    />
                                                }
                                                label={<Typography sx={{ color: 'var(--text-color)' }}>새 ZIP에 없는 비보존 파일 삭제</Typography>}
                                            />
                                        </>
                                    )}
                                </Stack>
                            </Box>
                            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                                <Button variant="outlined" startIcon={<UploadFileIcon />} onClick={handleSelectZip} sx={{ borderColor: 'var(--border-color)', color: 'var(--text-color)' }}>
                                    ZIP 선택
                                </Button>
                                <Typography sx={{ color: 'var(--text-color-light)', fontSize: 12, wordBreak: 'break-all' }}>
                                    {form.zipPath || 'ZIP을 새로 선택하지 않으면 기존 downloadPath를 유지합니다.'}
                                </Typography>
                            </Stack>
                            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                                <Button variant="outlined" startIcon={<UploadFileIcon />} onClick={handleSelectReadme} sx={{ borderColor: 'var(--border-color)', color: 'var(--text-color)' }}>
                                    README MD 선택
                                </Button>
                                <Typography sx={{ color: 'var(--text-color-light)', fontSize: 12, wordBreak: 'break-all' }}>
                                    {form.readmeFilePath || '온라인 카드의 자세히보기에서 표시할 MD 파일을 선택할 수 있습니다.'}
                                </Typography>
                            </Stack>
                            <TextField
                                size="small"
                                label="readmePath"
                                value={form.readmePath}
                                onChange={(e) => updateForm({ readmePath: e.target.value })}
                                helperText="MD 선택 시 자동 생성됩니다. 기존 항목 metadata만 수정할 때는 유지됩니다."
                                sx={inputSx}
                            />
                            <TextField
                                size="small"
                                label="downloadPath"
                                value={form.downloadPath}
                                onChange={(e) => updateForm({ downloadPath: e.target.value })}
                                helperText="ZIP 선택 시 자동 생성됩니다. 기존 항목 metadata만 수정할 때는 유지됩니다."
                                sx={inputSx}
                            />
                            <TextField
                                size="small"
                                label="sha256"
                                value={form.sha256}
                                onChange={(e) => updateForm({ sha256: e.target.value })}
                                helperText="ZIP 선택 시 자동 계산됩니다."
                                sx={inputSx}
                            />
                            {resultText && (
                                <Alert severity="success">
                                    <Typography component="pre" sx={{ m: 0, whiteSpace: 'pre-wrap', fontSize: 12 }}>
                                        {resultText}
                                    </Typography>
                                </Alert>
                            )}
                        </Stack>
                    </Paper>
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} sx={{ color: 'var(--text-color)' }}>닫기</Button>
                <Button variant="contained" onClick={handleSave} disabled={saving} sx={{ background: 'var(--button-bg-color)', color: 'var(--button-text-color)' }}>
                    저장
                </Button>
            </DialogActions>
        </Dialog>
    );
}

// ── Table row cells helper ─────────────────────────────────────────

const cellSx = { py: 0.75, px: 1.5 };

function sanitizeExportFileName(value: string): string {
    return (value || 'mod').replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').trim() || 'mod';
}

// ── Main Component ─────────────────────────────────────────────────

export default function ModManager() {
    const { showNotification } = useNotification();

    const [currentLanguage, setCurrentLanguage] = useState<LanguageCode>('en');
    const [packages, setPackages] = useState<ModPackage[]>([]);
    const [onlineCatalog, setOnlineCatalog] = useState<OnlineModCatalogItem[]>([]);
    const [updatingPackageId, setUpdatingPackageId] = useState<string | null>(null);
    const [exportingPackageId, setExportingPackageId] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
    const [expandedDependencyIds, setExpandedDependencyIds] = useState<Set<string>>(new Set());

    const [ctxMenu, setCtxMenu] = useState<CtxMenuState | null>(null);
    const [addDialogOpen, setAddDialogOpen] = useState(false);
    const [packDialogOpen, setPackDialogOpen] = useState(false);
    const [developerGateOpen, setDeveloperGateOpen] = useState(false);
    const [developerToolsOpen, setDeveloperToolsOpen] = useState(false);
    const [modDistributionOpen, setModDistributionOpen] = useState(false);
    const [detailPkg, setDetailPkg] = useState<ModPackage | null>(null);
    const [settingsPkgId, setSettingsPkgId] = useState<string | null>(null);

    const loadMods = async () => {
        setLoading(true);
        try {
            const [result, catalog] = await Promise.all([
                window.electronAPI.scanMods(),
                window.electronAPI.getOnlineModCatalog().catch(() => [] as OnlineModCatalogItem[]),
            ]);
            setPackages(result as ModPackage[]);
            setOnlineCatalog(catalog);
        } catch (err) {
            showNotification(err instanceof Error ? err.message : '모드 스캔 실패', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void loadMods();
        window.electronAPI.getSettings().then((settings) => {
            setCurrentLanguage(getSafeLanguage(settings.language));
        });
    }, []);

    useDeveloperShortcut(() => setDeveloperGateOpen(true));

    const handleToggleExpand = (id: string) => {
        setExpandedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleToggleDependencyExpand = (id: string) => {
        setExpandedDependencyIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handlePackageToggle = async (packageId: string, enabled: boolean) => {
        try {
            const raw = await window.electronAPI.setPackageEnabled(packageId, enabled);
            const { packages: pkgs, warnings } = parseToggleResult(raw);
            setPackages(pkgs);
            for (const w of warnings) {
                showNotification(w, 'warning');
            }
        } catch (err) {
            showNotification(err instanceof Error ? err.message : '모드 상태 변경 실패', 'error');
        }
    };

    const handleDllToggle = async (relativePath: string, enabled: boolean) => {
        try {
            const raw = await window.electronAPI.setDllEnabled(relativePath, enabled);
            const { packages: pkgs, warnings } = parseToggleResult(raw);
            setPackages(pkgs);
            for (const w of warnings) {
                showNotification(w, 'warning');
            }
        } catch (err) {
            showNotification(err instanceof Error ? err.message : '모드 상태 변경 실패', 'error');
        }
    };

    const handleDelete = async (packageId: string, pkgName: string) => {
        const ok = window.confirm(`정말 삭제할까요?\n${pkgName}`);
        if (!ok) return;
        try {
            const result = await window.electronAPI.deletePackage(packageId);
            setPackages(result as ModPackage[]);
            showNotification(`모드 삭제 완료: ${pkgName}`);
        } catch (err) {
            showNotification(err instanceof Error ? err.message : '모드 삭제 실패', 'error');
        }
    };

    const getCatalogItemForPackage = (pkg: ModPackage) =>
        pkg.source?.type === 'github'
            ? onlineCatalog.find((item) => item.id === pkg.source?.catalogId)
            : undefined;

    const handlePackageUpdate = async (pkg: ModPackage) => {
        const item = getCatalogItemForPackage(pkg);
        if (!item) return;
        const policyMode = getUpdatePolicyMode(item.updatePolicy ? item : pkg);
        if (policyMode === 'replace-confirm' && !confirmReplaceUpdate(pkg.name)) {
            return;
        }
        setUpdatingPackageId(pkg.id);
        try {
            const result = await window.electronAPI.updateOnlineMod(item, policyMode === 'replace-confirm');
            setPackages(result as ModPackage[]);
            setOnlineCatalog(await window.electronAPI.getOnlineModCatalog());
            showNotification(`모드 업데이트 완료: ${pkg.name}`);
        } catch (err) {
            showNotification(err instanceof Error ? err.message : '모드 업데이트 실패', 'error');
        } finally {
            setUpdatingPackageId(null);
        }
    };

    const handlePackageExport = async (pkg: ModPackage) => {
        const defaultName = sanitizeExportFileName(`${pkg.name}-${pkg.version || 'export'}`);
        try {
            const selected = await window.electronAPI.selectSavePath(defaultName);
            if (!selected) return;
            setExportingPackageId(pkg.id);
            const exportedPath = await window.electronAPI.exportPackage(pkg.id, selected);
            showNotification(`모드 내보내기 완료: ${exportedPath}`);
        } catch (err) {
            showNotification(err instanceof Error ? err.message : '모드 내보내기 실패', 'error');
        } finally {
            setExportingPackageId(null);
        }
    };

    const handleCtxMenu = (e: ReactMouseEvent, pkg: ModPackage) => {
        e.preventDefault();
        setCtxMenu({
            mouseX: e.clientX,
            mouseY: e.clientY,
            packageId: pkg.id,
            hasSettings: pkg.hasSettings,
        });
    };

    const ctxPkg = ctxMenu ? packages.find((p) => p.id === ctxMenu.packageId) : null;

    const headCellSx = { color: 'var(--text-color)', fontWeight: 700, py: 1, px: 1.5 };

    const enabledState = (pkg: ModPackage): boolean | 'indeterminate' => {
        if (pkg.enabled === 'mixed') return 'indeterminate';
        return pkg.enabled as boolean;
    };

    const packageRows = buildPackageTreeRows(packages, expandedDependencyIds);

    return (
        <Box>
            {/* ── Header ── */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                    <Typography variant="h5" sx={{ fontWeight: 800, color: 'var(--text-color)' }}>
                        {t('nav.modForge', currentLanguage)}
                    </Typography>
                    <Typography sx={{ mt: 0.5, color: 'var(--text-color-light)' }}>
                        BepInEx/plugins 안의 DLL 파일을 활성/비활성 관리합니다.
                    </Typography>
                </Box>
                <Stack direction="row" spacing={1}>
                    <Button
                        variant="contained"
                        startIcon={loading ? <CircularProgress size={16} /> : <RefreshIcon />}
                        onClick={() => void loadMods()}
                        disabled={loading}
                        sx={{ background: 'var(--button-bg-color)', color: 'var(--button-text-color)' }}
                    >
                        새로고침
                    </Button>
                    <Button
                        variant="outlined"
                        startIcon={<ArchiveIcon />}
                        onClick={() => setPackDialogOpen(true)}
                        sx={{ borderColor: 'var(--border-color)', color: 'var(--text-color)' }}
                    >
                        모드 패킹
                    </Button>
                    <Button
                        variant="contained"
                        startIcon={<AddIcon />}
                        onClick={() => setAddDialogOpen(true)}
                        sx={{ background: 'var(--button-bg-color)', color: 'var(--button-text-color)' }}
                    >
                        모드 추가
                    </Button>
                </Stack>
            </Box>

            {/* ── Table ── */}
            <TableContainer
                component={Paper}
                sx={{
                    mt: 2,
                    background: 'var(--sidebar-bg-color)',
                    border: '1px solid var(--border-color)',
                    boxShadow: 'var(--shadow-small)',
                    overflowX: 'auto',
                }}
            >
                <Table size="small">
                    <TableHead>
                        <TableRow>
                            <TableCell sx={{ ...headCellSx, width: 48 }}>사용</TableCell>
                            <TableCell sx={{ ...headCellSx, width: 32 }} />
                            <TableCell sx={headCellSx}>모드 이름</TableCell>
                            <TableCell sx={headCellSx}>제작자</TableCell>
                            <TableCell sx={{ ...headCellSx, width: 120 }}>버전</TableCell>
                            <TableCell sx={{ ...headCellSx, width: 80 }}>상태</TableCell>
                            <TableCell sx={{ ...headCellSx, width: 92 }}>업데이트</TableCell>
                            <TableCell sx={{ ...headCellSx, width: 48 }}>내보내기</TableCell>
                            <TableCell sx={{ ...headCellSx, width: 48 }}>설정</TableCell>
                            <TableCell sx={{ ...headCellSx, width: 48 }}>삭제</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {packageRows.map(({ pkg, depth, hasDependents }) => {
                            const isExpanded = expandedIds.has(pkg.id);
                            const isDependencyExpanded = expandedDependencyIds.has(pkg.id);
                            const isDisabled = pkg.enabled === false;
                            const state = enabledState(pkg);
                            const catalogItem = getCatalogItemForPackage(pkg);
                            const updateAvailable = Boolean(catalogItem?.updateAvailable);
                            const dependencyWarning =
                                pkg.dependencyState === 'missing'
                                    ? '메인 모드 없음'
                                    : pkg.dependencyState === 'disabled'
                                      ? '메인 모드 비활성'
                                      : '';

                            return [
                                <TableRow
                                    key={pkg.id}
                                    onContextMenu={(e) => handleCtxMenu(e, pkg)}
                                    sx={{
                                        cursor: 'context-menu',
                                        opacity: isDisabled ? 0.45 : 1,
                                        transition: 'background 0.15s',
                                        '&:hover': {
                                            background: 'var(--hover-bg-color, rgba(255,255,255,0.04))',
                                        },
                                    }}
                                >
                                    <TableCell sx={cellSx}>
                                        <Checkbox
                                            checked={state === true}
                                            indeterminate={state === 'indeterminate'}
                                            onChange={(e) => void handlePackageToggle(pkg.id, e.target.checked)}
                                            size="small"
                                            sx={{
                                                color: 'var(--text-color-light)',
                                                '&.Mui-checked': { color: 'var(--primary-color)' },
                                                '&.MuiCheckbox-indeterminate': { color: 'var(--primary-color)' },
                                            }}
                                        />
                                    </TableCell>
                                    <TableCell sx={cellSx}>
                                        <Stack direction="row" spacing={0.25} sx={{ alignItems: 'center' }}>
                                        {hasDependents && (
                                            <IconButton
                                                size="small"
                                                onClick={() => handleToggleDependencyExpand(pkg.id)}
                                                sx={{ color: 'var(--primary-color)', p: 0 }}
                                            >
                                                {isDependencyExpanded ? <ExpandMoreIcon fontSize="small" /> : <ChevronRightIcon fontSize="small" />}
                                            </IconButton>
                                        )}
                                        {pkg.packageType === 'collection' && (
                                            <IconButton
                                                size="small"
                                                onClick={() => handleToggleExpand(pkg.id)}
                                                sx={{ color: 'var(--text-color-light)', p: 0 }}
                                            >
                                                {isExpanded ? (
                                                    <ExpandMoreIcon fontSize="small" />
                                                ) : (
                                                    <ChevronRightIcon fontSize="small" />
                                                )}
                                            </IconButton>
                                        )}
                                        </Stack>
                                    </TableCell>
                                    <TableCell sx={{ ...cellSx, color: 'var(--text-color)', fontWeight: 600, pl: 1.5 + depth * 3 }}>
                                        {depth > 0 && (
                                            <Typography component="span" sx={{ color: 'var(--text-color-light)', mr: 1 }}>
                                                └
                                            </Typography>
                                        )}
                                        {pkg.name}
                                        {pkg.dependency && (
                                            <Chip
                                                label="종속"
                                                size="small"
                                                sx={{
                                                    ml: 1,
                                                    fontSize: 10,
                                                    height: 18,
                                                    background: 'rgba(80, 160, 255, 0.16)',
                                                    color: 'var(--text-color)',
                                                }}
                                            />
                                        )}
                                        {dependencyWarning && (
                                            <Chip
                                                label={dependencyWarning}
                                                size="small"
                                                color="warning"
                                                sx={{ ml: 1, fontSize: 10, height: 18 }}
                                            />
                                        )}
                                        {pkg.packageType === 'collection' && (
                                            <Chip
                                                label="컬렉션"
                                                size="small"
                                                sx={{
                                                    ml: 1,
                                                    fontSize: 10,
                                                    height: 18,
                                                    background: 'var(--primary-color)',
                                                    color: '#fff',
                                                }}
                                            />
                                        )}
                                    </TableCell>
                                    <TableCell sx={{ ...cellSx, color: 'var(--text-color-light)' }}>
                                        {pkg.author || '-'}
                                    </TableCell>
                                    <TableCell sx={{ ...cellSx, color: 'var(--text-color-light)' }}>
                                        {pkg.version ? (
                                            <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                                                <Typography component="span" sx={{ color: 'var(--text-color-light)', fontSize: 12 }}>
                                                    v{pkg.version}
                                                </Typography>
                                                {pkg.source?.type === 'github' && (
                                                    <Chip label="GitHub" size="small" sx={{ height: 18, fontSize: 10 }} />
                                                )}
                                            </Stack>
                                        ) : '-'}
                                    </TableCell>
                                    <TableCell sx={cellSx}>
                                        <Chip
                                            label={
                                                pkg.enabled === 'mixed'
                                                    ? '혼합'
                                                    : pkg.enabled
                                                      ? '활성'
                                                      : '비활성'
                                            }
                                            size="small"
                                            sx={{
                                                fontSize: 11,
                                                height: 20,
                                                background:
                                                    pkg.enabled === 'mixed'
                                                        ? 'var(--warn-color, #e6a817)'
                                                        : pkg.enabled
                                                          ? 'var(--primary-color)'
                                                          : 'var(--accent-color)',
                                                color: '#fff',
                                            }}
                                        />
                                    </TableCell>
                                    <TableCell sx={cellSx}>
                                        {pkg.source?.type === 'github' ? (
                                            <Tooltip title={updateAvailable ? `최신 v${catalogItem?.version}` : '최신 버전입니다'}>
                                                <span>
                                                    <IconButton
                                                        size="small"
                                                        disabled={!updateAvailable || updatingPackageId === pkg.id}
                                                        onClick={() => void handlePackageUpdate(pkg)}
                                                        sx={{
                                                            color: updateAvailable ? 'var(--primary-color)' : 'var(--text-color-light)',
                                                            opacity: updateAvailable ? 1 : 0.35,
                                                        }}
                                                    >
                                                        {updatingPackageId === pkg.id ? (
                                                            <CircularProgress size={16} />
                                                        ) : (
                                                            <UpdateIcon fontSize="small" />
                                                        )}
                                                    </IconButton>
                                                </span>
                                            </Tooltip>
                                        ) : (
                                            <Typography sx={{ color: 'var(--text-color-light)', fontSize: 12 }}>-</Typography>
                                        )}
                                    </TableCell>
                                    <TableCell sx={cellSx}>
                                        <Tooltip title="배포용 ZIP으로 내보내기">
                                            <span>
                                                <IconButton
                                                    size="small"
                                                    disabled={exportingPackageId === pkg.id}
                                                    onClick={() => void handlePackageExport(pkg)}
                                                    sx={{ color: 'var(--text-color)' }}
                                                >
                                                    {exportingPackageId === pkg.id ? (
                                                        <CircularProgress size={16} />
                                                    ) : (
                                                        <DownloadIcon fontSize="small" />
                                                    )}
                                                </IconButton>
                                            </span>
                                        </Tooltip>
                                    </TableCell>
                                    <TableCell sx={cellSx}>
                                        <Tooltip title={pkg.hasSettings ? '설정' : '설정 없음'}>
                                            <span>
                                                <IconButton
                                                    size="small"
                                                    disabled={!pkg.hasSettings}
                                                    onClick={() => setSettingsPkgId(pkg.id)}
                                                    sx={{
                                                        color: pkg.hasSettings
                                                            ? 'var(--text-color)'
                                                            : 'var(--text-color-light)',
                                                        opacity: pkg.hasSettings ? 1 : 0.35,
                                                    }}
                                                >
                                                    <SettingsIcon fontSize="small" />
                                                </IconButton>
                                            </span>
                                        </Tooltip>
                                    </TableCell>
                                    <TableCell sx={cellSx}>
                                        <IconButton
                                            size="small"
                                            onClick={() => void handleDelete(pkg.id, pkg.name)}
                                            sx={{ color: 'var(--accent-color)' }}
                                        >
                                            <DeleteIcon fontSize="small" />
                                        </IconButton>
                                    </TableCell>
                                </TableRow>,

                                ...(isExpanded
                                    ? pkg.dlls.map((dll) => (
                                          <TableRow
                                              key={dll.relativePath}
                                              sx={{
                                                  opacity: dll.enabled ? 1 : 0.45,
                                                  background: 'var(--input-bg-color, rgba(0,0,0,0.1))',
                                                  '&:hover': {
                                                      background:
                                                          'var(--hover-bg-color, rgba(255,255,255,0.04))',
                                                  },
                                              }}
                                          >
                                              <TableCell sx={cellSx}>
                                                  <Checkbox
                                                      checked={dll.enabled}
                                                      onChange={(e) =>
                                                          void handleDllToggle(dll.relativePath, e.target.checked)
                                                      }
                                                      size="small"
                                                      sx={{
                                                          color: 'var(--text-color-light)',
                                                          '&.Mui-checked': { color: 'var(--primary-color)' },
                                                      }}
                                                  />
                                              </TableCell>
                                              <TableCell sx={cellSx} />
                                              <TableCell sx={{ ...cellSx, color: 'var(--text-color)', pl: 4 + depth * 3 }}>
                                                  {dll.displayName}
                                                  <Typography
                                                      component="span"
                                                      sx={{ color: 'var(--text-color-light)', fontSize: 11, ml: 1 }}
                                                  >
                                                      {dll.relativePath}
                                                  </Typography>
                                              </TableCell>
                                              <TableCell sx={{ ...cellSx, color: 'var(--text-color-light)' }}>
                                                  {dll.author || '-'}
                                              </TableCell>
                                              <TableCell sx={cellSx} />
                                              <TableCell sx={cellSx}>
                                                  <Chip
                                                      label={dll.enabled ? '활성' : '비활성'}
                                                      size="small"
                                                      sx={{
                                                          fontSize: 11,
                                                          height: 20,
                                                          background: dll.enabled
                                                              ? 'var(--primary-color)'
                                                              : 'var(--accent-color)',
                                                          color: '#fff',
                                                      }}
                                                  />
                                              </TableCell>
                                              <TableCell sx={cellSx} />
                                              <TableCell sx={cellSx} />
                                              <TableCell sx={cellSx} />
                                              <TableCell sx={cellSx} />
                                          </TableRow>
                                      ))
                                    : []),
                            ];
                        })}

                        {packages.length === 0 && !loading && (
                            <TableRow>
                                <TableCell
                                    colSpan={10}
                                    sx={{ color: 'var(--text-color-light)', textAlign: 'center', py: 4 }}
                                >
                                    표시할 모드가 없습니다.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </TableContainer>

            {/* ── Context Menu ── */}
            <Menu
                open={Boolean(ctxMenu)}
                onClose={() => setCtxMenu(null)}
                anchorReference="anchorPosition"
                anchorPosition={
                    ctxMenu ? { top: ctxMenu.mouseY, left: ctxMenu.mouseX } : undefined
                }
                slotProps={{ paper: { sx: menuItemSx } }}
            >
                <MenuItem
                    onClick={() => {
                        if (!ctxPkg) return;
                        void handlePackageToggle(
                            ctxPkg.id,
                            ctxPkg.enabled === false || ctxPkg.enabled === 'mixed'
                        );
                        setCtxMenu(null);
                    }}
                >
                    <ListItemIcon>
                        <TuneIcon fontSize="small" sx={{ color: 'var(--text-color)' }} />
                    </ListItemIcon>
                    <ListItemText>
                        {ctxPkg?.enabled === false ? '모드 활성화' : '모드 비활성화'}
                    </ListItemText>
                </MenuItem>
                <MenuItem
                    onClick={() => {
                        setDetailPkg(ctxPkg ?? null);
                        setCtxMenu(null);
                    }}
                >
                    <ListItemIcon>
                        <InfoOutlinedIcon fontSize="small" sx={{ color: 'var(--text-color)' }} />
                    </ListItemIcon>
                    <ListItemText>상세 정보</ListItemText>
                </MenuItem>
                <MenuItem
                    disabled={!ctxMenu?.hasSettings}
                    onClick={() => {
                        if (ctxMenu) setSettingsPkgId(ctxMenu.packageId);
                        setCtxMenu(null);
                    }}
                >
                    <ListItemIcon>
                        <SettingsIcon fontSize="small" sx={{ color: 'var(--text-color)' }} />
                    </ListItemIcon>
                    <ListItemText>모드 설정</ListItemText>
                </MenuItem>
                <MenuItem
                    onClick={() => {
                        if (ctxPkg) void handlePackageExport(ctxPkg);
                        setCtxMenu(null);
                    }}
                >
                    <ListItemIcon>
                        <DownloadIcon fontSize="small" sx={{ color: 'var(--text-color)' }} />
                    </ListItemIcon>
                    <ListItemText>내보내기</ListItemText>
                </MenuItem>
                <Divider sx={{ borderColor: 'var(--border-color)' }} />
                <MenuItem
                    onClick={() => {
                        if (ctxPkg) void handleDelete(ctxPkg.id, ctxPkg.name);
                        setCtxMenu(null);
                    }}
                    sx={{ color: 'var(--accent-color)' }}
                >
                    <ListItemIcon>
                        <DeleteIcon fontSize="small" sx={{ color: 'var(--accent-color)' }} />
                    </ListItemIcon>
                    <ListItemText>삭제</ListItemText>
                </MenuItem>
            </Menu>

            {/* ── Dialogs ── */}
            <AddModDialog
                open={addDialogOpen}
                onClose={() => setAddDialogOpen(false)}
                onImport={(pkgs, pkgName) => {
                    setPackages(pkgs);
                    window.electronAPI.getOnlineModCatalog()
                        .then(setOnlineCatalog)
                        .catch(() => setOnlineCatalog([]));
                    showNotification(`모드 추가 완료: ${pkgName}`);
                }}
            />

            <PackModDialog
                open={packDialogOpen}
                onClose={() => setPackDialogOpen(false)}
                packages={packages}
                onPacked={(pkgs, pkgName) => {
                    setPackages(pkgs);
                    showNotification(`모드 패킹 완료: ${pkgName}`);
                }}
            />

            {detailPkg && (
                <DetailDialog pkg={detailPkg} onClose={() => setDetailPkg(null)} />
            )}

            {settingsPkgId && (
                <SettingsDialog
                    packageId={settingsPkgId}
                    onClose={() => setSettingsPkgId(null)}
                />
            )}

            <DeveloperGateDialog
                open={developerGateOpen}
                title="개발자 전용 도구"
                description="온라인 모드 catalog와 배포 ZIP 파일을 직접 수정하는 숨김 도구입니다. 변경 후 커밋 전에 mods/index.json과 packages 경로를 확인하세요."
                onClose={() => setDeveloperGateOpen(false)}
                onUnlocked={() => setDeveloperToolsOpen(true)}
            />

            <ModDeveloperToolsDialog
                open={developerToolsOpen}
                onClose={() => setDeveloperToolsOpen(false)}
                onOpenDistribution={() => setModDistributionOpen(true)}
            />

            <ModDistributionDialog
                open={modDistributionOpen}
                onClose={() => setModDistributionOpen(false)}
                onSaved={() => {
                    window.electronAPI.getOnlineModCatalog()
                        .then(setOnlineCatalog)
                        .catch(() => setOnlineCatalog([]));
                }}
            />
        </Box>
    );
}
