// src/renderer/pages/AssetManager.tsx

import {useEffect, useMemo, useState} from 'react';
import {
    Box,
    Button,
    Checkbox,
    FormControl,
    InputLabel,
    MenuItem,
    Paper,
    Select,
    Stack,
    Typography
} from '@mui/material';
import {useTextureCatalog} from '../hooks/useTextureCatalog';

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
    previewUrl: string;
};

type SelectedImage = {
    path: string;
    url: string;
};

export default function AssetManager() {
    const [status, setStatus] = useState<BackupStatus>({
        font: null,
        asset: null
    });

    const [fontChecked, setFontChecked] = useState(true);
    const [assetChecked, setAssetChecked] = useState(true);

    const {data: catalog, loading} = useTextureCatalog();

    const [selectedType, setSelectedType] = useState('');
    const [selectedGender, setSelectedGender] = useState('');
    const [selectedItemId, setSelectedItemId] = useState('');

    const [replacementUrl, setReplacementUrl] = useState('');
    const [replacementPath, setReplacementPath] = useState('');

    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    const loadStatus = async () => {
        const nextStatus = await window.electronAPI.getAssetStatus();
        setStatus(nextStatus);
    };

    useEffect(() => {
        loadStatus().catch((err) => {
            setError(err instanceof Error ? err.message : '백업 상태 로드 실패');
        });
    }, []);

    const types = useMemo(() => {
        return [...new Set(catalog.map((item: AssetCatalogItem) => item.type))];
    }, [catalog]);

    const genders = useMemo(() => {
        return [...new Set(catalog.map((item: AssetCatalogItem) => item.gender))];
    }, [catalog]);

    const filteredItems = useMemo(() => {
        return catalog.filter((item: AssetCatalogItem) => {
            return (
                (!selectedType || item.type === selectedType) &&
                (!selectedGender || item.gender === selectedGender)
            );
        });
    }, [catalog, selectedType, selectedGender]);

    const selectedItem = useMemo(() => {
        return catalog.find((item: AssetCatalogItem) => item.id === selectedItemId);
    }, [catalog, selectedItemId]);

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

            setReplacementPath(result.path);
            setReplacementUrl(result.url);
        } catch (err) {
            setError(err instanceof Error ? err.message : '변경 이미지 선택 실패');
        }
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

            const settings = await window.electronAPI.getSettings();

            if (!settings.gamePath) {
                setError('게임 경로가 설정되지 않았습니다.');
                return;
            }

            await window.electronAPI.runClothesPatch({
                textureName: selectedItem.textureName,
                pathId: selectedItem.pathId,
                pngPath: replacementPath,
                gender: selectedItem.gender,
                category: 'clothes',
                option2: selectedItem.type,
                gamePath: settings.gamePath
            });

            setMessage('패치가 완료되었습니다.');
        } catch (err) {
            setError(err instanceof Error ? err.message : '패치 실패');
        }
    };

    const handleImportPack = async () => {
        try {
            setMessage('');
            setError('');

            const zipPath = await window.electronAPI.selectModImportFile();

            if (!zipPath) return;

            await window.electronAPI.importAssetPack(zipPath);
            setMessage('의상팩을 등록했습니다.');
        } catch (err) {
            setError(err instanceof Error ? err.message : '의상팩 등록 실패');
        }
    };

    return (
        <Box>
            <Typography variant="h5" sx={{fontWeight: 800, color: 'var(--text-color)'}}>
                어셋 관리자
            </Typography>

            <Paper
                sx={{
                    mt: 3,
                    p: 3,
                    background: 'var(--sidebar-bg-color)',
                    color: 'var(--text-color)',
                    border: '1px solid var(--border-color)',
                    boxShadow: 'var(--shadow-small)'
                }}
            >
                <Typography variant="h6" sx={{fontWeight: 800, color: 'var(--text-color)'}}>
                    백업 상태
                </Typography>

                <Box sx={{mt: 2}}>
                    <Typography sx={{color: status.font ? 'var(--text-color-light)' : 'var(--accent-color)'}}>
                        폰트 백업: {status.font || '백업 파일이 없습니다'}
                    </Typography>

                    <Typography sx={{color: status.asset ? 'var(--text-color-light)' : 'var(--accent-color)'}}>
                        어셋 백업: {status.asset || '백업 파일이 없습니다'}
                    </Typography>
                </Box>

                <Stack direction="row" spacing={2} sx={{mt: 3, alignItems: 'center'}}>
                    <Box>
                        <Checkbox
                            checked={fontChecked}
                            onChange={(e) => setFontChecked(e.target.checked)}
                            sx={{
                                color: 'var(--text-color-light)',
                                '&.Mui-checked': {color: 'var(--primary-color)'}
                            }}
                        />
                        <Box component="span" sx={{color: 'var(--text-color)'}}>
                            폰트
                        </Box>
                    </Box>

                    <Box>
                        <Checkbox
                            checked={assetChecked}
                            onChange={(e) => setAssetChecked(e.target.checked)}
                            sx={{
                                color: 'var(--text-color-light)',
                                '&.Mui-checked': {color: 'var(--primary-color)'}
                            }}
                        />
                        <Box component="span" sx={{color: 'var(--text-color)'}}>
                            어셋
                        </Box>
                    </Box>

                    <Button
                        variant="contained"
                        onClick={handleBackup}
                        sx={{
                            background: 'var(--button-bg-color)',
                            color: 'var(--button-text-color)'
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

            <Paper
                sx={{
                    mt: 4,
                    p: 3,
                    background: 'var(--sidebar-bg-color)',
                    color: 'var(--text-color)',
                    border: '1px solid var(--border-color)',
                    boxShadow: 'var(--shadow-small)'
                }}
            >
                <Typography variant="h6" sx={{fontWeight: 800, color: 'var(--text-color)'}}>
                    텍스처 미리보기 비교
                </Typography>

                <Stack direction="row" spacing={2} sx={{mt: 3, flexWrap: 'wrap', rowGap: 2}}>
                    <FormControl size="small" sx={{minWidth: 180}}>
                        <InputLabel sx={{color: 'var(--text-color-light)'}}>종류</InputLabel>
                        <Select
                            value={selectedType}
                            label="종류"
                            onChange={(e) => {
                                setSelectedType(e.target.value);
                                setSelectedItemId('');
                            }}
                            sx={selectSx}
                        >
                            <MenuItem value="">전체</MenuItem>
                            {types.map((itemType) => (
                                <MenuItem key={itemType} value={itemType}>
                                    {itemType}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    <FormControl size="small" sx={{minWidth: 180}}>
                        <InputLabel sx={{color: 'var(--text-color-light)'}}>성별</InputLabel>
                        <Select
                            value={selectedGender}
                            label="성별"
                            onChange={(e) => {
                                setSelectedGender(e.target.value);
                                setSelectedItemId('');
                            }}
                            sx={selectSx}
                        >
                            <MenuItem value="">전체</MenuItem>
                            {genders.map((itemGender) => (
                                <MenuItem key={itemGender} value={itemGender}>
                                    {itemGender}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    <FormControl size="small" sx={{minWidth: 300}}>
                        <InputLabel sx={{color: 'var(--text-color-light)'}}>원본 텍스처</InputLabel>
                        <Select
                            value={selectedItemId}
                            label="원본 텍스처"
                            onChange={(e) => setSelectedItemId(e.target.value)}
                            sx={selectSx}
                        >
                            {filteredItems.map((item: AssetCatalogItem) => (
                                <MenuItem key={item.id} value={item.id}>
                                    {item.label}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    <Button
                        variant="contained"
                        onClick={handleSelectReplacement}
                        sx={{
                            background: 'var(--button-bg-color)',
                            color: 'var(--button-text-color)'
                        }}
                    >
                        변경 이미지 선택
                    </Button>

                    <Button
                        variant="contained"
                        disabled={!selectedItem || !replacementPath}
                        onClick={handleApplyPatch}
                        sx={{
                            background: 'var(--button-bg-color)',
                            color: 'var(--button-text-color)',
                            '&.Mui-disabled': {
                                background: 'var(--secondary-color)',
                                color: 'var(--text-color-light)'
                            }
                        }}
                    >
                        적용
                    </Button>

                    <Button
                        variant="contained"
                        onClick={handleImportPack}
                        sx={{
                            background: 'var(--button-bg-color)',
                            color: 'var(--button-text-color)'
                        }}
                    >
                        의상팩 추가
                    </Button>
                </Stack>

                {loading && (
                    <Typography sx={{mt: 2, color: 'var(--text-color-light)'}}>
                        카탈로그를 불러오는 중입니다.
                    </Typography>
                )}

                <Stack direction="row" spacing={3} sx={{mt: 3, flexWrap: 'wrap', rowGap: 3}}>
                    <PreviewCard
                        title="원본 미리보기"
                        imageUrl={selectedItem?.previewUrl || ''}
                        emptyText="원본 텍스처를 선택하세요."
                    />

                    <PreviewCard
                        title="변경 미리보기"
                        imageUrl={replacementUrl}
                        emptyText="변경 이미지를 선택하세요."
                        caption={replacementPath}
                    />
                </Stack>
            </Paper>

            {(message || error) && (
                <Paper
                    sx={{
                        mt: 3,
                        p: 2,
                        background: 'var(--sidebar-bg-color)',
                        border: '1px solid var(--border-color)',
                        boxShadow: 'var(--shadow-small)'
                    }}
                >
                    {message && (
                        <Typography sx={{color: 'var(--primary-color)'}}>
                            {message}
                        </Typography>
                    )}

                    {error && (
                        <Typography sx={{color: 'var(--accent-color)', whiteSpace: 'pre-wrap'}}>
                            {error}
                        </Typography>
                    )}
                </Paper>
            )}
        </Box>
    );
}

const selectSx = {
    color: 'var(--text-color)',
    background: 'var(--input-bg-color)',
    '.MuiOutlinedInput-notchedOutline': {
        borderColor: 'var(--border-color)'
    },
    '.MuiSvgIcon-root': {
        color: 'var(--text-color)'
    }
};

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
            <Typography sx={{fontWeight: 700, color: 'var(--text-color)', mb: 1}}>
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
                        color: 'var(--text-color-light)'
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