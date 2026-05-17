import { useEffect, useMemo, useState } from 'react';
import BackupIcon from '@mui/icons-material/Backup';
import CheckIcon from '@mui/icons-material/Check';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import FontDownloadIcon from '@mui/icons-material/FontDownload';
import DeleteIcon from '@mui/icons-material/Delete';
import RestoreIcon from '@mui/icons-material/Restore';
import SyncIcon from '@mui/icons-material/Sync';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import DownloadIcon from '@mui/icons-material/Download';
import RefreshIcon from '@mui/icons-material/Refresh';
import UpdateIcon from '@mui/icons-material/SystemUpdateAlt';
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
    FormControl,
    FormControlLabel,
    InputLabel,
    LinearProgress,
    Menu,
    MenuItem,
    Paper,
    Radio,
    RadioGroup,
    Select,
    Stack,
    Tab,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Tabs,
    TextField,
    Tooltip,
    Typography
} from '@mui/material';
import { useTextureCatalog } from '../hooks/useTextureCatalog';
import { useDeveloperShortcut } from '../hooks/useDeveloperShortcut';
import { useNotification } from '../context/NotificationContext';
import { getSafeLanguage, t, type LanguageCode } from '../i18n';
import DeveloperGateDialog from '../components/DeveloperGateDialog';

type BackupStatus = {
    font: BackupStatusItem | string | null;
    asset: BackupStatusItem | string | null;
};

type BackupStatusItem = {
    name: string;
    sizeBytes: number;
};

type AssetCatalogItem = {
    id: string;
    gender: string;
    type: string;
    label: string;
    textureName: string;
    pathId: number;
    category?: string;
    option1?: string;
    option1Label?: string;
    option2?: string;
    displayLabel?: string;
    preview?: string;
    size?: SizeTuple;
    previewUrl: string;
};

type SizeTuple = [number, number];

type SelectedImage = {
    path: string;
    url: string;
    size?: SizeTuple;
};

type AssetPackTarget = {
    id: string;
    catalogId: string;
    textureName: string;
    pathId: number;
    gender: string;
    option1?: string;
    option1Label?: string;
    category: string;
    option2: string;
    displayLabel?: string;
    png: string;
    preview?: string;
    pngPath: string;
    pngUrl: string;
    previewPath: string;
    previewUrl: string;
    size?: SizeTuple;
};

type AssetPack = {
    schemaVersion: number;
    packId: string;
    packName: string;
    author?: string;
    description?: string;
    version?: string;
    source?: {
        type: 'github';
        catalogId: string;
        downloadPath: string;
    };
    basePath: string;
    targets: AssetPackTarget[];
};

type AssetPackTargetOption = AssetPackTarget & {
    packId: string;
    packName: string;
};

type CurrentAssetPackEntry = {
    catalogId: string;
    category?: string;
    option1?: string;
    option2?: string;
    textureName?: string;
    pathId?: number;
    packId: string;
    packName: string;
    targetId?: string;
    targetLabel?: string;
    previewUrl?: string;
    pngUrl?: string;
    appliedAt: string;
};

type FontTarget = {
    pathId: number;
    targetLabel: string;
    metadataName: string;
    currentFont: string;
    currentFontPath: string;
    currentFontUrl: string;
};

type StoredFont = {
    path: string;
    name: string;
    url: string;
};

type ChangeMode = 'pack' | 'direct';

type PreviewDialogState = {
    title: string;
    imageUrl: string;
    caption?: string;
} | null;

type OnlineAssetPackCatalogItem = {
    id: string;
    name: string;
    author?: string;
    description?: string;
    version: string;
    downloadPath: string;
    thumbnailPath?: string;
    thumbnailUrl?: string;
    installed?: boolean;
    installedVersion?: string;
    updateAvailable?: boolean;
};

const CUSTOM_PACK_VALUE = '__custom__';
const FONT_TARGET_IDS = Array.from({ length: 13 }, (_, index) => 2418 + index);

const UNKNOWN_FONT_TARGET_LABEL = '알수없음';
const UNKNOWN_FONT_TARGET_TOOLTIP = '발견 시 제보바랍니다.';
const FONT_TARGET_DISPLAY_INFO: Record<number, string[]> = {
    2418: ['선택지', '소문탭의 퀘스트 제목'],
    2419: ['메인메뉴', 'HUD(날짜, 직책) 상세창 등급태그'],
    2420: ['각종툴팁', '업적설명', '제작자', '업데이트', '로딩 팁', '소식창', '기본정보', '각파공적 문파명', '문파탭 상세정보'],
    2421: ['버튼설명', '체크박스', '아이템이름', '사람이름', '직책명', '건물', '챕터설명']
};

const genderLabelMap: Record<string, string> = {
    female: '여성',
    male: '남성',
    title: '타이틀',
    main_background: '메인배경',
    ui_title: '타이틀',
    ui_main_background: '메인배경'
};

const categoryLabelMap: Record<string, string> = {
    outfit: '의상',
    clothing: '의상',
    clothes: '의상',
    body: '몸',
    face: '얼굴',
    hair: '헤어',
    building: '건물',
    ui: 'UI',
    UI: 'UI'
};

const selectSx = {
    color: 'var(--text-color)',
    background: 'var(--input-bg-color)',
    '.MuiOutlinedInput-notchedOutline': {
        borderColor: 'var(--border-color)'
    },
    '.MuiSvgIcon-root': {
        color: 'var(--text-color)'
    },
    '&.Mui-disabled': {
        color: 'var(--text-color-light)'
    }
};

const sectionPaperSx = {
    mt: 3,
    p: 3,
    background: 'var(--sidebar-bg-color)',
    color: 'var(--text-color)',
    border: '1px solid var(--border-color)',
    boxShadow: 'var(--shadow-small)'
};

const innerPaperSx = {
    mt: 2,
    p: 2,
    background: 'var(--bg-color)',
    border: '1px solid var(--border-color)',
    boxShadow: 'none'
};

const dialogPaperSx = {
    background: 'var(--sidebar-bg-color)',
    color: 'var(--text-color)',
    border: '1px solid var(--border-color)',
    boxShadow: 'var(--shadow-large)'
};

const dialogTitleSx = {
    color: 'var(--text-color)',
    fontWeight: 800
};

const dialogContentSx = {
    color: 'var(--text-color)'
};

const dialogActionsSx = {
    px: 3,
    pb: 2.5
};

const containedButtonSx = {
    background: 'var(--button-bg-color)',
    color: 'var(--button-text-color)',
    '&:hover': {
        background: 'var(--button-hover-bg-color)'
    },
    '&.Mui-disabled': {
        background: 'var(--secondary-color)',
        color: 'var(--text-color-light)'
    }
};

const outlinedButtonSx = {
    borderColor: 'var(--border-color)',
    color: 'var(--text-color)',
    '&:hover': {
        background: 'var(--hover-bg-color)',
        borderColor: 'var(--border-color)'
    },
    '&.Mui-disabled': {
        borderColor: 'var(--secondary-color)',
        color: 'var(--text-color-light)'
    }
};

function ignoreBackdropClose(onClose: () => void) {
    return (_event: unknown, reason?: string) => {
        if (reason === 'backdropClick') return;
        onClose();
    };
}

function normalizePacks(value: unknown): AssetPack[] {
    if (Array.isArray(value)) return value as AssetPack[];

    if (
        value &&
        typeof value === 'object' &&
        'packs' in value &&
        Array.isArray((value as { packs: unknown }).packs)
    ) {
        return (value as { packs: AssetPack[] }).packs;
    }

    if (value && typeof value === 'object' && 'packId' in value && 'targets' in value) {
        return [value as AssetPack];
    }

    return [];
}

function toKoreanGender(value: string): string {
    return genderLabelMap[value] || value || '성별 미지정';
}

function toTargetGroupLabel(value: string, explicitLabel?: string): string {
    return explicitLabel?.trim() || genderLabelMap[value] || value || '대상 구분 없음';
}

function toKoreanCategory(value: string): string {
    return categoryLabelMap[value] || value || '종류 미지정';
}

function getTargetOption1(target: Pick<AssetPackTarget, 'gender' | 'option1'>): string {
    return target.option1 || target.gender || '';
}

function formatTargetLabel(target: Pick<AssetPackTarget, 'option2' | 'gender' | 'option1' | 'option1Label' | 'category' | 'displayLabel'>): string {
    if (target.displayLabel?.trim()) return target.displayLabel.trim();

    return [toKoreanCategory(target.category), toTargetGroupLabel(getTargetOption1(target), target.option1Label), target.option2?.trim()]
        .filter(Boolean)
        .join(' ');
}

function getCatalogCategory(item: AssetCatalogItem): string {
    return item.category || item.type || '';
}

function getCatalogOption1(item: AssetCatalogItem): string {
    return item.option1 || item.gender || '';
}

function getCatalogOption2(item: AssetCatalogItem): string {
    if (item.option2?.trim()) return item.option2.trim();

    const rawLabel = item.label?.trim() || '';
    return rawLabel
        .replace(toTargetGroupLabel(getCatalogOption1(item), item.option1Label), '')
        .replace(toKoreanCategory(getCatalogCategory(item)), '')
        .replace(item.textureName, '')
        .replace(/원본/g, '')
        .trim();
}

function isUiCategory(value: string): boolean {
    return value.trim().toLowerCase() === 'ui';
}

function getPatchMetadataLabel(category: string): string {
    return isUiCategory(category)
        ? 'UnityPy metadata/ui_textures.tsv'
        : 'UnityPy metadata/data.tsv';
}

function formatCatalogItemLabel(item: AssetCatalogItem): string {
    if (item.displayLabel?.trim()) return item.displayLabel.trim();

    const optionLabel = getCatalogOption2(item) || item.textureName || item.label?.trim() || '';
    return [toKoreanCategory(getCatalogCategory(item)), toTargetGroupLabel(getCatalogOption1(item), item.option1Label), optionLabel]
        .filter(Boolean)
        .join(' ');
}

function getFontTargetDisplay(pathId: number) {
    const labels = FONT_TARGET_DISPLAY_INFO[pathId];

    if (!labels) {
        return {
            label: UNKNOWN_FONT_TARGET_LABEL,
            tooltip: UNKNOWN_FONT_TARGET_TOOLTIP
        };
    }

    return {
        label: labels[0],
        tooltip: labels.join(', ')
    };
}

function formatPackCaption(target?: AssetPackTargetOption): string {
    return target ? `${target.packName}: ${formatTargetLabel(target)}` : '';
}

function buildPatchTargetFromPackTarget(target: AssetPackTargetOption) {
    return {
        catalogId: target.catalogId,
        packId: target.packId,
        targetId: target.id,
        category: target.category,
        option1: getTargetOption1(target),
        gender: getTargetOption1(target),
        option2: target.option2,
        textureName: target.textureName,
        pathID: target.pathId,
        pathId: target.pathId,
        size: target.size,
        pngPath: target.pngPath
    };
}

function buildPatchTargetFromCatalogItem(item: AssetCatalogItem, pngPath: string, replacementSize?: SizeTuple) {
    return {
        catalogId: item.id,
        category: getCatalogCategory(item),
        option1: getCatalogOption1(item),
        gender: getCatalogOption1(item),
        option2: getCatalogOption2(item),
        textureName: item.textureName,
        pathID: item.pathId,
        pathId: item.pathId,
        size: replacementSize || item.size,
        pngPath
    };
}

function getFileName(filePath: string): string {
    return filePath.split(/[\\/]/).pop() || filePath;
}

function formatBackupStatus(value: BackupStatusItem | string | null): string {
    if (!value) return '백업 파일이 없습니다';

    const name = typeof value === 'string' ? value : value.name;
    const sizeBytes = typeof value === 'string' ? null : value.sizeBytes;
    const formattedDate = formatBackupName(name);
    const formattedSize = sizeBytes === null ? '' : `. ${formatKb(sizeBytes)}KB`;

    return `${formattedDate}${formattedSize}`;
}

function formatBackupName(name: string): string {
    const match = name.match(/^(\d{4})-(\d{1,2})-(\d{1,2})_(\d+)$/);

    if (!match) return name;

    const [, year, month, day, rawTime] = match;
    const [hour, minute, second] = parseBackupTime(rawTime);

    return `${Number(year)}년 ${Number(month)}월 ${Number(day)}일 ${hour}시 ${minute}분 ${second}초`;
}

function parseBackupTime(rawTime: string): [number, number, number] {
    if (rawTime.length >= 6) {
        return [
            Number(rawTime.slice(0, -4)),
            Number(rawTime.slice(-4, -2)),
            Number(rawTime.slice(-2))
        ];
    }

    if (rawTime.length === 5) {
        return [
            Number(rawTime.slice(0, 2)),
            Number(rawTime.slice(2, 4)),
            Number(rawTime.slice(4))
        ];
    }

    if (rawTime.length === 4) {
        return [
            Number(rawTime.slice(0, 1)),
            Number(rawTime.slice(1, 2)),
            Number(rawTime.slice(2))
        ];
    }

    if (rawTime.length === 3) {
        return [
            Number(rawTime.slice(0, 1)),
            Number(rawTime.slice(1, 2)),
            Number(rawTime.slice(2))
        ];
    }

    return [Number(rawTime) || 0, 0, 0];
}

function formatKb(sizeBytes: number): string {
    return Math.ceil(sizeBytes / 1024).toLocaleString('ko-KR');
}

export default function AssetManager() {
    const { showNotification } = useNotification();
    const { data: catalog, loading, reload: reloadCatalog } = useTextureCatalog();

    const [currentLanguage, setCurrentLanguage] = useState<LanguageCode>('en');
    const [status, setStatus] = useState<BackupStatus>({ font: null, asset: null });
    const [fontChecked, setFontChecked] = useState(true);
    const [assetChecked, setAssetChecked] = useState(true);
    const [backupDialogOpen, setBackupDialogOpen] = useState(false);
    const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
    const [fontSyncDialogOpen, setFontSyncDialogOpen] = useState(false);
    const [fontApplyDialogOpen, setFontApplyDialogOpen] = useState(false);
    const [developerGateOpen, setDeveloperGateOpen] = useState(false);
    const [developerToolsOpen, setDeveloperToolsOpen] = useState(false);
    const [catalogEditorOpen, setCatalogEditorOpen] = useState(false);
    const [assetPackDialogOpen, setAssetPackDialogOpen] = useState(false);
    const [assetPackDistributionOpen, setAssetPackDistributionOpen] = useState(false);

    const [activeTab, setActiveTab] = useState(0);
    const [selectedType, setSelectedType] = useState('');
    const [selectedGender, setSelectedGender] = useState('');
    const [selectedItemId, setSelectedItemId] = useState('');
    const [packs, setPacks] = useState<AssetPack[]>([]);
    const [selectedPackId, setSelectedPackId] = useState('');
    const [selectedTargetId, setSelectedTargetId] = useState('');
    const [replacementPath, setReplacementPath] = useState('');
    const [replacementUrl, setReplacementUrl] = useState('');
    const [replacementSize, setReplacementSize] = useState<SizeTuple | undefined>(undefined);
    const [changeMode, setChangeMode] = useState<ChangeMode>('pack');

    const [fontTargets, setFontTargets] = useState<FontTarget[]>([]);
    const [storedFonts, setStoredFonts] = useState<StoredFont[]>([]);
    const [selectedFonts, setSelectedFonts] = useState<Record<number, string>>({});
    const [fontMenu, setFontMenu] = useState<{ mouseX: number; mouseY: number; pathId: number } | null>(null);
    const [currentAssetPacks, setCurrentAssetPacks] = useState<CurrentAssetPackEntry[]>([]);
    const [previewDialog, setPreviewDialog] = useState<PreviewDialogState>(null);

    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [applying, setApplying] = useState(false);

    const loadStatus = async () => {
        setStatus(await window.electronAPI.getAssetStatus());
    };

    const loadPacks = async () => {
        setPacks(normalizePacks(await window.electronAPI.getAssetPacks()));
    };

    const loadFontTargets = async () => {
        setFontTargets(await window.electronAPI.getFontTargets());
    };

    const loadStoredFonts = async () => {
        setStoredFonts(await window.electronAPI.getStoredFonts());
    };

    const loadCurrentAssetPacks = async () => {
        const result = await window.electronAPI.getCurrentAssetPacks();
        setCurrentAssetPacks(result.targets || []);
    };

    useEffect(() => {
        window.electronAPI.getSettings().then((settings) => {
            setCurrentLanguage(getSafeLanguage(settings.language));
        });
        loadStatus().catch((err) => showError(err, '백업 상태 로드 실패'));
        loadPacks().catch((err) => showError(err, '어셋팩 목록 로드 실패'));
        loadFontTargets().catch((err) => showError(err, '폰트 목록 로드 실패'));
        loadStoredFonts().catch((err) => showError(err, '저장된 폰트 목록 로드 실패'));
        loadCurrentAssetPacks().catch((err) => showError(err, '현재 적용 어셋팩 로드 실패'));
    }, []);

    useDeveloperShortcut(() => setDeveloperGateOpen(true));

    const types = useMemo(
        () => [...new Set(catalog.map((item: AssetCatalogItem) => getCatalogCategory(item)).filter(Boolean))],
        [catalog]
    );

    const genders = useMemo(
        () => [...new Set(catalog.map((item: AssetCatalogItem) => getCatalogOption1(item)).filter(Boolean))],
        [catalog]
    );

    const filteredItems = useMemo(
        () => catalog.filter((item: AssetCatalogItem) => (
            (!selectedType || getCatalogCategory(item) === selectedType) &&
            (!selectedGender || getCatalogOption1(item) === selectedGender)
        )),
        [catalog, selectedType, selectedGender]
    );

    const selectedItem = useMemo(
        () => catalog.find((item: AssetCatalogItem) => item.id === selectedItemId),
        [catalog, selectedItemId]
    );

    const selectedPack = useMemo(
        () => packs.find((pack) => pack.packId === selectedPackId),
        [packs, selectedPackId]
    );

    const allPackTargets = useMemo<AssetPackTargetOption[]>(
        () => packs.flatMap((pack) => pack.targets.map((target) => ({
            ...target,
            packId: pack.packId,
            packName: pack.packName
        }))),
        [packs]
    );

    const availablePackTargets = useMemo(
        () => allPackTargets.filter((target) => (
            (!selectedPackId || target.packId === selectedPackId) &&
            (!selectedItem || target.catalogId === selectedItem.id)
        )),
        [allPackTargets, selectedItem, selectedPackId]
    );

    const selectedTarget = useMemo(
        () => allPackTargets.find((target) => target.id === selectedTargetId),
        [allPackTargets, selectedTargetId]
    );

    const currentAssetByCatalogId = useMemo(() => {
        const map = new Map<string, CurrentAssetPackEntry>();
        for (const entry of currentAssetPacks) {
            if (entry.catalogId) map.set(entry.catalogId, entry);
        }
        return map;
    }, [currentAssetPacks]);

    const currentAppliedForSelectedItem = selectedItem ? currentAssetByCatalogId.get(selectedItem.id) : undefined;

    const originalPreviewUrl = currentAppliedForSelectedItem?.previewUrl || currentAppliedForSelectedItem?.pngUrl || selectedItem?.previewUrl || '';
    const originalPreviewCaption = currentAppliedForSelectedItem
        ? `현재 적용됨: ${currentAppliedForSelectedItem.packName}${currentAppliedForSelectedItem.targetLabel ? ` · ${currentAppliedForSelectedItem.targetLabel}` : ''}`
        : selectedItem ? formatCatalogItemLabel(selectedItem) : '';

    const packSelectValue = changeMode === 'direct' && replacementPath
        ? CUSTOM_PACK_VALUE
        : selectedPackId || '';

    const replacementCaption = useMemo(() => {
        if (changeMode === 'direct' && replacementPath) return `커스텀: ${replacementPath}`;
        return formatPackCaption(selectedTarget);
    }, [changeMode, replacementPath, selectedTarget]);

    useEffect(() => {
        if (changeMode !== 'pack' || !selectedTarget || !selectedItem) return;
        if (selectedTarget.catalogId === selectedItem.id) return;

        setSelectedTargetId('');
        setReplacementPath('');
        setReplacementUrl('');
        setReplacementSize(undefined);
    }, [changeMode, selectedItem, selectedTarget]);

    const resetMessages = () => {
        setMessage('');
        setError('');
    };

    const showError = (err: unknown, fallback: string) => {
        const nextError = err instanceof Error ? err.message : fallback;
        setError(nextError);
        showNotification(nextError, 'error');
    };

    const showErrorMessage = (nextError: string) => {
        setError(nextError);
        showNotification(nextError, 'error');
    };

    const saveAppliedPackEntries = async (entries: CurrentAssetPackEntry[]) => {
        const result = await window.electronAPI.saveCurrentAssetPacks(entries);
        setCurrentAssetPacks(result.targets || []);
    };

    const clearAppliedPackEntries = async () => {
        const result = await window.electronAPI.clearCurrentAssetPacks();
        setCurrentAssetPacks(result.targets || []);
    };

    const buildCurrentEntryFromTarget = (target: AssetPackTargetOption): CurrentAssetPackEntry => ({
        catalogId: target.catalogId,
        category: target.category,
        option1: getTargetOption1(target),
        option2: target.option2,
        textureName: target.textureName,
        pathId: target.pathId,
        packId: target.packId,
        packName: target.packName,
        targetId: target.id,
        targetLabel: formatTargetLabel(target),
        previewUrl: target.previewUrl || target.pngUrl,
        pngUrl: target.pngUrl,
        appliedAt: new Date().toISOString()
    });

    const selectedFontJobCount = useMemo(
        () => Object.values(selectedFonts).filter(Boolean).length,
        [selectedFonts]
    );

    const handleOpenBackupDialog = () => {
        resetMessages();
        if (!fontChecked && !assetChecked) {
            showErrorMessage('백업할 항목을 선택하세요.');
            return;
        }
        setBackupDialogOpen(true);
    };

    const handleBackup = async () => {
        try {
            setBackupDialogOpen(false);
            resetMessages();

            if (fontChecked) await window.electronAPI.backupAsset('font');
            if (assetChecked) await window.electronAPI.backupAsset('asset');

            await loadStatus();
            setMessage('백업이 완료되었습니다.');
            showNotification('백업이 완료되었습니다.', 'success');
        } catch (err) {
            showError(err, '백업 실패');
        }
    };

    const handleOpenRestoreDialog = () => {
        resetMessages();
        if (!fontChecked && !assetChecked) {
            showErrorMessage('복원할 항목을 선택하세요.');
            return;
        }
        setRestoreDialogOpen(true);
    };

    const handleRestore = async () => {
        try {
            setRestoreDialogOpen(false);
            resetMessages();
            setApplying(true);

            if (fontChecked) await window.electronAPI.restoreAssetBackup('font');
            if (assetChecked) await window.electronAPI.restoreAssetBackup('asset');
            if (assetChecked) await clearAppliedPackEntries();

            await loadStatus();
            await loadFontTargets();
            const restoreMessage = assetChecked
                ? '백업 파일 복원이 완료되었습니다. 현재 적용 어셋팩 기록도 초기화했습니다.'
                : '백업 파일 복원이 완료되었습니다.';
            setMessage(restoreMessage);
            showNotification(restoreMessage, 'success');
        } catch (err) {
            showError(err, '백업 파일 복원 실패');
        } finally {
            setApplying(false);
        }
    };

    const handleClearAppliedPackHistory = async () => {
        try {
            resetMessages();
            if (!window.confirm('현재 적용 어셋팩 기록을 초기화하시겠습니까? 게임 업데이트나 외부 복원으로 원본 상태가 바뀐 경우에만 사용하세요.')) {
                return;
            }

            await clearAppliedPackEntries();
            setMessage('현재 적용 어셋팩 기록을 초기화했습니다.');
            showNotification('현재 적용 어셋팩 기록을 초기화했습니다.', 'success');
        } catch (err) {
            showError(err, '현재 적용 어셋팩 기록 초기화 실패');
        }
    };

    const handleSelectReplacement = async () => {
        try {
            resetMessages();
            const result = (await window.electronAPI.selectReplacementImage()) as SelectedImage | null;
            if (!result) return;

            setChangeMode('direct');
            setSelectedPackId('');
            setSelectedTargetId('');
            setReplacementPath(result.path || '');
            setReplacementUrl(result.url || '');
            setReplacementSize(result.size);
            setMessage('직접 선택 이미지가 변경 미리보기에 적용되었습니다.');
            showNotification('직접 선택 이미지가 변경 미리보기에 적용되었습니다.', 'success');
        } catch (err) {
            showError(err, '변경 이미지 선택 실패');
        }
    };

    const handleImportPack = async () => {
        setAssetPackDialogOpen(true);
    };

    const handleImportLocalPack = async () => {
        try {
            resetMessages();
            const zipPath = await window.electronAPI.selectAssetPackZip();
            if (!zipPath) return;

            const normalized = normalizePacks(await window.electronAPI.importAssetPack(zipPath));
            setPacks(normalized);

            const firstPack = normalized[0];
            if (firstPack) {
                setChangeMode('pack');
                setSelectedPackId(firstPack.packId || '');
                setSelectedTargetId('');
                setReplacementPath('');
                setReplacementUrl('');
                setMessage(`어셋팩을 등록했습니다: ${firstPack.packName}`);
                showNotification(`어셋팩을 등록했습니다: ${firstPack.packName}`, 'success');
            } else {
                setMessage('어셋팩을 등록했지만 표시할 항목이 없습니다.');
                showNotification('어셋팩을 등록했지만 표시할 항목이 없습니다.', 'info');
            }
        } catch (err) {
            showError(err, '어셋팩 등록 실패');
        }
    };

    const handleSelectItem = (itemId: string) => {
        setSelectedItemId(itemId || '');

        if (changeMode === 'pack') {
            setSelectedTargetId('');
            setReplacementPath('');
            setReplacementUrl('');
            setReplacementSize(undefined);
        }
    };

    const handleSelectPackTarget = (targetId: string) => {
        resetMessages();
        setSelectedTargetId(targetId || '');

        if (!targetId) {
            setReplacementPath('');
            setReplacementUrl('');
            setReplacementSize(undefined);
            return;
        }

        const target = allPackTargets.find((item) => item.id === targetId);
        if (!target) {
            showErrorMessage(`적용 대상을 찾지 못했습니다: ${targetId}`);
            return;
        }

        const matchedCatalog = catalog.find((item: AssetCatalogItem) => item.id === target.catalogId);
        if (matchedCatalog) {
            setSelectedItemId(matchedCatalog.id || '');
            setSelectedType(getCatalogCategory(matchedCatalog) || '');
            setSelectedGender(getCatalogOption1(matchedCatalog) || '');
        } else {
            setSelectedItemId('');
            showErrorMessage(`카탈로그 항목을 찾지 못했습니다: ${target.catalogId}`);
        }

        setChangeMode('pack');
        setSelectedPackId(target.packId || '');
        setReplacementPath(target.pngPath || '');
        setReplacementUrl(target.previewUrl || target.pngUrl || matchedCatalog?.previewUrl || '');
        setReplacementSize(target.size);
        setMessage(`적용 대상을 선택했습니다: ${formatTargetLabel(target)}`);
    };

    const handleApplyPatch = async () => {
        try {
            resetMessages();

            if (!selectedItem) {
                showErrorMessage('원본 텍스처를 먼저 선택하세요.');
                return;
            }

            if (!replacementPath) {
                showErrorMessage('변경 이미지를 먼저 선택하세요.');
                return;
            }

            setApplying(true);
            const settings = await window.electronAPI.getSettings();

            if (!settings.gamePath) {
                showErrorMessage('게임 경로가 설정되지 않았습니다.');
                return;
            }

            const target = changeMode === 'pack' && selectedTarget
                ? buildPatchTargetFromPackTarget(selectedTarget)
                : buildPatchTargetFromCatalogItem(selectedItem, replacementPath, replacementSize);

            if (!target.option2 && !isUiCategory(target.category || '')) {
                showErrorMessage('선택한 원본 텍스처에 option2 값이 없습니다. asset_catalog.json 또는 pack.json을 보강해야 합니다.');
                return;
            }

            await window.electronAPI.runClothesPatch({
                mode: 'single',
                gameId: 'LongYinLiZhiZhuan',
                gamePath: settings.gamePath,
                dryRun: false,
                stopOnError: true,
                targets: [target]
            });

            if (changeMode === 'pack' && selectedTarget) {
                await saveAppliedPackEntries([buildCurrentEntryFromTarget(selectedTarget)]);
            }

            setMessage('패치가 완료되었습니다.');
            showNotification('패치가 완료되었습니다.', 'success');
        } catch (err) {
            showError(err, '패치 실패');
        } finally {
            setApplying(false);
        }
    };

    const handleApplyPackAll = async () => {
        try {
            resetMessages();

            if (!selectedPack) {
                showErrorMessage('전체 적용할 어셋팩을 먼저 선택하세요.');
                return;
            }

            if (!selectedPack.targets.length) {
                showErrorMessage('선택한 어셋팩에 적용할 target이 없습니다.');
                return;
            }

            if (!window.confirm(`${selectedPack.packName}의 모든 target ${selectedPack.targets.length}개를 적용하시겠습니까?`)) {
                return;
            }

            setApplying(true);
            const settings = await window.electronAPI.getSettings();

            if (!settings.gamePath) {
                showErrorMessage('게임 경로가 설정되지 않았습니다.');
                return;
            }

            const targets = selectedPack.targets.map((target) => buildPatchTargetFromPackTarget({
                ...target,
                packId: selectedPack.packId,
                packName: selectedPack.packName
            }));

            if (targets.some((target) => !target.category || !target.pngPath || (!target.option2 && !isUiCategory(target.category || '')))) {
                showErrorMessage('팩 전체 적용 target 중 category/pngPath 또는 의상 option2가 비어 있는 항목이 있습니다. pack.json을 확인해야 합니다.');
                return;
            }

            await window.electronAPI.runClothesPatch({
                mode: 'pack_all',
                gameId: 'LongYinLiZhiZhuan',
                gamePath: settings.gamePath,
                dryRun: false,
                stopOnError: true,
                targets
            });

            await saveAppliedPackEntries(selectedPack.targets.map((target) => buildCurrentEntryFromTarget({
                ...target,
                packId: selectedPack.packId,
                packName: selectedPack.packName
            })));

            setMessage(`팩 전체 적용이 완료되었습니다. (${targets.length}개)`);
            showNotification(`팩 전체 적용이 완료되었습니다. (${targets.length}개)`, 'success');
        } catch (err) {
            showError(err, '팩 전체 적용 실패');
        } finally {
            setApplying(false);
        }
    };

    const handleFontExtract = async () => {
        try {
            resetMessages();
            setApplying(true);
            const settings = await window.electronAPI.getSettings();

            await window.electronAPI.runFontExtract({
                gameId: 'LongYinLiZhiZhuan',
                gamePath: settings.gamePath,
                overwrite: false
            });

            await loadFontTargets();
            setMessage('폰트 추출이 완료되었습니다.');
            showNotification('폰트 추출이 완료되었습니다.', 'success');
        } catch (err) {
            showError(err, '폰트 추출 실패');
        } finally {
            setApplying(false);
        }
    };

    const handleAddFont = async () => {
        try {
            resetMessages();
            const fontPath = await window.electronAPI.selectFile('.ttf,.otf,.ttc,.fontdata');
            if (!fontPath) return;

            const fonts = await window.electronAPI.importFont(fontPath);
            setStoredFonts(fonts);
            setMessage(`폰트를 추가했습니다: ${getFileName(fontPath)}`);
            showNotification(`폰트를 추가했습니다: ${getFileName(fontPath)}`, 'success');
        } catch (err) {
            showError(err, '폰트 추가 실패');
        }
    };

    const handleApplyFonts = async () => {
        try {
            setFontApplyDialogOpen(false);
            resetMessages();

            const jobs = Object.entries(selectedFonts)
                .filter(([, replacementFontFile]) => Boolean(replacementFontFile))
                .map(([pathId, replacementFontFile]) => ({
                    path_id: Number(pathId),
                    replacement_font_file: replacementFontFile
                }));

            if (!jobs.length) {
                showErrorMessage('교체할 폰트를 선택하세요.');
                return;
            }

            setApplying(true);
            const settings = await window.electronAPI.getSettings();

            await window.electronAPI.runFontPatch({
                gameId: 'LongYinLiZhiZhuan',
                gamePath: settings.gamePath,
                dryRun: false,
                stopOnError: true,
                jobs
            });

            await loadFontTargets();
            setMessage(`폰트 교체가 완료되었습니다. (${jobs.length}개)`);
            showNotification(`폰트 교체가 완료되었습니다. (${jobs.length}개)`, 'success');
        } catch (err) {
            showError(err, '폰트 교체 실패');
        } finally {
            setApplying(false);
        }
    };

    const handleFontSync = async () => {
        try {
            setFontSyncDialogOpen(false);
            resetMessages();
            setApplying(true);
            const settings = await window.electronAPI.getSettings();

            await window.electronAPI.runFontList({
                gamePath: settings.gamePath
            });

            await loadFontTargets();
            setMessage('현재 어셋파일의 폰트 리스트를 동기화했습니다.');
            showNotification('현재 어셋파일의 폰트 리스트를 동기화했습니다.', 'success');
        } catch (err) {
            showError(err, '폰트 리스트 동기화 실패');
        } finally {
            setApplying(false);
        }
    };

    const handleRestoreFontRow = async (pathId: number) => {
        try {
            resetMessages();
            setFontMenu(null);
            setApplying(true);
            const settings = await window.electronAPI.getSettings();

            await window.electronAPI.runFontRestore({
                gameId: 'LongYinLiZhiZhuan',
                gamePath: settings.gamePath,
                dryRun: false,
                stopOnError: true,
                jobs: [{ path_id: pathId }]
            });

            await loadFontTargets();
            setMessage(`${pathId} 폰트를 복원했습니다.`);
            showNotification(`${pathId} 폰트를 복원했습니다.`, 'success');
        } catch (err) {
            showError(err, '폰트 복원 실패');
        } finally {
            setApplying(false);
        }
    };

    return (
        <Box>
            <Typography variant="h5" sx={{ fontWeight: 800, color: 'var(--text-color)' }}>
                {t('nav.assetForge', currentLanguage)}
            </Typography>

            <Paper sx={sectionPaperSx}>
                <Typography variant="h6" sx={{ fontWeight: 800, color: 'var(--text-color)' }}>
                    백업 상태
                </Typography>

                <Box sx={{ mt: 2 }}>
                    <Typography sx={{ color: status.font ? 'var(--text-color-light)' : 'var(--accent-color)' }}>
                        폰트 백업: {formatBackupStatus(status.font)}
                    </Typography>
                    <Typography sx={{ color: status.asset ? 'var(--text-color-light)' : 'var(--accent-color)' }}>
                        어셋 백업: {formatBackupStatus(status.asset)}
                    </Typography>
                </Box>

                <Stack direction="row" spacing={2} sx={{ mt: 3, alignItems: 'center', flexWrap: 'wrap', rowGap: 1 }}>
                    <FormControlLabel
                        control={<Checkbox checked={fontChecked} onChange={(e) => setFontChecked(e.target.checked)} />}
                        label="폰트"
                        sx={{ color: 'var(--text-color)' }}
                    />
                    <FormControlLabel
                        control={<Checkbox checked={assetChecked} onChange={(e) => setAssetChecked(e.target.checked)} />}
                        label="어셋"
                        sx={{ color: 'var(--text-color)' }}
                    />
                    <Button variant="contained" startIcon={<BackupIcon />} onClick={handleOpenBackupDialog} sx={containedButtonSx}>
                        백업하기
                    </Button>
                    <Button variant="contained" startIcon={<RestoreIcon />} onClick={handleOpenRestoreDialog} disabled={applying} sx={containedButtonSx}>
                        복원하기
                    </Button>
                </Stack>
            </Paper>

            <Paper sx={{ ...sectionPaperSx, mt: 4 }}>
                <Tabs
                    value={activeTab}
                    onChange={(_event, value) => setActiveTab(value)}
                    sx={{
                        borderBottom: '1px solid var(--border-color)',
                        '.MuiTab-root': { color: 'var(--text-color-light)', fontWeight: 700 },
                        '.Mui-selected': { color: 'var(--text-color)' }
                    }}
                >
                    <Tab label="텍스처 교체 작업" />
                    <Tab label="폰트 교체 작업" />
                </Tabs>

                {activeTab === 0 && (
                    <Box sx={{ pt: 1 }}>
                        <TexturePanel
                            loading={loading}
                            types={types}
                            option1Values={genders}
                            filteredItems={filteredItems}
                            selectedType={selectedType}
                            selectedOption1={selectedGender}
                            selectedItemId={selectedItemId}
                            selectedItem={selectedItem}
                            originalPreviewUrl={originalPreviewUrl}
                            originalPreviewCaption={originalPreviewCaption}
                            currentAppliedLabel={currentAppliedForSelectedItem ? originalPreviewCaption : ''}
                            packs={packs}
                            selectedPack={selectedPack}
                            selectedPackId={selectedPackId}
                            selectedTargetId={selectedTargetId}
                            availablePackTargets={availablePackTargets}
                            replacementUrl={replacementUrl}
                            replacementCaption={replacementCaption}
                            changeMode={changeMode}
                            packSelectValue={packSelectValue}
                            replacementPath={replacementPath}
                            applying={applying}
                            currentAppliedCount={currentAssetPacks.length}
                            onTypeChange={(value) => {
                                setSelectedType(value);
                                handleSelectItem('');
                            }}
                            onOption1Change={(value) => {
                                setSelectedGender(value);
                                handleSelectItem('');
                            }}
                            onItemChange={handleSelectItem}
                            onModeChange={(value) => {
                                setChangeMode(value);
                                if (value === 'pack') {
                                    setReplacementPath('');
                                    setReplacementUrl('');
                                } else {
                                    setSelectedPackId('');
                                    setSelectedTargetId('');
                                }
                            }}
                            onPackChange={(value) => {
                                if (value === CUSTOM_PACK_VALUE) {
                                    setChangeMode('direct');
                                    setSelectedPackId('');
                                    setSelectedTargetId('');
                                    return;
                                }

                                setChangeMode('pack');
                                setSelectedPackId(value);
                                setSelectedTargetId('');
                                setReplacementPath('');
                                setReplacementUrl('');
                            }}
                            onPackTargetChange={handleSelectPackTarget}
                            onImportPack={handleImportPack}
                            onSelectReplacement={handleSelectReplacement}
                            onApplyPatch={handleApplyPatch}
                            onApplyPackAll={handleApplyPackAll}
                            onClearAppliedPackHistory={handleClearAppliedPackHistory}
                            onPreviewClick={(title, imageUrl, caption) => setPreviewDialog({ title, imageUrl, caption })}
                        />
                    </Box>
                )}

                {activeTab === 1 && (
                    <FontPanel
                        fontTargets={fontTargets}
                        storedFonts={storedFonts}
                        selectedFonts={selectedFonts}
                        applying={applying}
                        fontMenu={fontMenu}
                        onExtract={handleFontExtract}
                        onOpenSyncDialog={() => setFontSyncDialogOpen(true)}
                        onAddFont={handleAddFont}
                        onApplyFonts={() => {
                            if (!selectedFontJobCount) {
                                showErrorMessage('교체할 폰트를 선택하세요.');
                                return;
                            }
                            setFontApplyDialogOpen(true);
                        }}
                        onSelectFont={(pathId, fontPath) => setSelectedFonts((prev) => ({ ...prev, [pathId]: fontPath }))}
                        onContextMenu={(event, pathId) => {
                            event.preventDefault();
                            setFontMenu({ mouseX: event.clientX + 2, mouseY: event.clientY - 6, pathId });
                        }}
                        onCloseMenu={() => setFontMenu(null)}
                        onRestoreRow={handleRestoreFontRow}
                    />
                )}
            </Paper>

            {applying && (
                <Paper sx={sectionPaperSx}>
                    <LinearProgress />
                    <Typography sx={{ mt: 1, color: 'var(--text-color-light)' }}>
                        작업을 적용하는 중입니다.
                    </Typography>
                </Paper>
            )}

            {(message || error) && (
                <Paper sx={sectionPaperSx}>
                    {message && <Typography sx={{ color: 'var(--primary-color)' }}>{message}</Typography>}
                    {error && <Typography sx={{ color: 'var(--accent-color)', whiteSpace: 'pre-wrap' }}>{error}</Typography>}
                </Paper>
            )}

            <DeveloperGateDialog
                open={developerGateOpen}
                title="개발자 전용 도구"
                description="Catalog와 어셋팩 배포 파일을 직접 수정하는 숨김 도구입니다. 대상 정보가 UnityPy metadata와 맞지 않으면 실제 적용이 실패합니다."
                onClose={() => setDeveloperGateOpen(false)}
                onUnlocked={() => setDeveloperToolsOpen(true)}
            />

            <DeveloperToolsDialog
                open={developerToolsOpen}
                onClose={() => setDeveloperToolsOpen(false)}
                onOpenCatalog={() => setCatalogEditorOpen(true)}
                onOpenAssetPackDistribution={() => setAssetPackDistributionOpen(true)}
            />

            <CatalogEditorDialog
                open={catalogEditorOpen}
                onClose={() => setCatalogEditorOpen(false)}
                onSaved={async () => {
                    await reloadCatalog();
                    setMessage('asset_catalog.json을 저장했습니다.');
                    showNotification('asset_catalog.json을 저장했습니다.', 'success');
                }}
            />

            <AddAssetPackDialog
                open={assetPackDialogOpen}
                onClose={() => setAssetPackDialogOpen(false)}
                onImportLocal={handleImportLocalPack}
                onImported={(nextPacks, packName) => {
                    setPacks(normalizePacks(nextPacks));
                    setChangeMode('pack');
                    setSelectedPackId('');
                    setSelectedTargetId('');
                    setReplacementPath('');
                    setReplacementUrl('');
                    setMessage(`어셋팩을 등록했습니다: ${packName}`);
                    showNotification(`어셋팩을 등록했습니다: ${packName}`, 'success');
                }}
            />

            <AssetPackDistributionDialog
                open={assetPackDistributionOpen}
                onClose={() => setAssetPackDistributionOpen(false)}
                onCreated={(result) => {
                    setMessage(`어셋팩 배포 파일을 생성했습니다: ${result.item.name}`);
                    showNotification(`어셋팩 배포 파일을 생성했습니다: ${result.item.name}`, 'success');
                    window.electronAPI.importAssetPack(result.zipPath)
                        .then((nextPacks) => {
                            const normalized = normalizePacks(nextPacks);
                            setPacks(normalized);
                            const createdPack = normalized.find((pack) => pack.packId === result.item.id);
                            if (createdPack) {
                                setChangeMode('pack');
                                setSelectedPackId(createdPack.packId);
                                setSelectedTargetId('');
                                setReplacementPath('');
                                setReplacementUrl('');
                            }
                        })
                        .catch((err) => showError(err, '생성한 어셋팩 로컬 등록 실패'));
                }}
            />

            <ImagePreviewDialog
                preview={previewDialog}
                onClose={() => setPreviewDialog(null)}
            />

            <Dialog open={backupDialogOpen} onClose={ignoreBackdropClose(() => setBackupDialogOpen(false))} slotProps={{ paper: { sx: dialogPaperSx } }}>
                <DialogTitle sx={dialogTitleSx}>백업 확인</DialogTitle>
                <DialogContent sx={dialogContentSx}>
                    <Typography sx={{ color: 'var(--text-color)' }}>
                        현재 폰트와 어셋 기준으로 백업합니다.
                    </Typography>
                    {(status.font || status.asset) && (
                        <Typography sx={{ mt: 1.5, color: 'var(--text-color-light)' }}>
                            게임이 업데이트 되지 않은경우는 다시 백업할 필요가 없습니다.
                        </Typography>
                    )}
                </DialogContent>
                <DialogActions sx={dialogActionsSx}>
                    <Button onClick={() => setBackupDialogOpen(false)} sx={outlinedButtonSx}>취소</Button>
                    <Button variant="contained" startIcon={<CheckIcon />} onClick={handleBackup} sx={containedButtonSx}>
                        확인
                    </Button>
                </DialogActions>
            </Dialog>

            <Dialog open={restoreDialogOpen} onClose={ignoreBackdropClose(() => setRestoreDialogOpen(false))} slotProps={{ paper: { sx: dialogPaperSx } }}>
                <DialogTitle sx={dialogTitleSx}>복원 확인</DialogTitle>
                <DialogContent sx={dialogContentSx}>
                    <Typography sx={{ color: 'var(--text-color)' }}>
                        선택한 항목의 마지막 백업 파일을 게임 폴더에 복사해 현재 파일을 덮어씁니다.
                    </Typography>
                    <Typography sx={{ mt: 1.5, color: 'var(--text-color-light)' }}>
                        폰트는 `storage/backups/font`의 마지막 백업을, 어셋은 `storage/backups/asset`의 마지막 백업을 사용합니다.
                    </Typography>
                </DialogContent>
                <DialogActions sx={dialogActionsSx}>
                    <Button onClick={() => setRestoreDialogOpen(false)} sx={outlinedButtonSx}>취소</Button>
                    <Button variant="contained" startIcon={<RestoreIcon />} onClick={handleRestore} sx={containedButtonSx}>
                        복원하기
                    </Button>
                </DialogActions>
            </Dialog>

            <Dialog open={fontSyncDialogOpen} onClose={ignoreBackdropClose(() => setFontSyncDialogOpen(false))} slotProps={{ paper: { sx: dialogPaperSx } }}>
                <DialogTitle sx={dialogTitleSx}>폰트 리스트 동기화</DialogTitle>
                <DialogContent sx={dialogContentSx}>
                    <Typography sx={{ color: 'var(--text-color)' }}>
                        현재 어셋파일의 폰트내용을 확인하여 리스트를 동기화합니다.
                    </Typography>
                </DialogContent>
                <DialogActions sx={dialogActionsSx}>
                    <Button onClick={() => setFontSyncDialogOpen(false)} sx={outlinedButtonSx}>취소</Button>
                    <Button variant="contained" startIcon={<CheckIcon />} onClick={handleFontSync} sx={containedButtonSx}>
                        확인
                    </Button>
                </DialogActions>
            </Dialog>

            <Dialog open={fontApplyDialogOpen} onClose={ignoreBackdropClose(() => setFontApplyDialogOpen(false))} slotProps={{ paper: { sx: dialogPaperSx } }}>
                <DialogTitle sx={dialogTitleSx}>선택 폰트 적용 확인</DialogTitle>
                <DialogContent sx={dialogContentSx}>
                    <Typography sx={{ color: 'var(--text-color)' }}>
                        선택한 폰트 {selectedFontJobCount}개를 현재 어셋파일에 적용합니다.
                    </Typography>
                </DialogContent>
                <DialogActions sx={dialogActionsSx}>
                    <Button onClick={() => setFontApplyDialogOpen(false)} sx={outlinedButtonSx}>취소</Button>
                    <Button variant="contained" startIcon={<CheckIcon />} onClick={handleApplyFonts} sx={containedButtonSx}>
                        확인
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}

function TexturePanel({
    loading,
    types,
    option1Values,
    filteredItems,
    selectedType,
    selectedOption1,
    selectedItemId,
    selectedItem,
    originalPreviewUrl,
    originalPreviewCaption,
    currentAppliedLabel,
    packs,
    selectedPack,
    selectedPackId,
    selectedTargetId,
    availablePackTargets,
    replacementUrl,
    replacementCaption,
    changeMode,
    packSelectValue,
    replacementPath,
    applying,
    currentAppliedCount,
    onTypeChange,
    onOption1Change,
    onItemChange,
    onModeChange,
    onPackChange,
    onPackTargetChange,
    onImportPack,
    onSelectReplacement,
    onApplyPatch,
    onApplyPackAll,
    onClearAppliedPackHistory,
    onPreviewClick
}: {
    loading: boolean;
    types: string[];
    option1Values: string[];
    filteredItems: AssetCatalogItem[];
    selectedType: string;
    selectedOption1: string;
    selectedItemId: string;
    selectedItem?: AssetCatalogItem;
    originalPreviewUrl: string;
    originalPreviewCaption: string;
    currentAppliedLabel: string;
    packs: AssetPack[];
    selectedPack?: AssetPack;
    selectedPackId: string;
    selectedTargetId: string;
    availablePackTargets: AssetPackTargetOption[];
    replacementUrl: string;
    replacementCaption: string;
    changeMode: ChangeMode;
    packSelectValue: string;
    replacementPath: string;
    applying: boolean;
    currentAppliedCount: number;
    onTypeChange: (value: string) => void;
    onOption1Change: (value: string) => void;
    onItemChange: (value: string) => void;
    onModeChange: (value: ChangeMode) => void;
    onPackChange: (value: string) => void;
    onPackTargetChange: (value: string) => void;
    onImportPack: () => void;
    onSelectReplacement: () => void;
    onApplyPatch: () => void;
    onApplyPackAll: () => void;
    onClearAppliedPackHistory: () => void;
    onPreviewClick: (title: string, imageUrl: string, caption?: string) => void;
}) {
    return (
        <>
            <Paper sx={innerPaperSx}>
                <Typography sx={{ fontWeight: 800, color: 'var(--text-color)' }}>원본 대상 선택</Typography>
                <Stack direction="row" spacing={2} sx={{ mt: 2, flexWrap: 'wrap', rowGap: 2 }}>
                    <FormControl size="small" sx={{ minWidth: 180 }}>
                        <InputLabel sx={{ color: 'var(--text-color-light)' }}>종류</InputLabel>
                        <Select value={selectedType} label="종류" onChange={(e) => onTypeChange(String(e.target.value || ''))} sx={selectSx}>
                            <MenuItem value="">전체</MenuItem>
                            {types.map((itemType) => (
                                <MenuItem key={itemType} value={itemType}>{toKoreanCategory(itemType)}</MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                    <FormControl size="small" sx={{ minWidth: 180 }}>
                        <InputLabel sx={{ color: 'var(--text-color-light)' }}>대상 구분</InputLabel>
                        <Select value={selectedOption1} label="대상 구분" onChange={(e) => onOption1Change(String(e.target.value || ''))} sx={selectSx}>
                            <MenuItem value="">전체</MenuItem>
                            {option1Values.map((itemOption1) => (
                                <MenuItem key={itemOption1} value={itemOption1}>{toTargetGroupLabel(itemOption1)}</MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                    <FormControl size="small" sx={{ minWidth: 320 }}>
                        <InputLabel sx={{ color: 'var(--text-color-light)' }}>원본 텍스처</InputLabel>
                        <Select value={selectedItemId} label="원본 텍스처" onChange={(e) => onItemChange(String(e.target.value || ''))} sx={selectSx}>
                            <MenuItem value="">선택 안함</MenuItem>
                            {filteredItems.map((item) => (
                                <MenuItem key={item.id} value={item.id}>{formatCatalogItemLabel(item)}</MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </Stack>
                {loading && <Typography sx={{ mt: 2, color: 'var(--text-color-light)' }}>카탈로그를 불러오는 중입니다.</Typography>}
                {currentAppliedLabel && (
                    <Alert severity="success" sx={{ mt: 2 }}>
                        {currentAppliedLabel}
                    </Alert>
                )}
            </Paper>

            <Paper sx={innerPaperSx}>
                <Typography sx={{ fontWeight: 800, color: 'var(--text-color)' }}>변경 방식 선택</Typography>
                <RadioGroup row value={changeMode} onChange={(e) => onModeChange(e.target.value as ChangeMode)} sx={{ mt: 1 }}>
                    <FormControlLabel value="pack" control={<Radio />} label="어셋팩 사용" sx={{ color: 'var(--text-color)' }} />
                    <FormControlLabel value="direct" control={<Radio />} label="직접 이미지 선택" sx={{ color: 'var(--text-color)' }} />
                </RadioGroup>
                <Divider sx={{ my: 2, borderColor: 'var(--border-color)' }} />
                <Stack direction="row" spacing={2} sx={{ flexWrap: 'wrap', rowGap: 2, alignItems: 'center' }}>
                    <FormControl size="small" sx={{ minWidth: 260 }}>
                        <InputLabel sx={{ color: 'var(--text-color-light)' }}>팩 선택</InputLabel>
                        <Select value={packSelectValue} label="팩 선택" onChange={(e) => onPackChange(String(e.target.value || ''))} sx={selectSx}>
                            <MenuItem value="">전체</MenuItem>
                            {replacementPath && <MenuItem value={CUSTOM_PACK_VALUE}>커스텀</MenuItem>}
                            {packs.map((pack) => <MenuItem key={pack.packId} value={pack.packId}>{pack.packName}</MenuItem>)}
                        </Select>
                    </FormControl>
                    <FormControl size="small" sx={{ minWidth: 360 }}>
                        <InputLabel sx={{ color: 'var(--text-color-light)' }}>적용 대상</InputLabel>
                        <Select
                            value={selectedTargetId}
                            label="적용 대상"
                            disabled={changeMode !== 'pack'}
                            onChange={(e) => onPackTargetChange(String(e.target.value || ''))}
                            sx={selectSx}
                        >
                            <MenuItem value="">선택 안함</MenuItem>
                            {availablePackTargets.map((target) => (
                                <MenuItem key={target.id} value={target.id}>{formatTargetLabel(target)}</MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                    <Button variant="contained" startIcon={<UploadFileIcon />} onClick={onImportPack} sx={containedButtonSx}>어셋팩 추가</Button>
                    <Button variant="contained" startIcon={<FileDownloadIcon />} onClick={onSelectReplacement} sx={containedButtonSx}>변경 이미지 직접 선택</Button>
                    <Button
                        variant="outlined"
                        startIcon={<RestoreIcon />}
                        onClick={onClearAppliedPackHistory}
                        disabled={currentAppliedCount === 0 || applying}
                        sx={outlinedButtonSx}
                    >
                        적용 기록 초기화
                    </Button>
                </Stack>
                {selectedPack && changeMode === 'pack' && (
                    <Typography sx={{ mt: 2, color: 'var(--text-color-light)' }}>
                        {selectedPack.author ? `${selectedPack.author} · ` : ''}
                        {selectedPack.description || '설명 없음'}
                    </Typography>
                )}
            </Paper>

            <Paper sx={innerPaperSx}>
                <Typography sx={{ fontWeight: 800, color: 'var(--text-color)' }}>미리보기</Typography>
                <Stack direction="row" spacing={3} sx={{ mt: 2, flexWrap: 'wrap', rowGap: 3 }}>
                    <PreviewCard
                        title="원본 미리보기"
                        imageUrl={originalPreviewUrl}
                        emptyText="원본 텍스처를 선택하세요."
                        caption={originalPreviewCaption}
                        onClick={(imageUrl) => onPreviewClick('원본 미리보기', imageUrl, originalPreviewCaption)}
                    />
                    <PreviewCard
                        title="변경 미리보기"
                        imageUrl={replacementUrl}
                        emptyText="어셋팩 대상 또는 직접 이미지를 선택하세요."
                        caption={replacementCaption}
                        onClick={(imageUrl) => onPreviewClick('변경 미리보기', imageUrl, replacementCaption)}
                    />
                </Stack>
            </Paper>

            <Paper sx={innerPaperSx}>
                <Typography sx={{ fontWeight: 800, color: 'var(--text-color)' }}>적용</Typography>
                <Stack direction="row" spacing={2} sx={{ mt: 2, flexWrap: 'wrap', rowGap: 1 }}>
                    <Button variant="contained" disabled={!selectedItem || !replacementPath || applying} startIcon={<CheckIcon />} onClick={onApplyPatch} sx={containedButtonSx}>
                        적용
                    </Button>
                    <Button variant="outlined" disabled={!selectedPack || !selectedPack.targets.length || applying} startIcon={<CheckIcon />} onClick={onApplyPackAll} sx={outlinedButtonSx}>
                        팩 전체 적용
                    </Button>
                </Stack>
            </Paper>
        </>
    );
}

function ImagePreviewDialog({
    preview,
    onClose
}: {
    preview: PreviewDialogState;
    onClose: () => void;
}) {
    return (
        <Dialog open={Boolean(preview)} onClose={ignoreBackdropClose(onClose)} maxWidth="lg" fullWidth slotProps={{ paper: { sx: dialogPaperSx } }}>
            <DialogTitle sx={dialogTitleSx}>{preview?.title || '미리보기'}</DialogTitle>
            <DialogContent sx={dialogContentSx}>
                {preview?.imageUrl && (
                    <Box
                        component="img"
                        src={preview.imageUrl}
                        sx={{
                            display: 'block',
                            width: '100%',
                            maxHeight: '72vh',
                            objectFit: 'contain',
                            background: 'var(--bg-color)',
                            border: '1px solid var(--border-color)',
                            borderRadius: 1
                        }}
                    />
                )}
                {preview?.caption && (
                    <Typography sx={{ mt: 1, color: 'var(--text-color-light)', wordBreak: 'break-all' }}>
                        {preview.caption}
                    </Typography>
                )}
            </DialogContent>
            <DialogActions sx={dialogActionsSx}>
                <Button onClick={onClose} sx={outlinedButtonSx}>닫기</Button>
            </DialogActions>
        </Dialog>
    );
}

function DeveloperToolsDialog({
    open,
    onClose,
    onOpenCatalog,
    onOpenAssetPackDistribution
}: {
    open: boolean;
    onClose: () => void;
    onOpenCatalog: () => void;
    onOpenAssetPackDistribution: () => void;
}) {
    return (
        <Dialog open={open} onClose={ignoreBackdropClose(onClose)} maxWidth="sm" fullWidth slotProps={{ paper: { sx: dialogPaperSx } }}>
            <DialogTitle sx={dialogTitleSx}>개발자 전용 도구</DialogTitle>
            <DialogContent sx={dialogContentSx}>
                <Alert severity="warning" sx={{ mb: 2 }}>
                    이 창은 배포 catalog와 로컬 설정 파일을 직접 수정합니다. 변경 후 커밋 전에 생성된 파일 경로와 JSON 내용을 확인하세요.
                </Alert>
                <Stack spacing={1.5}>
                    <Paper sx={{ p: 1.5, background: 'var(--bg-color)', border: '1px solid var(--border-color)' }}>
                        <Typography sx={{ color: 'var(--text-color)', fontWeight: 800 }}>Catalog Editor</Typography>
                        <Typography sx={{ color: 'var(--text-color-light)', fontSize: 13, mt: 0.5 }}>
                            config/asset_catalog.json의 원본 대상 정보를 수정합니다.
                        </Typography>
                        <Button variant="outlined" onClick={onOpenCatalog} sx={{ ...outlinedButtonSx, mt: 1 }}>
                            열기
                        </Button>
                    </Paper>
                    <Paper sx={{ p: 1.5, background: 'var(--bg-color)', border: '1px solid var(--border-color)' }}>
                        <Typography sx={{ color: 'var(--text-color)', fontWeight: 800 }}>어셋팩 배포</Typography>
                        <Typography sx={{ color: 'var(--text-color-light)', fontSize: 13, mt: 0.5 }}>
                            asset-packs/index.json과 packages, thumbnails 폴더를 생성하거나 갱신합니다.
                        </Typography>
                        <Button variant="outlined" onClick={onOpenAssetPackDistribution} sx={{ ...outlinedButtonSx, mt: 1 }}>
                            열기
                        </Button>
                    </Paper>
                </Stack>
            </DialogContent>
            <DialogActions sx={dialogActionsSx}>
                <Button onClick={onClose} sx={outlinedButtonSx}>닫기</Button>
            </DialogActions>
        </Dialog>
    );
}

function AddAssetPackDialog({
    open,
    onClose,
    onImportLocal,
    onImported
}: {
    open: boolean;
    onClose: () => void;
    onImportLocal: () => Promise<void>;
    onImported: (packs: AssetPack[], packName: string) => void;
}) {
    const [activeTab, setActiveTab] = useState<'online' | 'local'>('online');
    const [onlinePacks, setOnlinePacks] = useState<OnlineAssetPackCatalogItem[]>([]);
    const [onlineLoading, setOnlineLoading] = useState(false);
    const [onlineLoaded, setOnlineLoaded] = useState(false);
    const [onlineWorkingId, setOnlineWorkingId] = useState<string | null>(null);
    const [error, setError] = useState('');

    const loadOnlinePacks = async () => {
        setOnlineLoading(true);
        setError('');
        try {
            setOnlinePacks(await window.electronAPI.getOnlineAssetPackCatalog());
        } catch (err) {
            setOnlinePacks([]);
            setError(err instanceof Error ? err.message : '온라인 어셋팩 목록을 불러오지 못했습니다.');
        } finally {
            setOnlineLoaded(true);
            setOnlineLoading(false);
        }
    };

    useEffect(() => {
        if (open && activeTab === 'online' && !onlineLoaded && !onlineLoading) {
            void loadOnlinePacks();
        }
    }, [open, activeTab, onlineLoaded, onlineLoading]);

    const handleOnlineAction = async (item: OnlineAssetPackCatalogItem) => {
        setOnlineWorkingId(item.id);
        setError('');
        try {
            const result = item.installed && item.updateAvailable
                ? await window.electronAPI.updateOnlineAssetPack(item)
                : await window.electronAPI.downloadOnlineAssetPack(item);
            onImported(normalizePacks(result), item.name);
            setOnlinePacks(await window.electronAPI.getOnlineAssetPackCatalog());
        } catch (err) {
            setError(err instanceof Error ? err.message : '온라인 어셋팩 처리 실패');
        } finally {
            setOnlineWorkingId(null);
        }
    };

    const handleLocalImport = async () => {
        await onImportLocal();
        onClose();
    };

    return (
        <Dialog open={open} onClose={ignoreBackdropClose(onClose)} maxWidth="md" fullWidth slotProps={{ paper: { sx: dialogPaperSx } }}>
            <DialogTitle sx={dialogTitleSx}>어셋팩 추가</DialogTitle>
            <Tabs
                value={activeTab}
                onChange={(_event, value) => setActiveTab(value)}
                sx={{
                    borderBottom: '1px solid var(--border-color)',
                    '& .MuiTab-root': { color: 'var(--text-color-light)' },
                    '& .Mui-selected': { color: 'var(--primary-color)' },
                    '& .MuiTabs-indicator': { backgroundColor: 'var(--primary-color)' }
                }}
            >
                <Tab value="online" label="온라인" />
                <Tab value="local" label="로컬" />
            </Tabs>
            <DialogContent sx={dialogContentSx}>
                {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
                {activeTab === 'online' ? (
                    <Stack spacing={2}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, alignItems: 'center' }}>
                            <Typography sx={{ color: 'var(--text-color-light)', fontSize: 13 }}>
                                GitHub catalog에서 등록된 어셋팩을 설치하거나 업데이트합니다.
                            </Typography>
                            <Button
                                size="small"
                                variant="outlined"
                                startIcon={onlineLoading ? <CircularProgress size={14} /> : <RefreshIcon />}
                                onClick={loadOnlinePacks}
                                disabled={onlineLoading}
                                sx={outlinedButtonSx}
                            >
                                새로고침
                            </Button>
                        </Box>
                        <Stack spacing={1}>
                            {onlinePacks.map((item) => {
                                const working = onlineWorkingId === item.id;
                                const actionLabel = item.installed
                                    ? item.updateAvailable
                                        ? '업데이트'
                                        : '설치됨'
                                    : '다운로드';
                                return (
                                    <Paper
                                        key={item.id}
                                        sx={{ p: 1.25, background: 'var(--input-bg-color)', border: '1px solid var(--border-color)' }}
                                    >
                                        <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center' }}>
                                            <Box
                                                sx={{
                                                    width: 96,
                                                    height: 64,
                                                    border: '1px solid var(--border-color)',
                                                    background: 'var(--sidebar-bg-color)',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    flexShrink: 0
                                                }}
                                            >
                                                {item.thumbnailUrl ? (
                                                    <Box component="img" src={item.thumbnailUrl} sx={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                                                ) : (
                                                    <Typography sx={{ color: 'var(--text-color-light)', fontSize: 11 }}>No image</Typography>
                                                )}
                                            </Box>
                                            <Box sx={{ flex: 1, minWidth: 0 }}>
                                                <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                                                    <Typography sx={{ color: 'var(--text-color)', fontWeight: 800 }}>{item.name}</Typography>
                                                    <Chip label={`v${item.version}`} size="small" sx={{ height: 20, fontSize: 11 }} />
                                                    {item.installed && (
                                                        <Chip
                                                            label={item.updateAvailable ? `업데이트 가능: ${item.installedVersion}` : '설치됨'}
                                                            size="small"
                                                            sx={{
                                                                height: 20,
                                                                fontSize: 11,
                                                                background: item.updateAvailable ? 'var(--warn-color, #e6a817)' : 'var(--primary-color)',
                                                                color: '#fff'
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
                                                startIcon={working ? <CircularProgress size={14} /> : item.updateAvailable ? <UpdateIcon /> : <DownloadIcon />}
                                                disabled={working || (item.installed && !item.updateAvailable)}
                                                onClick={() => handleOnlineAction(item)}
                                                sx={item.updateAvailable || !item.installed ? containedButtonSx : outlinedButtonSx}
                                            >
                                                {actionLabel}
                                            </Button>
                                        </Stack>
                                    </Paper>
                                );
                            })}
                            {!onlineLoading && onlinePacks.length === 0 && (
                                <Typography sx={{ color: 'var(--text-color-light)', textAlign: 'center', py: 3 }}>
                                    {error ? '온라인 어셋팩 목록을 표시할 수 없습니다.' : '표시할 온라인 어셋팩이 없습니다.'}
                                </Typography>
                            )}
                            {onlineLoading && (
                                <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                                    <CircularProgress size={24} />
                                </Box>
                            )}
                        </Stack>
                    </Stack>
                ) : (
                    <Stack spacing={2}>
                        <Typography sx={{ color: 'var(--text-color-light)', fontSize: 13 }}>
                            로컬 Asset Pack ZIP을 선택해 storage/asset_packs에 등록합니다.
                        </Typography>
                        <Button variant="contained" startIcon={<UploadFileIcon />} onClick={handleLocalImport} sx={containedButtonSx}>
                            로컬 ZIP 선택
                        </Button>
                    </Stack>
                )}
            </DialogContent>
            <DialogActions sx={dialogActionsSx}>
                <Button onClick={onClose} sx={outlinedButtonSx}>닫기</Button>
            </DialogActions>
        </Dialog>
    );
}

function AssetPackDistributionDialog({
    open,
    onClose,
    onCreated
}: {
    open: boolean;
    onClose: () => void;
    onCreated: (result: { item: OnlineAssetPackCatalogItem; indexPath: string; zipPath: string; thumbnailPath?: string }) => void;
}) {
    type DistributionTargetRow = {
        rowId: string;
        pngPath: string;
        pngUrl: string;
        fileName: string;
        size?: SizeTuple;
        catalogId: string;
        displayLabel: string;
        category: string;
        option1: string;
        option1Label: string;
        option2: string;
        textureName: string;
        pathId: string;
    };

    const [id, setId] = useState('');
    const [name, setName] = useState('');
    const [author, setAuthor] = useState('HexX');
    const [description, setDescription] = useState('');
    const [version, setVersion] = useState('1.0.0');
    const [zipPath, setZipPath] = useState('');
    const [thumbnailPath, setThumbnailPath] = useState('');
    const [catalogItems, setCatalogItems] = useState<AssetCatalogItem[]>([]);
    const [targetRows, setTargetRows] = useState<DistributionTargetRow[]>([]);
    const [resultText, setResultText] = useState('');
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!open) return;

        window.electronAPI.getAssetCatalog()
            .then((result) => setCatalogItems((result.items || []) as AssetCatalogItem[]))
            .catch(() => setCatalogItems([]));
    }, [open]);

    const updateTargetRow = (rowId: string, patch: Partial<DistributionTargetRow>) => {
        setTargetRows((prev) => prev.map((row) => (row.rowId === rowId ? { ...row, ...patch } : row)));
    };

    const applyCatalogToRow = (rowId: string, catalogId: string) => {
        const item = catalogItems.find((candidate) => candidate.id === catalogId);
        if (!item) {
            updateTargetRow(rowId, { catalogId });
            return;
        }

        updateTargetRow(rowId, {
            catalogId,
            displayLabel: item.displayLabel || formatCatalogItemLabel(item),
            category: getCatalogCategory(item),
            option1: getCatalogOption1(item),
            option1Label: item.option1Label || toTargetGroupLabel(getCatalogOption1(item)),
            option2: getCatalogOption2(item),
            textureName: item.textureName || '',
            pathId: String(item.pathId || '')
        });
    };

    const handleSelectPngs = async () => {
        const selected = (await window.electronAPI.selectAssetPackPngs()) as Array<{
            path: string;
            name: string;
            url: string;
            size?: SizeTuple;
        }>;
        if (!selected.length) return;

        setZipPath('');
        setTargetRows((prev) => [
            ...prev,
            ...selected.map((file, index) => ({
                rowId: `${Date.now()}_${index}_${file.name}`,
                pngPath: file.path,
                pngUrl: file.url,
                fileName: file.name,
                size: file.size,
                catalogId: '',
                displayLabel: '',
                category: 'UI',
                option1: '',
                option1Label: '',
                option2: '',
                textureName: '',
                pathId: ''
            }))
        ]);

        if (!id && selected[0]) {
            const baseName = selected[0].name.replace(/\.png$/i, '');
            setId(baseName);
            setName((prev) => prev || baseName);
        }
    };

    const handleSelectZip = async () => {
        const selected = await window.electronAPI.selectAssetPackZip();
        if (!selected) return;
        setZipPath(selected);
        setTargetRows([]);
        if (!id) {
            const fileName = getFileName(selected).replace(/\.zip$/i, '');
            setId(fileName);
            setName((prev) => prev || fileName);
        }
    };

    const handleSelectThumbnail = async () => {
        const selected = await window.electronAPI.selectAssetPackThumbnail();
        if (!selected) return;
        setThumbnailPath(selected);
    };

    const handleCreate = async () => {
        setSaving(true);
        setError('');
        setResultText('');
        try {
            const invalidRow = targetRows.find((row) => (
                !row.catalogId ||
                !row.category ||
                !row.option1 ||
                !row.textureName ||
                !row.pathId ||
                (!row.option2 && !isUiCategory(row.category))
            ));
            if (invalidRow) {
                throw new Error(`${invalidRow.fileName}: 적용대상 정보를 모두 입력하세요. UI가 아닌 target은 option2도 필요합니다.`);
            }

            const result = await window.electronAPI.createAssetPackDistribution({
                id,
                name,
                author,
                description,
                version,
                zipPath: zipPath || undefined,
                thumbnailPath,
                gameIds: ['long-yin-li-zhi-zhuan'],
                targets: targetRows.map((row) => ({
                    catalogId: row.catalogId,
                    category: row.category,
                    option1: row.option1,
                    gender: row.option1,
                    option1Label: row.option1Label,
                    option2: row.option2,
                    displayLabel: row.displayLabel,
                    textureName: row.textureName,
                    pathId: Number(row.pathId),
                    size: row.size,
                    pngPath: row.pngPath,
                    previewPath: row.pngPath
                }))
            });
            setResultText([
                `index: ${result.indexPath}`,
                `zip: ${result.zipPath}`,
                result.thumbnailPath ? `thumbnail: ${result.thumbnailPath}` : ''
            ].filter(Boolean).join('\n'));
            onCreated(result);
        } catch (err) {
            setError(err instanceof Error ? err.message : '어셋팩 배포 파일 생성 실패');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onClose={ignoreBackdropClose(onClose)} maxWidth="md" fullWidth slotProps={{ paper: { sx: dialogPaperSx } }}>
            <DialogTitle sx={dialogTitleSx}>어셋팩 배포용 파일 생성</DialogTitle>
            <DialogContent sx={dialogContentSx}>
                <Typography sx={{ color: 'var(--text-color-light)', mb: 2, fontSize: 13 }}>
                    PNG를 여러 개 추가한 뒤 각 PNG마다 적용대상을 지정하면 pack.json과 배포 ZIP이 함께 생성됩니다. thumbnail PNG는 최대 420x280으로 축소됩니다.
                </Typography>
                {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
                <Stack spacing={1.5}>
                    <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', rowGap: 1 }}>
                        <TextField size="small" label="id" value={id} onChange={(e) => setId(e.target.value)} sx={editorFieldSx(180)} />
                        <TextField size="small" label="제목" value={name} onChange={(e) => setName(e.target.value)} sx={editorFieldSx(220)} />
                        <TextField size="small" label="version" value={version} onChange={(e) => setVersion(e.target.value)} sx={editorFieldSx(120)} />
                        <TextField size="small" label="제작자" value={author} onChange={(e) => setAuthor(e.target.value)} sx={editorFieldSx(160)} />
                    </Stack>
                    <TextField
                        size="small"
                        label="설명"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        multiline
                        minRows={3}
                        sx={{ ...editorFieldSx(1), width: '100%' }}
                    />
                    <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', rowGap: 1, alignItems: 'center' }}>
                        <Button variant="contained" startIcon={<UploadFileIcon />} onClick={handleSelectPngs} sx={containedButtonSx}>
                            PNG 추가
                        </Button>
                        <Button variant="outlined" startIcon={<UploadFileIcon />} onClick={handleSelectZip} sx={outlinedButtonSx}>
                            완성 ZIP 선택
                        </Button>
                        <Typography sx={{ color: 'var(--text-color-light)', fontSize: 12, wordBreak: 'break-all' }}>
                            {targetRows.length ? `PNG ${targetRows.length}개` : zipPath || '선택된 파일 없음'}
                        </Typography>
                    </Stack>
                    <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', rowGap: 1, alignItems: 'center' }}>
                        <Button variant="outlined" startIcon={<UploadFileIcon />} onClick={handleSelectThumbnail} sx={outlinedButtonSx}>
                            미리보기 PNG 선택
                        </Button>
                        <Typography sx={{ color: 'var(--text-color-light)', fontSize: 12, wordBreak: 'break-all' }}>
                            {thumbnailPath || '선택된 PNG 없음'}
                        </Typography>
                    </Stack>
                    {targetRows.length > 0 && (
                        <Stack spacing={1.25}>
                            {targetRows.map((row, index) => (
                                <Paper key={row.rowId} sx={{ p: 1.5, background: 'var(--bg-color)', border: '1px solid var(--border-color)' }}>
                                    <Stack direction="row" spacing={1.25} sx={{ alignItems: 'flex-start' }}>
                                        <Box
                                            component="img"
                                            src={row.pngUrl}
                                            sx={{
                                                width: 104,
                                                height: 72,
                                                objectFit: 'contain',
                                                border: '1px solid var(--border-color)',
                                                background: 'var(--sidebar-bg-color)',
                                                flexShrink: 0
                                            }}
                                        />
                                        <Box sx={{ flex: 1, minWidth: 0 }}>
                                            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1 }}>
                                                <Typography sx={{ color: 'var(--text-color)', fontWeight: 800 }}>
                                                    {index + 1}. {row.fileName}
                                                </Typography>
                                                {row.size && (
                                                    <Chip label={`${row.size[0]}x${row.size[1]}`} size="small" sx={{ height: 20, fontSize: 11 }} />
                                                )}
                                                <Button
                                                    size="small"
                                                    variant="outlined"
                                                    onClick={() => setTargetRows((prev) => prev.filter((target) => target.rowId !== row.rowId))}
                                                    sx={outlinedButtonSx}
                                                >
                                                    제거
                                                </Button>
                                            </Stack>
                                            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', rowGap: 1 }}>
                                                <FormControl size="small" sx={{ minWidth: 240 }}>
                                                    <InputLabel sx={{ color: 'var(--text-color-light)' }}>적용대상</InputLabel>
                                                    <Select
                                                        value={row.catalogId}
                                                        label="적용대상"
                                                        onChange={(event) => applyCatalogToRow(row.rowId, String(event.target.value || ''))}
                                                        sx={selectSx}
                                                    >
                                                        <MenuItem value="">선택 안함</MenuItem>
                                                        {catalogItems.map((item) => (
                                                            <MenuItem key={item.id} value={item.id}>{formatCatalogItemLabel(item)}</MenuItem>
                                                        ))}
                                                    </Select>
                                                </FormControl>
                                                <TextField size="small" label="드롭다운 표시명" value={row.displayLabel} onChange={(e) => updateTargetRow(row.rowId, { displayLabel: e.target.value })} sx={editorFieldSx(180)} />
                                                <TextField size="small" label="종류" value={row.category} onChange={(e) => updateTargetRow(row.rowId, { category: e.target.value })} sx={editorFieldSx(90)} />
                                                <TextField size="small" label="대상 구분" value={row.option1} onChange={(e) => updateTargetRow(row.rowId, { option1: e.target.value })} sx={editorFieldSx(110)} />
                                                <TextField size="small" label="대상 라벨" value={row.option1Label} onChange={(e) => updateTargetRow(row.rowId, { option1Label: e.target.value })} sx={editorFieldSx(110)} />
                                                <TextField size="small" label="option2" value={row.option2} onChange={(e) => updateTargetRow(row.rowId, { option2: e.target.value })} sx={editorFieldSx(120)} />
                                                <TextField size="small" label="textureName" value={row.textureName} onChange={(e) => updateTargetRow(row.rowId, { textureName: e.target.value })} sx={editorFieldSx(150)} />
                                                <TextField size="small" label="pathId" value={row.pathId} onChange={(e) => updateTargetRow(row.rowId, { pathId: e.target.value })} sx={editorFieldSx(90)} />
                                            </Stack>
                                        </Box>
                                    </Stack>
                                </Paper>
                            ))}
                        </Stack>
                    )}
                    {resultText && (
                        <Alert severity="success">
                            <Typography component="pre" sx={{ m: 0, whiteSpace: 'pre-wrap', fontSize: 12 }}>
                                {resultText}
                            </Typography>
                        </Alert>
                    )}
                </Stack>
            </DialogContent>
            <DialogActions sx={dialogActionsSx}>
                <Button onClick={onClose} sx={outlinedButtonSx}>닫기</Button>
                <Button variant="contained" onClick={handleCreate} disabled={saving} sx={containedButtonSx}>
                    생성
                </Button>
            </DialogActions>
        </Dialog>
    );
}

type CatalogEditorRow = Omit<AssetCatalogItem, 'pathId' | 'size'> & {
    rowId: string;
    pathId: string;
    sizeText: string;
};

function toCatalogEditorRow(item: AssetCatalogItem): CatalogEditorRow {
    return {
        ...item,
        rowId: item.id || `row_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        option1: getCatalogOption1(item),
        option1Label: item.option1Label || toTargetGroupLabel(getCatalogOption1(item)),
        displayLabel: item.displayLabel || formatCatalogItemLabel(item),
        pathId: String(item.pathId || ''),
        sizeText: item.size ? `${item.size[0]},${item.size[1]}` : ''
    };
}

function toCatalogItem(row: CatalogEditorRow): AssetCatalogItem {
    const sizeParts = row.sizeText.split(',').map((value) => Number(value.trim()));
    const option1 = row.option1?.trim() || row.gender?.trim() || '';

    return {
        id: row.id.trim(),
        gender: option1,
        type: row.category?.trim() || row.type?.trim() || '',
        label: row.label?.trim() || row.displayLabel?.trim() || row.id.trim(),
        textureName: row.textureName.trim(),
        pathId: Number(row.pathId),
        category: row.category?.trim() || row.type?.trim() || '',
        option1,
        option1Label: row.option1Label?.trim() || option1,
        option2: row.option2?.trim() || '',
        displayLabel: row.displayLabel?.trim() || row.label?.trim() || '',
        preview: row.preview?.trim() || '',
        size: [sizeParts[0], sizeParts[1]],
        previewUrl: row.previewUrl || ''
    };
}

function createCatalogEditorRow(): CatalogEditorRow {
    return {
        rowId: `row_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        id: '',
        gender: '',
        type: 'UI',
        label: '',
        textureName: '',
        pathId: '',
        category: 'UI',
        option1: '',
        option1Label: '',
        option2: '',
        displayLabel: '',
        preview: '',
        previewUrl: '',
        sizeText: ''
    };
}

function validateEditorRows(rows: CatalogEditorRow[]): string {
    const seen = new Set<string>();

    for (const [index, row] of rows.entries()) {
        const prefix = `${index + 1}번째 항목`;
        const required = [
            ['id', row.id],
            ['category', row.category],
            ['option1', row.option1],
            ['textureName', row.textureName],
            ['pathId', row.pathId],
            ['size', row.sizeText]
        ];

        if (!isUiCategory(row.category || '')) {
            required.push(['option2', row.option2]);
        }

        for (const [name, value] of required) {
            if (!String(value || '').trim()) return `${prefix}: ${name} 값이 없습니다.`;
        }

        if (seen.has(row.id.trim())) return `${prefix}: id가 중복되었습니다.`;
        seen.add(row.id.trim());

        if (!Number.isFinite(Number(row.pathId))) return `${prefix}: pathId가 올바르지 않습니다.`;

        const sizeParts = row.sizeText.split(',').map((value) => Number(value.trim()));
        if (sizeParts.length !== 2 || sizeParts.some((value) => !Number.isFinite(value) || value <= 0)) {
            return `${prefix}: size는 width,height 형식이어야 합니다.`;
        }
    }

    return '';
}

function CatalogEditorDialog({
    open,
    onClose,
    onSaved
}: {
    open: boolean;
    onClose: () => void;
    onSaved: () => void | Promise<void>;
}) {
    const [rows, setRows] = useState<CatalogEditorRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const loadRows = async () => {
        setLoading(true);
        setError('');

        try {
            const result = await window.electronAPI.getCatalogEditorData();
            setRows((result.items || []).map((item: AssetCatalogItem) => toCatalogEditorRow(item)));
        } catch (err) {
            setError(err instanceof Error ? err.message : 'asset_catalog.json을 불러오지 못했습니다.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (open) {
            loadRows();
        }
    }, [open]);

    const updateRow = (index: number, patch: Partial<CatalogEditorRow>) => {
        setRows((prev) => prev.map((row, rowIndex) => {
            if (rowIndex !== index) return row;

            const next = { ...row, ...patch };
            if ('category' in patch || 'option1Label' in patch) {
                next.displayLabel = next.displayLabel || [toKoreanCategory(next.category || ''), next.option1Label || next.option1].filter(Boolean).join(' ');
            }
            return next;
        }));
    };

    const handleImportPreview = async (index: number) => {
        const row = rows[index];
        const result = await window.electronAPI.importCatalogPreviewImage({
            id: row.id,
            category: row.category || row.type
        });

        if (!result) return;

        updateRow(index, {
            preview: result.preview,
            previewUrl: result.url,
            sizeText: row.sizeText || (result.size ? `${result.size[0]},${result.size[1]}` : row.sizeText)
        });
    };

    const handleSave = async () => {
        const validationError = validateEditorRows(rows);
        if (validationError) {
            setError(validationError);
            return;
        }

        setLoading(true);
        setError('');

        try {
            await window.electronAPI.saveCatalogEditorData({
                schemaVersion: 2,
                items: rows.map(toCatalogItem)
            });
            await onSaved();
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'asset_catalog.json 저장에 실패했습니다.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onClose={ignoreBackdropClose(onClose)} maxWidth="xl" fullWidth slotProps={{ paper: { sx: dialogPaperSx } }}>
            <DialogTitle sx={dialogTitleSx}>비밀 Catalog Editor</DialogTitle>
            <DialogContent sx={dialogContentSx}>
                <Alert severity="info" sx={{ mb: 2 }}>
                    이 창은 앱 표시용 `config/asset_catalog.json`을 편집합니다. 실제 패치 검증은 category별 UnityPy metadata가 기준입니다. 의상/기존 texture는 `metadata/data.tsv`와 option2가 필요하고, UI texture는 `metadata/ui_textures.tsv`의 pathID/PNG 크기와 일치해야 합니다.
                </Alert>
                {error && <Typography sx={{ color: 'var(--accent-color)', mb: 2 }}>{error}</Typography>}
                <Stack spacing={1.5}>
                    {rows.map((row, index) => (
                        <Paper key={row.rowId} sx={{ p: 1.5, background: 'var(--bg-color)', border: '1px solid var(--border-color)' }}>
                            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', rowGap: 1, alignItems: 'center' }}>
                                <TextField size="small" label="id" value={row.id} onChange={(e) => updateRow(index, { id: e.target.value })} sx={editorFieldSx(170)} />
                                <TextField size="small" label="표시명" value={row.displayLabel || ''} onChange={(e) => updateRow(index, { displayLabel: e.target.value, label: e.target.value })} sx={editorFieldSx(170)} />
                                <TextField size="small" label="종류" value={row.category || ''} onChange={(e) => updateRow(index, { category: e.target.value, type: e.target.value })} sx={editorFieldSx(100)} />
                                <TextField size="small" label="대상 구분" value={row.option1 || ''} onChange={(e) => updateRow(index, { option1: e.target.value, gender: e.target.value })} sx={editorFieldSx(120)} />
                                <TextField size="small" label="대상 라벨" value={row.option1Label || ''} onChange={(e) => updateRow(index, { option1Label: e.target.value })} sx={editorFieldSx(120)} />
                                <TextField size="small" label="option2" value={row.option2 || ''} onChange={(e) => updateRow(index, { option2: e.target.value })} sx={editorFieldSx(140)} />
                                <TextField size="small" label="textureName" value={row.textureName || ''} onChange={(e) => updateRow(index, { textureName: e.target.value })} sx={editorFieldSx(140)} />
                                <TextField size="small" label="pathId" value={row.pathId} onChange={(e) => updateRow(index, { pathId: e.target.value })} sx={editorFieldSx(90)} />
                                <TextField size="small" label="size" value={row.sizeText} onChange={(e) => updateRow(index, { sizeText: e.target.value })} sx={editorFieldSx(110)} />
                                <Chip
                                    label={getPatchMetadataLabel(row.category || row.type || '')}
                                    size="small"
                                    sx={{
                                        height: 28,
                                        fontSize: 11,
                                        background: isUiCategory(row.category || row.type || '')
                                            ? 'rgba(80, 160, 255, 0.16)'
                                            : 'rgba(230, 168, 23, 0.16)',
                                        color: 'var(--text-color)'
                                    }}
                                />
                            </Stack>
                            <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: 'wrap', rowGap: 1, alignItems: 'center' }}>
                                <TextField size="small" label="preview" value={row.preview || ''} onChange={(e) => updateRow(index, { preview: e.target.value })} sx={editorFieldSx(300)} />
                                <Button variant="outlined" onClick={() => handleImportPreview(index)} sx={outlinedButtonSx}>원본 미리보기 선택</Button>
                                <Button
                                    variant="outlined"
                                    startIcon={<DeleteIcon />}
                                    onClick={() => setRows((prev) => prev.filter((_row, rowIndex) => rowIndex !== index))}
                                    sx={outlinedButtonSx}
                                >
                                    삭제
                                </Button>
                                {row.previewUrl && <Box component="img" src={row.previewUrl} sx={editorPreviewSx} />}
                            </Stack>
                        </Paper>
                    ))}
                </Stack>
                <Button variant="outlined" onClick={() => setRows((prev) => [...prev, createCatalogEditorRow()])} sx={{ ...outlinedButtonSx, mt: 2 }}>
                    항목 추가
                </Button>
            </DialogContent>
            <DialogActions sx={dialogActionsSx}>
                <Button onClick={onClose} sx={outlinedButtonSx}>닫기</Button>
                <Button variant="contained" onClick={handleSave} disabled={loading} sx={containedButtonSx}>저장</Button>
            </DialogActions>
        </Dialog>
    );
}

function editorFieldSx(width: number) {
    return {
        width,
        '& .MuiInputBase-root': {
            color: 'var(--text-color)',
            background: 'var(--input-bg-color)'
        },
        '& .MuiInputLabel-root': {
            color: 'var(--text-color-light)'
        },
        '& .MuiOutlinedInput-notchedOutline': {
            borderColor: 'var(--border-color)'
        }
    };
}

const editorPreviewSx = {
    width: 64,
    height: 64,
    objectFit: 'contain',
    border: '1px solid var(--border-color)',
    borderRadius: 1,
    background: 'var(--sidebar-bg-color)'
};

function FontPanel({
    fontTargets,
    storedFonts,
    selectedFonts,
    applying,
    fontMenu,
    onExtract,
    onOpenSyncDialog,
    onAddFont,
    onApplyFonts,
    onSelectFont,
    onContextMenu,
    onCloseMenu,
    onRestoreRow
}: {
    fontTargets: FontTarget[];
    storedFonts: StoredFont[];
    selectedFonts: Record<number, string>;
    applying: boolean;
    fontMenu: { mouseX: number; mouseY: number; pathId: number } | null;
    onExtract: () => void;
    onOpenSyncDialog: () => void;
    onAddFont: () => void;
    onApplyFonts: () => void;
    onSelectFont: (pathId: number, fontPath: string) => void;
    onContextMenu: (event: React.MouseEvent, pathId: number) => void;
    onCloseMenu: () => void;
    onRestoreRow: (pathId: number) => void;
}) {
    return (
        <Paper sx={innerPaperSx}>
            <Stack direction="row" spacing={2} sx={{ flexWrap: 'wrap', rowGap: 1, alignItems: 'center' }}>
                <Button variant="contained" startIcon={<FontDownloadIcon />} onClick={onExtract} disabled={applying} sx={containedButtonSx}>
                    폰트 추출
                </Button>
                <Button variant="contained" startIcon={<SyncIcon />} onClick={onOpenSyncDialog} disabled={applying} sx={containedButtonSx}>
                    동기화
                </Button>
                <Button variant="contained" startIcon={<UploadFileIcon />} onClick={onAddFont} disabled={applying} sx={containedButtonSx}>
                    폰트 추가
                </Button>
                <Button variant="outlined" startIcon={<CheckIcon />} onClick={onApplyFonts} disabled={applying} sx={outlinedButtonSx}>
                    선택 폰트 적용
                </Button>
                <Typography sx={{ color: 'var(--text-color-light)', fontSize: 13 }}>
                    저장된 폰트 {storedFonts.length}개
                </Typography>
            </Stack>

            <TableContainer sx={{ mt: 2, border: '1px solid var(--border-color)' }}>
                <Table size="small">
                    <TableHead>
                        <TableRow>
                            <TableCell sx={fontHeadSx}>적용대상</TableCell>
                            <TableCell sx={fontHeadSx}>현재폰트</TableCell>
                            <TableCell sx={fontHeadSx}>교체폰트</TableCell>
                            <TableCell sx={fontHeadSx}>미리보기</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {fontTargets.map((target) => {
                            const replacementPath = selectedFonts[target.pathId] || '';
                            const replacementFont = storedFonts.find((font) => font.path === replacementPath);
                            const targetDisplay = getFontTargetDisplay(target.pathId);

                            return (
                                <TableRow
                                    key={target.pathId}
                                    hover
                                    onContextMenu={(event) => onContextMenu(event, target.pathId)}
                                    sx={{ '&:hover td': { background: 'var(--hover-bg-color)' } }}
                                >
                                    <TableCell sx={fontCenteredCellSx}>
                                        <Tooltip title={targetDisplay.tooltip}>
                                            <Box component="span" sx={{ cursor: 'help' }}>{targetDisplay.label}</Box>
                                        </Tooltip>
                                    </TableCell>
                                    <TableCell sx={fontCenteredCellSx}>
                                        {target.currentFont || '추출된 폰트 없음'}
                                    </TableCell>
                                    <TableCell sx={fontCellSx}>
                                        <FormControl size="small" fullWidth>
                                            <Select
                                                value={replacementPath}
                                                displayEmpty
                                                onChange={(event) => onSelectFont(target.pathId, String(event.target.value || ''))}
                                                sx={selectSx}
                                            >
                                                <MenuItem value="">선택 안함</MenuItem>
                                                {storedFonts.map((font) => (
                                                    <MenuItem key={font.path} value={font.path}>{font.name}</MenuItem>
                                                ))}
                                            </Select>
                                        </FormControl>
                                    </TableCell>
                                    <TableCell sx={fontCellSx}>
                                        <FontPreviewPair
                                            pathId={target.pathId}
                                            currentFontUrl={target.currentFontUrl}
                                            replacementFontUrl={replacementFont?.url || ''}
                                        />
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </TableContainer>

            <Menu
                open={Boolean(fontMenu)}
                onClose={onCloseMenu}
                anchorReference="anchorPosition"
                anchorPosition={fontMenu ? { top: fontMenu.mouseY, left: fontMenu.mouseX } : undefined}
            >
                <MenuItem onClick={() => fontMenu && onRestoreRow(fontMenu.pathId)}>
                    <RestoreIcon fontSize="small" sx={{ mr: 1 }} />
                    복원하기
                </MenuItem>
            </Menu>
        </Paper>
    );
}

const fontHeadSx = {
    color: 'var(--text-color)',
    fontWeight: 800,
    textAlign: 'center',
    borderColor: 'var(--border-color)',
    background: 'var(--sidebar-bg-color)'
};

const fontCellSx = {
    color: 'var(--text-color)',
    borderColor: 'var(--border-color)'
};

const fontCenteredCellSx = {
    ...fontCellSx,
    textAlign: 'center'
};

function FontPreviewPair({
    pathId,
    currentFontUrl,
    replacementFontUrl
}: {
    pathId: number;
    currentFontUrl: string;
    replacementFontUrl: string;
}) {
    const currentFamily = currentFontUrl ? `hexx-current-font-${pathId}` : '';
    const replacementFamily = replacementFontUrl ? `hexx-replacement-font-${pathId}` : '';

    return (
        <Stack direction="row" spacing={1} sx={{ minWidth: 300 }}>
            <FontPreviewBox
                family={currentFamily}
                url={currentFontUrl}
                text="현재폰트"
            />
            <FontPreviewBox
                family={replacementFamily}
                url={replacementFontUrl}
                text="교체폰트"
            />
        </Stack>
    );
}

function FontPreviewBox({
    family,
    url,
    text
}: {
    family: string;
    url: string;
    text: string;
}) {
    return (
        <Box
            sx={{
                flex: 1,
                minWidth: 0,
                p: 1,
                border: '1px solid var(--border-color)',
                borderRadius: 1,
                background: 'var(--bg-color)',
                textAlign: 'center',
                color: 'var(--text-color)'
            }}
        >
            {url && (
                <Box component="style" key={`${family}-${url}`}>
                    {`@font-face { font-family: "${family}"; src: url("${url}"); font-display: block; }`}
                </Box>
            )}
            <Typography
                sx={{
                    fontFamily: family ? `"${family}", sans-serif` : 'inherit',
                    fontSize: 18,
                    lineHeight: 1.4,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                }}
            >
                {text}
            </Typography>
        </Box>
    );
}

function PreviewCard({
    title,
    imageUrl,
    emptyText,
    caption,
    onClick
}: {
    title: string;
    imageUrl: string;
    emptyText: string;
    caption?: string;
    onClick?: (imageUrl: string) => void;
}) {
    return (
        <Box
            sx={{
                width: 420,
                minHeight: 360,
                p: 2,
                border: '1px solid var(--border-color)',
                borderRadius: 2,
                background: 'var(--bg-color)'
            }}
        >
            <Typography sx={{ fontWeight: 700, color: 'var(--text-color)', mb: 1 }}>
                {title}
            </Typography>
            {imageUrl ? (
                <Box
                    component="img"
                    src={imageUrl}
                    onClick={() => onClick?.(imageUrl)}
                    sx={{
                        width: '100%',
                        height: 280,
                        objectFit: 'contain',
                        border: '1px solid var(--border-color)',
                        borderRadius: 1,
                        background: 'var(--sidebar-bg-color)',
                        cursor: onClick ? 'zoom-in' : 'default'
                    }}
                />
            ) : (
                <Box
                    sx={{
                        height: 280,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '1px dashed var(--border-color)',
                        borderRadius: 1,
                        color: 'var(--text-color-light)',
                        textAlign: 'center',
                        px: 2
                    }}
                >
                    {emptyText}
                </Box>
            )}
            {caption && (
                <Typography sx={{ mt: 1, color: 'var(--text-color-light)', fontSize: 12, wordBreak: 'break-all' }}>
                    {caption}
                </Typography>
            )}
        </Box>
    );
}
