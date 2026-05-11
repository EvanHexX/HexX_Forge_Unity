import { useEffect, useMemo, useState } from 'react';
import BackupIcon from '@mui/icons-material/Backup';
import CheckIcon from '@mui/icons-material/Check';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import FontDownloadIcon from '@mui/icons-material/FontDownload';
import RestoreIcon from '@mui/icons-material/Restore';
import SyncIcon from '@mui/icons-material/Sync';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import {
    Box,
    Button,
    Checkbox,
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
    Tooltip,
    Typography
} from '@mui/material';
import { useTextureCatalog } from '../hooks/useTextureCatalog';
import { useNotification } from '../context/NotificationContext';
import { getSafeLanguage, t, type LanguageCode } from '../i18n';

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
    option2?: string;
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
    category: string;
    option2: string;
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
    basePath: string;
    targets: AssetPackTarget[];
};

type AssetPackTargetOption = AssetPackTarget & {
    packId: string;
    packName: string;
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
    male: '남성'
};

const categoryLabelMap: Record<string, string> = {
    outfit: '의상',
    clothing: '의상',
    clothes: '의상',
    body: '몸',
    face: '얼굴',
    hair: '헤어',
    building: '건물'
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

function toKoreanCategory(value: string): string {
    return categoryLabelMap[value] || value || '종류 미지정';
}

function formatTargetLabel(target: Pick<AssetPackTarget, 'option2' | 'gender' | 'category'>): string {
    return [target.option2?.trim(), toKoreanGender(target.gender), toKoreanCategory(target.category)]
        .filter(Boolean)
        .join(' ');
}

function getCatalogCategory(item: AssetCatalogItem): string {
    return item.category || item.type || '';
}

function getCatalogOption2(item: AssetCatalogItem): string {
    if (item.option2?.trim()) return item.option2.trim();

    const rawLabel = item.label?.trim() || '';
    return rawLabel
        .replace(toKoreanGender(item.gender), '')
        .replace(toKoreanCategory(getCatalogCategory(item)), '')
        .replace(item.textureName, '')
        .replace(/원본/g, '')
        .trim();
}

function formatCatalogItemLabel(item: AssetCatalogItem): string {
    const optionLabel = getCatalogOption2(item) || item.textureName || item.label?.trim() || '';
    return [optionLabel, toKoreanGender(item.gender), toKoreanCategory(getCatalogCategory(item))]
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
        option1: target.gender,
        gender: target.gender,
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
        option1: item.gender,
        gender: item.gender,
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
    const { data: catalog, loading } = useTextureCatalog();

    const [currentLanguage, setCurrentLanguage] = useState<LanguageCode>('en');
    const [status, setStatus] = useState<BackupStatus>({ font: null, asset: null });
    const [fontChecked, setFontChecked] = useState(true);
    const [assetChecked, setAssetChecked] = useState(true);
    const [backupDialogOpen, setBackupDialogOpen] = useState(false);
    const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
    const [fontSyncDialogOpen, setFontSyncDialogOpen] = useState(false);
    const [fontApplyDialogOpen, setFontApplyDialogOpen] = useState(false);

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

    useEffect(() => {
        window.electronAPI.getSettings().then((settings) => {
            setCurrentLanguage(getSafeLanguage(settings.language));
        });
        loadStatus().catch((err) => showError(err, '백업 상태 로드 실패'));
        loadPacks().catch((err) => showError(err, '어셋팩 목록 로드 실패'));
        loadFontTargets().catch((err) => showError(err, '폰트 목록 로드 실패'));
        loadStoredFonts().catch((err) => showError(err, '저장된 폰트 목록 로드 실패'));
    }, []);

    const types = useMemo(
        () => [...new Set(catalog.map((item: AssetCatalogItem) => getCatalogCategory(item)).filter(Boolean))],
        [catalog]
    );

    const genders = useMemo(
        () => [...new Set(catalog.map((item: AssetCatalogItem) => item.gender))],
        [catalog]
    );

    const filteredItems = useMemo(
        () => catalog.filter((item: AssetCatalogItem) => (
            (!selectedType || getCatalogCategory(item) === selectedType) &&
            (!selectedGender || item.gender === selectedGender)
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

            await loadStatus();
            await loadFontTargets();
            setMessage('백업 파일 복원이 완료되었습니다.');
            showNotification('백업 파일 복원이 완료되었습니다.', 'success');
        } catch (err) {
            showError(err, '백업 파일 복원 실패');
        } finally {
            setApplying(false);
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
            setSelectedGender(matchedCatalog.gender || '');
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

            if (!target.option2) {
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

            if (targets.some((target) => !target.option2 || !target.category || !target.pngPath)) {
                showErrorMessage('팩 전체 적용 target 중 option2/category/pngPath가 비어 있는 항목이 있습니다. pack.json을 확인해야 합니다.');
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
                            genders={genders}
                            filteredItems={filteredItems}
                            selectedType={selectedType}
                            selectedGender={selectedGender}
                            selectedItemId={selectedItemId}
                            selectedItem={selectedItem}
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
                            onTypeChange={(value) => {
                                setSelectedType(value);
                                handleSelectItem('');
                            }}
                            onGenderChange={(value) => {
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

            <Dialog open={backupDialogOpen} onClose={() => setBackupDialogOpen(false)} slotProps={{ paper: { sx: dialogPaperSx } }}>
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

            <Dialog open={restoreDialogOpen} onClose={() => setRestoreDialogOpen(false)} slotProps={{ paper: { sx: dialogPaperSx } }}>
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

            <Dialog open={fontSyncDialogOpen} onClose={() => setFontSyncDialogOpen(false)} slotProps={{ paper: { sx: dialogPaperSx } }}>
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

            <Dialog open={fontApplyDialogOpen} onClose={() => setFontApplyDialogOpen(false)} slotProps={{ paper: { sx: dialogPaperSx } }}>
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
    genders,
    filteredItems,
    selectedType,
    selectedGender,
    selectedItemId,
    selectedItem,
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
    onTypeChange,
    onGenderChange,
    onItemChange,
    onModeChange,
    onPackChange,
    onPackTargetChange,
    onImportPack,
    onSelectReplacement,
    onApplyPatch,
    onApplyPackAll
}: {
    loading: boolean;
    types: string[];
    genders: string[];
    filteredItems: AssetCatalogItem[];
    selectedType: string;
    selectedGender: string;
    selectedItemId: string;
    selectedItem?: AssetCatalogItem;
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
    onTypeChange: (value: string) => void;
    onGenderChange: (value: string) => void;
    onItemChange: (value: string) => void;
    onModeChange: (value: ChangeMode) => void;
    onPackChange: (value: string) => void;
    onPackTargetChange: (value: string) => void;
    onImportPack: () => void;
    onSelectReplacement: () => void;
    onApplyPatch: () => void;
    onApplyPackAll: () => void;
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
                        <InputLabel sx={{ color: 'var(--text-color-light)' }}>성별</InputLabel>
                        <Select value={selectedGender} label="성별" onChange={(e) => onGenderChange(String(e.target.value || ''))} sx={selectSx}>
                            <MenuItem value="">전체</MenuItem>
                            {genders.map((itemGender) => (
                                <MenuItem key={itemGender} value={itemGender}>{toKoreanGender(itemGender)}</MenuItem>
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
                        imageUrl={selectedItem?.previewUrl || ''}
                        emptyText="원본 텍스처를 선택하세요."
                        caption={selectedItem ? formatCatalogItemLabel(selectedItem) : ''}
                    />
                    <PreviewCard
                        title="변경 미리보기"
                        imageUrl={replacementUrl}
                        emptyText="어셋팩 대상 또는 직접 이미지를 선택하세요."
                        caption={replacementCaption}
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
    caption
}: {
    title: string;
    imageUrl: string;
    emptyText: string;
    caption?: string;
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
                    sx={{
                        width: '100%',
                        height: 280,
                        objectFit: 'contain',
                        border: '1px solid var(--border-color)',
                        borderRadius: 1,
                        background: 'var(--sidebar-bg-color)'
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
