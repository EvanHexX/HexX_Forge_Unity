// src/renderer/pages/ModManager.tsx
// BepInEx 기반 모드 패키지 관리 (활성/비활성, 추가, 삭제, 설정, 패킹)

import { useEffect, useState } from 'react';
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
import type {
    ModFileType,
    ModPackage,
    OnlineModCatalogItem,
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

const FILE_TYPES: ModFileType[] = ['dll', 'asset', 'mod-info', 'script', 'config', 'folder'];

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
    itemType: 'string' | 'object';
    valueKeys: string[];
};

type ScriptBuilderFeature = ScriptFeature & {
    sampleText?: string;
    cfgText?: string;
    collapsed?: boolean;
    linkedConfigText?: string;
    linkedConfigPreviewText?: string;
    linkedConfigArrayCandidates?: JsonArrayPathCandidate[];
};

// Parses the result from setPackageEnabled / setDllEnabled (may be legacy array or new ToggleResult)
function parseToggleResult(result: unknown): ToggleResult {
    if (Array.isArray(result)) return { packages: result as ModPackage[], warnings: [] };
    return result as ToggleResult;
}

// ── Settings Dialog ────────────────────────────────────────────────

function SettingsDialog({ packageId, onClose }: { packageId: string; onClose: () => void }) {
    const { showNotification } = useNotification();
    const [settings, setSettings] = useState<PackageSettings | null>(null);
    const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
    const [jsonValues, setJsonValues] = useState<Record<string, string | number | boolean>>({});
    const [selectedFiles, setSelectedFiles] = useState<Record<string, string>>({});
    const [pendingImports, setPendingImports] = useState<Array<{ featureId: string; sourcePath: string }>>([]);
    const [pendingDeletes, setPendingDeletes] = useState<Array<{ featureId: string; fileName: string }>>([]);
    const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});
    const [selectedConfigPath, setSelectedConfigPath] = useState<string | null>(null);
    const [configContent, setConfigContent] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        window.electronAPI.getPackageSettings(packageId).then((data: PackageSettings) => {
            setSettings(data);
            setFieldValues(data.cfgValues);
            setJsonValues(data.jsonValues ?? {});
        });
    }, [packageId]);

    const handleSelectFile = async (field: ScriptField) => {
        const filePath = await window.electronAPI.selectFile(field.accept ?? '*');
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
                    fileImports: pendingImports,
                    fileDeletes: pendingDeletes,
                    configText: selectedConfigPath ? { path: selectedConfigPath, content: configContent } : null,
                };
                const updated = await window.electronAPI.applyPackageSettings(packageId, changes);
                setSettings(updated);
                setFieldValues(updated.cfgValues ?? {});
                setJsonValues(updated.jsonValues ?? {});
                setPendingImports([]);
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
                    .flatMap((s) => s.config.sections)
                    .flatMap((s) => s.fields)
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
                        MenuProps={{ slotProps: { paper: { sx: menuItemSx } } }}
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
                        MenuProps={{ slotProps: { paper: { sx: menuItemSx } } }}
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
                                if (filePath) setPendingImports((prev) => [...prev, { featureId: feature.id, sourcePath: filePath }]);
                            }}
                            sx={{ alignSelf: 'flex-start', borderColor: 'var(--border-color)', color: 'var(--text-color)' }}
                        >
                            import
                        </Button>
                        {[...(managedGroup?.files ?? []), ...pendingImports.filter((item) => item.featureId === feature.id).map((item) => item.sourcePath.split(/[\\/]/).pop() ?? item.sourcePath)].map((fileName) => {
                            const deleting = pendingDeletes.some((item) => item.featureId === feature.id && item.fileName === fileName);
                            return (
                                <Stack key={fileName} direction="row" spacing={1} sx={{ alignItems: 'center', opacity: deleting ? 0.45 : 1 }}>
                                    <Typography sx={{ color: 'var(--text-color)', fontSize: 13, flex: 1 }}>{fileName}</Typography>
                                    {(managedGroup?.files ?? []).includes(fileName) && (
                                        <Button
                                            size="small"
                                            color="error"
                                            onClick={() => setPendingDeletes((prev) => [...prev, { featureId: feature.id, fileName }])}
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
    return (
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
                                        MenuProps={{ slotProps: { paper: { sx: menuItemSx } } }}
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
                                            MenuProps={{ slotProps: { paper: { sx: menuItemSx } } }}
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

function inferJsonFields(sampleText: string): ScriptField[] {
    let data: unknown;
    try {
        data = JSON.parse(sampleText || '{}');
    } catch {
        return [];
    }
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
    let data: unknown;
    try {
        data = JSON.parse(sampleText || 'null');
    } catch {
        return [];
    }
    const candidates: JsonArrayPathCandidate[] = [];
    const likelyValueKeys = ['file', 'fileName', 'filename', 'path', 'name', 'id'];
    const walk = (value: unknown, pathParts: string[]) => {
        if (Array.isArray(value)) {
            const pathName = pathParts.length > 0 ? pathParts.join('.') : '$';
            if (value.every((item) => typeof item === 'string')) {
                candidates.push({ path: pathName, itemType: 'string', valueKeys: [] });
            } else if (value.every((item) => item && typeof item === 'object' && !Array.isArray(item))) {
                const valueKeys = likelyValueKeys.filter((key) =>
                    value.some((item) => {
                        const child = (item as Record<string, unknown>)[key];
                        return ['string', 'number', 'boolean'].includes(typeof child);
                    })
                );
                candidates.push({ path: pathName, itemType: 'object', valueKeys });
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

function buildSettingsScript(features: ScriptBuilderFeature[]) {
    return {
        type: 'configurator' as const,
        version: 1,
        features: features.map(({ sampleText, cfgText, collapsed, linkedConfigText, linkedConfigPreviewText, linkedConfigArrayCandidates, ...feature }) => ({
            ...feature,
            sample: feature.type === 'json_manager' ? JSON.parse(sampleText || '{}') : undefined,
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

function normalizePackPath(value: string): string {
    return value.replaceAll('\\', '/').replace(/^\/+/, '').replace(/\/+/g, '/');
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
}: {
    open: boolean;
    onClose: () => void;
    onPacked: (pkgs: ModPackage[], name: string) => void;
}) {
    const [packageType, setPackageType] = useState<'single' | 'collection'>('single');
    const [name, setName] = useState('');
    const [author, setAuthor] = useState('');
    const [description, setDescription] = useState('');
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

    const reset = () => {
        setPackageType('single');
        setName('');
        setAuthor('');
        setDescription('');
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
            } catch (err) {
                setError(err instanceof Error ? err.message : 'ZIP inspect failed');
            } finally {
                setLoadingZip(false);
            }
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
            }))
    );

    const handleSelectLinkedConfig = async (featureId: string, value: string) => {
        const option = jsonEntryOptions.find((item) => item.value === value);
        if (!option) return;
        try {
            const text = await window.electronAPI.readZipEntryText(option.sourcePath, option.sourceEntryName);
            const candidates = inferLinkedConfigArrayCandidates(text);
            const firstCandidate = candidates[0];
            updateScriptFeature(featureId, {
                linkedConfigPath: option.entryName,
                linkedConfigArrayPath: firstCandidate?.path ?? '',
                linkedConfigValueKey: firstCandidate?.valueKeys[0] ?? '',
                linkedConfigText: text,
                linkedConfigPreviewText: text,
                linkedConfigArrayCandidates: candidates,
            });
        } catch (err) {
            setError(err instanceof Error ? err.message : '연동 설정 JSON을 읽지 못했습니다.');
        }
    };

    const handleLinkedConfigTextChange = (feature: ScriptBuilderFeature, text: string) => {
        const candidates = inferLinkedConfigArrayCandidates(text);
        const selectedCandidate =
            candidates.find((candidate) => candidate.path === feature.linkedConfigArrayPath) ?? candidates[0];
        const nextValueKey =
            selectedCandidate?.valueKeys.includes(feature.linkedConfigValueKey || '')
                ? feature.linkedConfigValueKey
                : selectedCandidate?.valueKeys[0] ?? '';
        updateScriptFeature(feature.id, {
            linkedConfigText: text,
            linkedConfigPreviewText: text,
            linkedConfigArrayCandidates: candidates,
            linkedConfigArrayPath: feature.linkedConfigArrayPath || selectedCandidate?.path || '',
            linkedConfigValueKey: nextValueKey,
        });
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
    };

    const handlePack = async () => {
        if (!canLeaveBasicInfo) { setError('패키지 이름, 제작자, 설명을 모두 입력해주세요.'); return; }
        if (sources.length === 0) { setError('Add at least one DLL or ZIP file.'); return; }
        if (!savePath) { setError('저장 경로를 선택해주세요.'); return; }
        const duplicates = findDuplicateEntryPaths(sources);
        if (duplicates.length > 0) { setError(`중복 경로가 있습니다: ${duplicates.join(', ')}`); return; }
        setPacking(true);
        setError('');
        try {
            const settingsScript =
                scriptJsonText.trim()
                    ? JSON.parse(scriptJsonText)
                    : scriptFeatures.length > 0
                      ? buildSettingsScript(scriptFeatures)
                      : null;
            const result = await window.electronAPI.packMod({
                name: name || sources[0]?.packageName || '알 수 없음',
                author,
                description,
                packageType,
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
        <Dialog
            open={open}
            onClose={handleClose}
            maxWidth={false}
            fullWidth
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
                        파일 추가 (DLL / ZIP)
                    </Button>

                    {hasMixedZip && (
                        <Alert severity="warning" icon={<WarningAmberIcon />}>
                            여러 DLL과 asset이 섞인 ZIP입니다. 권장하지 않는 구성이라, 아래 Depends On에서 asset이 어떤 DLL에 종속되는지 지정해주세요.
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
                    <TextField
                        label="설명"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        multiline
                        minRows={2}
                        sx={multilineSx}
                    />
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
                                                    <Stack direction="row" spacing={1}>
                                                        <TextField size="small" label="BepInEx 기준 폴더" value={feature.targetDir || ''} onChange={(e) => updateScriptFeature(feature.id, { targetDir: e.target.value })} sx={{ ...inputSx, flex: 1 }} />
                                                        <TextField size="small" label="확장자" value={(feature.extensions ?? []).join(',')} onChange={(e) => updateScriptFeature(feature.id, { extensions: e.target.value.split(',').map((v) => v.trim()).filter(Boolean) })} sx={{ ...inputSx, flex: 1 }} />
                                                    </Stack>
                                                    <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                                                        <Select
                                                            size="small"
                                                            value={
                                                                feature.linkedConfigPath
                                                                    ? jsonEntryOptions.find((option) => option.entryName === feature.linkedConfigPath)?.value ?? ''
                                                                    : ''
                                                            }
                                                            displayEmpty
                                                            onChange={(e) => handleSelectLinkedConfig(feature.id, String(e.target.value))}
                                                            sx={{ ...selectSx, minWidth: 280 }}
                                                            MenuProps={{ slotProps: { paper: { sx: menuItemSx } } }}
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
                                                    <TextField
                                                        size="small"
                                                        label="연동 배열 JSON path"
                                                        value={feature.linkedConfigArrayPath || ''}
                                                        onChange={(e) => updateScriptFeature(feature.id, { linkedConfigArrayPath: e.target.value })}
                                                        sx={inputSx}
                                                        placeholder="예: files"
                                                    />
                                                    {feature.linkedConfigPath && (
                                                        <Stack spacing={1}>
                                                            <TextField
                                                                multiline
                                                                minRows={5}
                                                                label="연동 JSON 내용"
                                                                value={feature.linkedConfigText ?? feature.linkedConfigPreviewText ?? ''}
                                                                onChange={(e) => handleLinkedConfigTextChange(feature, e.target.value)}
                                                                sx={multilineSx}
                                                                placeholder="처음 패킹하는 빈 JSON이면 여기에 예시 JSON을 붙여넣어 배열 path를 추론할 수 있습니다."
                                                            />
                                                            {(feature.linkedConfigArrayCandidates ?? []).length > 0 ? (
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
                                                                        MenuProps={{ slotProps: { paper: { sx: menuItemSx } } }}
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
                                                                                MenuProps={{ slotProps: { paper: { sx: menuItemSx } } }}
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
                                                            )}
                                                        </Stack>
                                                    )}
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
                                                            if (!selected) return;
                                                            const text = await window.electronAPI.readTextFile(selected);
                                                            updateScriptFeature(feature.id, {
                                                                cfgPath: feature.cfgPath || `config/${selected.split(/[\\/]/).pop()}`,
                                                                cfgText: text,
                                                                fields: parseCfgFields(feature.cfgPath || `config/${selected.split(/[\\/]/).pop()}`, text),
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
                                                        InputProps={{ readOnly: true }}
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
                                InputProps={{ readOnly: true }}
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
                    disabled={packing || !canLeaveBasicInfo || sourceCount === 0 || !savePath}
                    sx={{ background: 'var(--button-bg-color)', color: 'var(--button-text-color)' }}
                >
                    {packing ? <CircularProgress size={18} /> : '패킹'}
                </Button>
            </DialogActions>
        </Dialog>
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

    const [packageType, setPackageType] = useState<'single' | 'collection'>('single');
    const [name, setName] = useState('');
    const [author, setAuthor] = useState('');
    const [description, setDescription] = useState('');
    const [dllFiles, setDllFiles] = useState<DllFileEntry[]>([]);

    const [zipPath, setZipPath] = useState<string | null>(null);
    const [zipEntries, setZipEntries] = useState<ZipEditableEntry[]>([]);
    const [zipPackageType, setZipPackageType] = useState<'single' | 'collection'>('single');
    const [zipName, setZipName] = useState('');
    const [zipAuthor, setZipAuthor] = useState('');
    const [zipDescription, setZipDescription] = useState('');
    const [zipWarnings, setZipWarnings] = useState<string[]>([]);

    const [loadingZip, setLoadingZip] = useState(false);
    const [importing, setImporting] = useState(false);
    const [error, setError] = useState('');

    const isZipMode = zipPath !== null;
    const zipDllCount = zipEntries.filter((entry) => entry.selectedType === 'dll' && !entry.isDirectory).length;
    const zipSingleDllError =
        isZipMode && zipPackageType === 'single' && zipDllCount !== 1
            ? `단일 ZIP 모드는 DLL 파일이 정확히 1개여야 합니다. 현재 ${zipDllCount}개입니다.`
            : '';

    const reset = () => {
        setActiveTab('online');
        setPackageType('single');
        setName('');
        setAuthor('');
        setDescription('');
        setDllFiles([]);
        setZipPath(null);
        setZipEntries([]);
        setZipWarnings([]);
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

    const handleOnlineAction = async (item: OnlineModCatalogItem) => {
        setOnlineWorkingId(item.id);
        setOnlineError('');
        try {
            const result = item.installed && item.updateAvailable
                ? await window.electronAPI.updateOnlineMod(item)
                : await window.electronAPI.downloadOnlineMod(item);
            onImport(result as ModPackage[], item.name);
            setOnlineMods(await window.electronAPI.getOnlineModCatalog());
        } catch (err) {
            setOnlineError(err instanceof Error ? err.message : '온라인 모드 처리 실패');
        } finally {
            setOnlineWorkingId(null);
        }
    };

    const handleClose = () => {
        reset();
        onClose();
    };

    const handleAddFile = async () => {
        setError('');
        const selected = await window.electronAPI.selectModImportFile();
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
            } catch (err) {
                setError(err instanceof Error ? err.message : 'ZIP 분석 실패');
            } finally {
                setLoadingZip(false);
            }
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
        </Dialog>
    );
}

// ── Table row cells helper ─────────────────────────────────────────

const cellSx = { py: 0.75, px: 1.5 };

// ── Main Component ─────────────────────────────────────────────────

export default function ModManager() {
    const { showNotification } = useNotification();

    const [packages, setPackages] = useState<ModPackage[]>([]);
    const [onlineCatalog, setOnlineCatalog] = useState<OnlineModCatalogItem[]>([]);
    const [updatingPackageId, setUpdatingPackageId] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

    const [ctxMenu, setCtxMenu] = useState<CtxMenuState | null>(null);
    const [addDialogOpen, setAddDialogOpen] = useState(false);
    const [packDialogOpen, setPackDialogOpen] = useState(false);
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
        loadMods();
    }, []);

    const handleToggleExpand = (id: string) => {
        setExpandedIds((prev) => {
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
        setUpdatingPackageId(pkg.id);
        try {
            const result = await window.electronAPI.updateOnlineMod(item);
            setPackages(result as ModPackage[]);
            setOnlineCatalog(await window.electronAPI.getOnlineModCatalog());
            showNotification(`모드 업데이트 완료: ${pkg.name}`);
        } catch (err) {
            showNotification(err instanceof Error ? err.message : '모드 업데이트 실패', 'error');
        } finally {
            setUpdatingPackageId(null);
        }
    };

    const handleCtxMenu = (e: React.MouseEvent, pkg: ModPackage) => {
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

    return (
        <Box>
            {/* ── Header ── */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                    <Typography variant="h5" sx={{ fontWeight: 800, color: 'var(--text-color)' }}>
                        모드 관리자
                    </Typography>
                    <Typography sx={{ mt: 0.5, color: 'var(--text-color-light)' }}>
                        BepInEx/plugins 안의 DLL 파일을 활성/비활성 관리합니다.
                    </Typography>
                </Box>
                <Stack direction="row" spacing={1}>
                    <Button
                        variant="contained"
                        startIcon={loading ? <CircularProgress size={16} /> : <RefreshIcon />}
                        onClick={loadMods}
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
                            <TableCell sx={{ ...headCellSx, width: 48 }}>설정</TableCell>
                            <TableCell sx={{ ...headCellSx, width: 48 }}>삭제</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {packages.map((pkg) => {
                            const isExpanded = expandedIds.has(pkg.id);
                            const isDisabled = pkg.enabled === false;
                            const state = enabledState(pkg);
                            const catalogItem = getCatalogItemForPackage(pkg);
                            const updateAvailable = Boolean(catalogItem?.updateAvailable);

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
                                            onChange={(e) => handlePackageToggle(pkg.id, e.target.checked)}
                                            size="small"
                                            sx={{
                                                color: 'var(--text-color-light)',
                                                '&.Mui-checked': { color: 'var(--primary-color)' },
                                                '&.MuiCheckbox-indeterminate': { color: 'var(--primary-color)' },
                                            }}
                                        />
                                    </TableCell>
                                    <TableCell sx={cellSx}>
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
                                    </TableCell>
                                    <TableCell sx={{ ...cellSx, color: 'var(--text-color)', fontWeight: 600 }}>
                                        {pkg.name}
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
                                                        onClick={() => handlePackageUpdate(pkg)}
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
                                            onClick={() => handleDelete(pkg.id, pkg.name)}
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
                                                          handleDllToggle(dll.relativePath, e.target.checked)
                                                      }
                                                      size="small"
                                                      sx={{
                                                          color: 'var(--text-color-light)',
                                                          '&.Mui-checked': { color: 'var(--primary-color)' },
                                                      }}
                                                  />
                                              </TableCell>
                                              <TableCell sx={cellSx} />
                                              <TableCell sx={{ ...cellSx, color: 'var(--text-color)', pl: 4 }}>
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
                                          </TableRow>
                                      ))
                                    : []),
                            ];
                        })}

                        {packages.length === 0 && !loading && (
                            <TableRow>
                                <TableCell
                                    colSpan={9}
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
                        handlePackageToggle(
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
                <Divider sx={{ borderColor: 'var(--border-color)' }} />
                <MenuItem
                    onClick={() => {
                        if (ctxPkg) handleDelete(ctxPkg.id, ctxPkg.name);
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
        </Box>
    );
}
