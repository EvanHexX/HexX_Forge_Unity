// src/renderer/pages/AssetManager.tsx
// Asset 백업, 원본 텍스처 선택, 의상팩/직접 이미지 기반 텍스처 교체 UI입니다.

import { useEffect, useMemo, useState } from 'react';
import {
    Box,
    Button,
    Checkbox,
    Divider,
    FormControl,
    FormControlLabel,
    InputLabel,
    LinearProgress,
    MenuItem,
    Paper,
    Radio,
    RadioGroup,
    Select,
    Stack,
    Typography
} from '@mui/material';
import { useTextureCatalog } from '../hooks/useTextureCatalog';

type BackupStatus = {
    font: string | null;
    asset: string | null;
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

type ChangeMode = 'pack' | 'direct';

const CUSTOM_PACK_VALUE = '__custom__';

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

function normalizePacks(value: unknown): AssetPack[] {
    if (Array.isArray(value)) {
        return value as AssetPack[];
    }

    if (
        value &&
        typeof value === 'object' &&
        'packs' in value &&
        Array.isArray((value as { packs: unknown }).packs)
    ) {
        return (value as { packs: AssetPack[] }).packs;
    }

    if (
        value &&
        typeof value === 'object' &&
        'packId' in value &&
        'targets' in value
    ) {
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
    const optionLabel = target.option2?.trim();
    const genderLabel = toKoreanGender(target.gender);
    const categoryLabel = toKoreanCategory(target.category);

    return [optionLabel, genderLabel, categoryLabel].filter(Boolean).join(' ');
}

function getCatalogCategory(item: AssetCatalogItem): string {
    return item.category || item.type || '';
}

function getCatalogOption2(item: AssetCatalogItem): string {
    if (item.option2?.trim()) {
        return item.option2.trim();
    }

    const genderLabel = toKoreanGender(item.gender);
    const categoryLabel = toKoreanCategory(getCatalogCategory(item));
    const rawLabel = item.label?.trim() || '';

    // ✅ legacy asset_catalog.json 보정: label에서 UI 장식어를 제거해 option2 후보를 만든다.
    // 신규 catalog에서는 반드시 option2를 명시하는 것을 권장한다.
    return rawLabel
        .replace(genderLabel, '')
        .replace(categoryLabel, '')
        .replace(item.textureName, '')
        .replace(/원본/g, '')
        .trim();
}

function formatCatalogType(value: string): string {
    return toKoreanCategory(value);
}

function formatCatalogItemLabel(item: AssetCatalogItem): string {
    const genderLabel = toKoreanGender(item.gender);
    const categoryLabel = toKoreanCategory(getCatalogCategory(item));
    const optionLabel = getCatalogOption2(item) || item.textureName || item.label?.trim() || '';

    return [optionLabel, genderLabel, categoryLabel].filter(Boolean).join(' ');
}

function formatPackCaption(target?: AssetPackTargetOption): string {
    if (!target) return '';

    return `${target.packName}: ${formatTargetLabel(target)}`;
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
        // 직접 선택 PNG는 main process에서 읽은 실제 PNG size를 우선 전달한다.
        // size 매칭/검증 최종 판단은 AssetManager_UnityPy의 data.tsv 기준 로직에 맡긴다.
        size: replacementSize || item.size,
        pngPath
    };
}

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

export default function AssetManager() {
    const [status, setStatus] = useState<BackupStatus>({
        font: null,
        asset: null
    });

    const [fontChecked, setFontChecked] = useState(true);
    const [assetChecked, setAssetChecked] = useState(true);

    const { data: catalog, loading } = useTextureCatalog();

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

    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [applying, setApplying] = useState(false);

    const loadStatus = async () => {
        const nextStatus = await window.electronAPI.getAssetStatus();
        setStatus(nextStatus);
    };

    const loadPacks = async () => {
        const result = await window.electronAPI.getAssetPacks();
        const normalized = normalizePacks(result);
        setPacks(normalized);
    };

    useEffect(() => {
        loadStatus().catch((err) => {
            setError(err instanceof Error ? err.message : '백업 상태 로드 실패');
        });

        loadPacks().catch((err) => {
            setError(err instanceof Error ? err.message : '의상팩 목록 로드 실패');
        });
    }, []);

    const types = useMemo(() => {
        return [...new Set(catalog.map((item: AssetCatalogItem) => getCatalogCategory(item)).filter(Boolean))];
    }, [catalog]);

    const genders = useMemo(() => {
        return [...new Set(catalog.map((item: AssetCatalogItem) => item.gender))];
    }, [catalog]);

    const filteredItems = useMemo(() => {
        return catalog.filter((item: AssetCatalogItem) => {
            return (
                (!selectedType || getCatalogCategory(item) === selectedType) &&
                (!selectedGender || item.gender === selectedGender)
            );
        });
    }, [catalog, selectedType, selectedGender]);

    const selectedItem = useMemo(() => {
        return catalog.find((item: AssetCatalogItem) => item.id === selectedItemId);
    }, [catalog, selectedItemId]);

    const selectedPack = useMemo(() => {
        return packs.find((pack) => pack.packId === selectedPackId);
    }, [packs, selectedPackId]);

    const allPackTargets = useMemo<AssetPackTargetOption[]>(() => {
        return packs.flatMap((pack) =>
            pack.targets.map((target) => ({
                ...target,
                packId: pack.packId,
                packName: pack.packName
            }))
        );
    }, [packs]);

    const availablePackTargets = useMemo<AssetPackTargetOption[]>(() => {
        return allPackTargets.filter((target) => {
            const matchPack = !selectedPackId || target.packId === selectedPackId;
            const matchCatalog = !selectedItem || target.catalogId === selectedItem.id;

            return matchPack && matchCatalog;
        });
    }, [allPackTargets, selectedItem, selectedPackId]);

    const selectedTarget = useMemo(() => {
        return allPackTargets.find((target) => target.id === selectedTargetId);
    }, [allPackTargets, selectedTargetId]);

    const packSelectValue = changeMode === 'direct' && replacementPath
        ? CUSTOM_PACK_VALUE
        : selectedPackId || '';

    const replacementCaption = useMemo(() => {
        if (changeMode === 'direct' && replacementPath) {
            return `커스텀: ${replacementPath}`;
        }

        return formatPackCaption(selectedTarget);
    }, [changeMode, replacementPath, selectedTarget]);

    useEffect(() => {
        if (changeMode !== 'pack') return;
        if (!selectedTarget) return;
        if (!selectedItem) return;
        if (selectedTarget.catalogId === selectedItem.id) return;

        setSelectedTargetId('');
        setReplacementPath('');
        setReplacementUrl('');
        setReplacementSize(undefined);
    }, [changeMode, selectedItem, selectedTarget]);

    const handleBackup = async () => {
        try {
            setMessage('');
            setError('');

            if (fontChecked) {
                await window.electronAPI.backupAsset('font');
            }

            if (assetChecked) {
                await window.electronAPI.backupAsset('asset');
            }

            await loadStatus();
            setMessage('백업이 완료되었습니다.');
        } catch (err) {
            setError(err instanceof Error ? err.message : '백업 실패');
        }
    };

    const handleSelectReplacement = async () => {
        try {
            setMessage('');
            setError('');

            const result = (await window.electronAPI.selectReplacementImage()) as SelectedImage | null;

            if (!result) return;

            setChangeMode('direct');
            setSelectedPackId('');
            setSelectedTargetId('');
            setReplacementPath(result.path || '');
            setReplacementUrl(result.url || '');
            setReplacementSize(result.size);
            setMessage('직접 선택 이미지가 변경 미리보기에 적용되었습니다.');
        } catch (err) {
            setError(err instanceof Error ? err.message : '변경 이미지 선택 실패');
        }
    };

    const handleImportPack = async () => {
        try {
            setMessage('');
            setError('');

            const zipPath = await window.electronAPI.selectAssetPackZip();

            if (!zipPath) return;

            const result = await window.electronAPI.importAssetPack(zipPath);
            const normalized = normalizePacks(result);

            setPacks(normalized);

            const firstPack = normalized[0];

            if (firstPack) {
                setChangeMode('pack');
                setSelectedPackId(firstPack.packId || '');
                setSelectedTargetId('');
                setReplacementPath('');
                setReplacementUrl('');
                setMessage(`의상팩을 등록했습니다: ${firstPack.packName}`);
            } else {
                setMessage('의상팩을 등록했지만 표시할 팩이 없습니다.');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : '의상팩 등록 실패');
        }
    };

    const handleSelectItem = (itemId: string) => {
        const nextItemId = itemId || '';
        setSelectedItemId(nextItemId);

        if (changeMode === 'pack') {
            setSelectedTargetId('');
            setReplacementPath('');
            setReplacementUrl('');
            setReplacementSize(undefined);
        }
    };

    const handleSelectPackTarget = (targetId: string) => {
        const safeTargetId = targetId || '';
        setSelectedTargetId(safeTargetId);
        setMessage('');
        setError('');

        if (!safeTargetId) {
            setReplacementPath('');
            setReplacementUrl('');
            setReplacementSize(undefined);
            return;
        }

        const target = allPackTargets.find((item) => item.id === safeTargetId);

        if (!target) {
            setError(`팩 대상을 찾지 못했습니다: ${safeTargetId}`);
            return;
        }

        const matchedCatalog = catalog.find(
            (item: AssetCatalogItem) => item.id === target.catalogId
        );

        if (matchedCatalog) {
            setSelectedItemId(matchedCatalog.id || '');
            setSelectedType(getCatalogCategory(matchedCatalog) || '');
            setSelectedGender(matchedCatalog.gender || '');
        } else {
            setSelectedItemId('');
            setError(`카탈로그 항목을 찾지 못했습니다: ${target.catalogId}`);
        }

        setChangeMode('pack');
        setSelectedPackId(target.packId || '');
        setReplacementPath(target.pngPath || '');
        setReplacementUrl(target.previewUrl || target.pngUrl || matchedCatalog?.previewUrl || '');
        setReplacementSize(target.size);
        setMessage(`팩 대상 선택됨: ${formatTargetLabel(target)}`);
    };

    const handleApplyPatch = async () => {
        try {
            setMessage('');
            setError('');

            if (!selectedItem) {
                setError('원본 텍스처를 먼저 선택하세요.');
                return;
            }

            if (!replacementPath) {
                setError('변경 이미지를 먼저 선택하세요.');
                return;
            }

            setApplying(true);

            const settings = await window.electronAPI.getSettings();

            if (!settings.gamePath) {
                setError('게임 경로가 설정되지 않았습니다.');
                return;
            }

            const target = changeMode === 'pack' && selectedTarget
                ? buildPatchTargetFromPackTarget(selectedTarget)
                : buildPatchTargetFromCatalogItem(selectedItem, replacementPath, replacementSize);

            if (!target.option2) {
                setError('선택한 원본 텍스처에 option2 값이 없습니다. asset_catalog.json 또는 pack.json을 보강해야 합니다.');
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
        } catch (err) {
            setError(err instanceof Error ? err.message : '패치 실패');
        } finally {
            setApplying(false);
        }
    };

    const handleApplyPackAll = async () => {
        try {
            setMessage('');
            setError('');

            if (!selectedPack) {
                setError('전체 적용할 의상팩을 먼저 선택하세요.');
                return;
            }

            if (!selectedPack.targets.length) {
                setError('선택한 의상팩에 적용할 target이 없습니다.');
                return;
            }

            const confirmed = window.confirm(
                `${selectedPack.packName}의 모든 target ${selectedPack.targets.length}개를 적용하시겠습니까?`
            );

            if (!confirmed) return;

            setApplying(true);

            const settings = await window.electronAPI.getSettings();

            if (!settings.gamePath) {
                setError('게임 경로가 설정되지 않았습니다.');
                return;
            }

            const targets = selectedPack.targets.map((target) => buildPatchTargetFromPackTarget({
                ...target,
                packId: selectedPack.packId,
                packName: selectedPack.packName
            }));

            const invalidTarget = targets.find((target) => !target.option2 || !target.category || !target.pngPath);
            if (invalidTarget) {
                setError('팩 전체 적용 target 중 option2/category/pngPath가 비어 있는 항목이 있습니다. pack.json을 확인해야 합니다.');
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
        } catch (err) {
            setError(err instanceof Error ? err.message : '팩 전체 적용 실패');
        } finally {
            setApplying(false);
        }
    };

    return (
        <Box>
            <Typography variant="h5" sx={{ fontWeight: 800, color: 'var(--text-color)' }}>
                어셋 관리자
            </Typography>

            <Paper sx={sectionPaperSx}>
                <Typography variant="h6" sx={{ fontWeight: 800, color: 'var(--text-color)' }}>
                    백업 상태
                </Typography>

                <Box sx={{ mt: 2 }}>
                    <Typography sx={{ color: status.font ? 'var(--text-color-light)' : 'var(--accent-color)' }}>
                        폰트 백업: {status.font || '백업 파일이 없습니다'}
                    </Typography>

                    <Typography sx={{ color: status.asset ? 'var(--text-color-light)' : 'var(--accent-color)' }}>
                        어셋 백업: {status.asset || '백업 파일이 없습니다'}
                    </Typography>
                </Box>

                <Stack direction="row" spacing={2} sx={{ mt: 3, alignItems: 'center', flexWrap: 'wrap', rowGap: 1 }}>
                    <Box>
                        <Checkbox
                            checked={fontChecked}
                            onChange={(e) => setFontChecked(e.target.checked)}
                            sx={{
                                color: 'var(--text-color-light)',
                                '&.Mui-checked': { color: 'var(--primary-color)' }
                            }}
                        />
                        <Box component="span" sx={{ color: 'var(--text-color)' }}>
                            폰트
                        </Box>
                    </Box>

                    <Box>
                        <Checkbox
                            checked={assetChecked}
                            onChange={(e) => setAssetChecked(e.target.checked)}
                            sx={{
                                color: 'var(--text-color-light)',
                                '&.Mui-checked': { color: 'var(--primary-color)' }
                            }}
                        />
                        <Box component="span" sx={{ color: 'var(--text-color)' }}>
                            어셋
                        </Box>
                    </Box>

                    <Button
                        variant="contained"
                        onClick={handleBackup}
                        sx={{
                            background: 'var(--button-bg-color)',
                            color: 'var(--button-text-color)',
                            '&:hover': { background: 'var(--button-hover-bg-color)' }
                        }}
                    >
                        백업하기
                    </Button>

                    <Button
                        variant="contained"
                        sx={{
                            background: 'var(--secondary-color)',
                            color: 'var(--button-text-color)'
                        }}
                    >
                        전체복원 (미구현)
                    </Button>
                </Stack>
            </Paper>

            <Paper sx={{ ...sectionPaperSx, mt: 4 }}>
                <Typography variant="h6" sx={{ fontWeight: 800, color: 'var(--text-color)' }}>
                    텍스처 교체 작업
                </Typography>

                <Paper sx={innerPaperSx}>
                    <Typography sx={{ fontWeight: 800, color: 'var(--text-color)' }}>
                        원본 대상 선택
                    </Typography>

                    <Stack direction="row" spacing={2} sx={{ mt: 2, flexWrap: 'wrap', rowGap: 2 }}>
                        <FormControl size="small" sx={{ minWidth: 180 }}>
                            <InputLabel sx={{ color: 'var(--text-color-light)' }}>종류</InputLabel>
                            <Select
                                value={selectedType || ''}
                                label="종류"
                                onChange={(e) => {
                                    setSelectedType(String(e.target.value || ''));
                                    handleSelectItem('');
                                }}
                                sx={selectSx}
                            >
                                <MenuItem value="">전체</MenuItem>
                                {types.map((itemType) => (
                                    <MenuItem key={itemType} value={itemType}>
                                        {formatCatalogType(itemType)}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>

                        <FormControl size="small" sx={{ minWidth: 180 }}>
                            <InputLabel sx={{ color: 'var(--text-color-light)' }}>성별</InputLabel>
                            <Select
                                value={selectedGender || ''}
                                label="성별"
                                onChange={(e) => {
                                    setSelectedGender(String(e.target.value || ''));
                                    handleSelectItem('');
                                }}
                                sx={selectSx}
                            >
                                <MenuItem value="">전체</MenuItem>
                                {genders.map((itemGender) => (
                                    <MenuItem key={itemGender} value={itemGender}>
                                        {toKoreanGender(itemGender)}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>

                        <FormControl size="small" sx={{ minWidth: 320 }}>
                            <InputLabel sx={{ color: 'var(--text-color-light)' }}>원본 텍스처</InputLabel>
                            <Select
                                value={selectedItemId || ''}
                                label="원본 텍스처"
                                onChange={(e) => handleSelectItem(String(e.target.value || ''))}
                                sx={selectSx}
                            >
                                <MenuItem value="">선택 안 함</MenuItem>
                                {filteredItems.map((item: AssetCatalogItem) => (
                                    <MenuItem key={item.id} value={item.id}>
                                        {formatCatalogItemLabel(item)}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Stack>

                    {loading && (
                        <Typography sx={{ mt: 2, color: 'var(--text-color-light)' }}>
                            카탈로그를 불러오는 중입니다.
                        </Typography>
                    )}
                </Paper>

                <Paper sx={innerPaperSx}>
                    <Typography sx={{ fontWeight: 800, color: 'var(--text-color)' }}>
                        변경 방식 선택
                    </Typography>

                    <RadioGroup
                        row
                        value={changeMode}
                        onChange={(e) => {
                            const nextMode = e.target.value as ChangeMode;
                            setChangeMode(nextMode);

                            if (nextMode === 'pack') {
                                setReplacementPath('');
                                setReplacementUrl('');
                            } else {
                                setSelectedPackId('');
                                setSelectedTargetId('');
                            }
                        }}
                        sx={{ mt: 1 }}
                    >
                        <FormControlLabel
                            value="pack"
                            control={<Radio sx={{ color: 'var(--text-color-light)', '&.Mui-checked': { color: 'var(--primary-color)' } }} />}
                            label="의상팩 사용"
                            sx={{ color: 'var(--text-color)' }}
                        />
                        <FormControlLabel
                            value="direct"
                            control={<Radio sx={{ color: 'var(--text-color-light)', '&.Mui-checked': { color: 'var(--primary-color)' } }} />}
                            label="직접 이미지 선택"
                            sx={{ color: 'var(--text-color)' }}
                        />
                    </RadioGroup>

                    <Divider sx={{ my: 2, borderColor: 'var(--border-color)' }} />

                    <Stack direction="row" spacing={2} sx={{ flexWrap: 'wrap', rowGap: 2, alignItems: 'center' }}>
                        <FormControl size="small" sx={{ minWidth: 260 }}>
                            <InputLabel sx={{ color: 'var(--text-color-light)' }}>팩 선택</InputLabel>
                            <Select
                                value={packSelectValue}
                                label="팩 선택"
                                onChange={(e) => {
                                    const nextPackId = String(e.target.value || '');

                                    if (nextPackId === CUSTOM_PACK_VALUE) {
                                        setChangeMode('direct');
                                        setSelectedPackId('');
                                        setSelectedTargetId('');
                                        return;
                                    }

                                    setChangeMode('pack');
                                    setSelectedPackId(nextPackId);
                                    setSelectedTargetId('');
                                    setReplacementPath('');
                                    setReplacementUrl('');
                                }}
                                sx={selectSx}
                            >
                                <MenuItem value="">전체</MenuItem>
                                {replacementPath && (
                                    <MenuItem value={CUSTOM_PACK_VALUE}>커스텀</MenuItem>
                                )}
                                {packs.map((pack) => (
                                    <MenuItem key={pack.packId} value={pack.packId}>
                                        {pack.packName}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>

                        <FormControl size="small" sx={{ minWidth: 360 }}>
                            <InputLabel sx={{ color: 'var(--text-color-light)' }}>적용 대상</InputLabel>
                            <Select
                                value={selectedTargetId || ''}
                                label="적용 대상"
                                disabled={changeMode !== 'pack'}
                                onChange={(e) => handleSelectPackTarget(String(e.target.value || ''))}
                                sx={selectSx}
                            >
                                <MenuItem value="">선택 안 함</MenuItem>
                                {availablePackTargets.map((target) => (
                                    <MenuItem key={target.id} value={target.id}>
                                        {formatTargetLabel(target)}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>

                        <Button
                            variant="contained"
                            onClick={handleImportPack}
                            sx={{
                                background: 'var(--button-bg-color)',
                                color: 'var(--button-text-color)',
                                '&:hover': { background: 'var(--button-hover-bg-color)' }
                            }}
                        >
                            의상팩 추가
                        </Button>

                        <Button
                            variant="contained"
                            onClick={handleSelectReplacement}
                            sx={{
                                background: 'var(--button-bg-color)',
                                color: 'var(--button-text-color)',
                                '&:hover': { background: 'var(--button-hover-bg-color)' }
                            }}
                        >
                            변경 이미지 직접 선택
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
                    <Typography sx={{ fontWeight: 800, color: 'var(--text-color)' }}>
                        미리보기
                    </Typography>

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
                            emptyText="의상팩 대상 또는 직접 이미지를 선택하세요."
                            caption={replacementCaption}
                        />
                    </Stack>
                </Paper>

                <Paper sx={innerPaperSx}>
                    <Typography sx={{ fontWeight: 800, color: 'var(--text-color)' }}>
                        적용
                    </Typography>

                    {applying && (
                        <Box sx={{ mt: 2 }}>
                            <LinearProgress
                                sx={{
                                    backgroundColor: 'var(--input-bg-color)',
                                    '& .MuiLinearProgress-bar': {
                                        backgroundColor: 'var(--primary-color)'
                                    }
                                }}
                            />
                            <Typography sx={{ mt: 1, color: 'var(--text-color-light)' }}>
                                패치를 적용하는 중입니다.
                            </Typography>
                        </Box>
                    )}

                    <Stack direction="row" spacing={2} sx={{ mt: 2, flexWrap: 'wrap', rowGap: 1 }}>
                        <Button
                            variant="contained"
                            disabled={!selectedItem || !replacementPath || applying}
                            onClick={handleApplyPatch}
                            sx={{
                                background: 'var(--button-bg-color)',
                                color: 'var(--button-text-color)',
                                '&:hover': { background: 'var(--button-hover-bg-color)' },
                                '&.Mui-disabled': {
                                    background: 'var(--secondary-color)',
                                    color: 'var(--text-color-light)'
                                }
                            }}
                        >
                            적용
                        </Button>

                        <Button
                            variant="outlined"
                            disabled={!selectedPack || !selectedPack.targets.length || applying}
                            onClick={handleApplyPackAll}
                            sx={{
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
                            }}
                        >
                            팩 전체 적용
                        </Button>
                    </Stack>
                </Paper>
            </Paper>

            {(message || error) && (
                <Paper sx={sectionPaperSx}>
                    {message && (
                        <Typography sx={{ color: 'var(--primary-color)' }}>
                            {message}
                        </Typography>
                    )}

                    {error && (
                        <Typography sx={{ color: 'var(--accent-color)', whiteSpace: 'pre-wrap' }}>
                            {error}
                        </Typography>
                    )}
                </Paper>
            )}
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
                <Typography
                    sx={{
                        mt: 1,
                        color: 'var(--text-color-light)',
                        fontSize: 12,
                        wordBreak: 'break-all'
                    }}
                >
                    {caption}
                </Typography>
            )}
        </Box>
    );
}
