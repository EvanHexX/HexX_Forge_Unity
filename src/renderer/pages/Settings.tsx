// src/renderer/pages/Settings.tsx
// 게임 경로 등 환경설정을 관리합니다.

import { useEffect, useState } from 'react';
import { Box, Button, Stack, TextField, Typography } from '@mui/material';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';

export default function Settings() {
    const [gamePath, setGamePath] = useState('');

    useEffect(() => {
        window.electronAPI.getSettings().then((settings) => {
            setGamePath(settings.gamePath || '');
        });
    }, []);

    const handleSelectPath = async () => {
        const selected = await window.electronAPI.selectDirectory();
        if (selected) {
            setGamePath(selected);
        }
    };

    const handleSave = async () => {
        const updated = await window.electronAPI.setGamePath(gamePath);
        setGamePath(updated.gamePath || '');
    };

    return (
        <Box>
            <Typography variant="h5" sx={{ fontWeight: 800, color: 'var(--text-color)' }}>
                환경설정
            </Typography>

                <Stack spacing={2} sx={{ mt: 3, maxWidth: 720 }}>
                <Typography color="var(--text-color-light)">
                    게임 설치 폴더를 선택하세요. 예: LongYinLiZhiZhuan 폴더
                </Typography>

                <Stack direction="row" spacing={1}>
                    <TextField
                        fullWidth
                        value={gamePath}
                        onChange={(e) => setGamePath(e.target.value)}
                        size="small"
                        sx={{
                            input: { color: 'var(--text-color)' },
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
                        sx={{
                            background: 'var(--button-bg-color)',
                            color: 'var(--button-text-color)'
                        }}
                    >
                        선택
                    </Button>
                </Stack>

                <Button
                    variant="contained"
                    onClick={handleSave}
                    sx={{
                        width: 160,
                        background: 'var(--button-bg-color)',
                        color: 'var(--button-text-color)'
                    }}
                >
                    저장
                </Button>

                {!gamePath && (
                    <Typography color="error">
                        게임 경로가 설정되지 않았습니다.
                    </Typography>
                )}
            </Stack>
        </Box>
    );
}