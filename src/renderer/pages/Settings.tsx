// src/renderer/pages/Settings.tsx
// 게임 경로 등 환경설정을 관리합니다.

import { useEffect, useState } from 'react';
import { Box, Button, MenuItem, Select, Stack, TextField, Typography } from '@mui/material';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import SaveIcon from '@mui/icons-material/Save';

type Props = {
    currentTheme: string;
    themeNames: string[];
    changeTheme: (name: string) => Promise<void>;
};

const sectionLabel = {
    color: 'var(--text-color-light)',
    fontWeight: 700,
    fontSize: 11,
    letterSpacing: '0.1em',
    textTransform: 'uppercase' as const,
    mb: 1
};

export default function Settings({ currentTheme, themeNames, changeTheme }: Props) {
    const [gamePath, setGamePath] = useState('');

    useEffect(() => {
        window.electronAPI.getSettings().then((settings) => {
            setGamePath(settings.gamePath || '');
        });
    }, []);

    const handleSelectPath = async () => {
        const selected = await window.electronAPI.selectDirectory();
        if (selected) setGamePath(selected);
    };

    const handleSave = async () => {
        const updated = await window.electronAPI.setGamePath(gamePath);
        setGamePath(updated.gamePath || '');
    };

    return (
        <Box sx={{ maxWidth: 640 }}>
            <Typography variant="h5" sx={{ fontWeight: 800, color: 'var(--text-color)' }}>
                환경설정
            </Typography>

            {/* 테마 */}
            <Box sx={{ mt: 4 }}>
                <Typography sx={sectionLabel}>테마</Typography>
                <Select
                    value={currentTheme}
                    onChange={(e) => changeTheme(e.target.value)}
                    size="small"
                    sx={{
                        minWidth: 200,
                        color: 'var(--text-color)',
                        background: 'var(--input-bg-color)',
                        '& .MuiOutlinedInput-notchedOutline': { borderColor: 'var(--border-color)' },
                        '& .MuiSvgIcon-root': { color: 'var(--text-color)' }
                    }}
                >
                    {themeNames.map((name) => (
                        <MenuItem key={name} value={name}>{name}</MenuItem>
                    ))}
                </Select>
            </Box>

            {/* 게임 경로 */}
            <Box sx={{ mt: 4 }}>
                <Typography sx={sectionLabel}>게임 경로</Typography>
                <Typography sx={{ color: 'var(--text-color-light)', fontSize: 13, mb: 1.5 }}>
                    게임 설치 폴더를 선택하세요. 예: LongYinLiZhiZhuan 폴더
                </Typography>
                <Stack direction="row" spacing={1}>
                    <TextField
                        fullWidth
                        value={gamePath}
                        onChange={(e) => setGamePath(e.target.value)}
                        size="small"
                        sx={{
                            'input': { color: 'var(--text-color)' },
                            '& .MuiOutlinedInput-root': {
                                backgroundColor: 'var(--input-bg-color)',
                                '& fieldset': { borderColor: 'var(--border-color)' }
                            }
                        }}
                    />
                    <Button
                        variant="contained"
                        startIcon={<FolderOpenIcon />}
                        onClick={handleSelectPath}
                        sx={{ background: 'var(--button-bg-color)', color: 'var(--button-text-color)', flexShrink: 0 }}
                    />
                </Stack>
                {!gamePath && (
                    <Typography sx={{ mt: 1, fontSize: 13, color: 'error.main' }}>
                        게임 경로가 설정되지 않았습니다.
                    </Typography>
                )}
            </Box>

            {/* 저장 */}
            <Box sx={{ mt: 4 }}>
                <Button
                    variant="contained"
                    startIcon={<SaveIcon />}
                    onClick={handleSave}
                    sx={{ background: 'var(--button-bg-color)', color: 'var(--button-text-color)' }}
                >
                    저장
                </Button>
            </Box>
        </Box>
    );
}