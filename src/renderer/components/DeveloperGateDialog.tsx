import { useEffect, useState } from 'react';
import {
    Alert,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Stack,
    TextField,
    Typography
} from '@mui/material';

type DeveloperGateDialogProps = {
    open: boolean;
    title: string;
    description: string;
    onClose: () => void;
    onUnlocked: () => void;
};

const dialogPaperSx = {
    background: 'var(--sidebar-bg-color)',
    color: 'var(--text-color)',
    border: '1px solid var(--border-color)',
    boxShadow: 'var(--shadow-large)'
};

const inputSx = {
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

export default function DeveloperGateDialog({
    open,
    title,
    description,
    onClose,
    onUnlocked
}: DeveloperGateDialogProps) {
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [configPath, setConfigPath] = useState('');
    const [configured, setConfigured] = useState(true);
    const [checking, setChecking] = useState(false);

    useEffect(() => {
        if (!open) return;

        setPassword('');
        setError('');
        window.electronAPI.getDeveloperAccessStatus()
            .then((status) => {
                setConfigPath(status.configPath || '');
                setConfigured(Boolean(status.configured));
            })
            .catch(() => {
                setConfigPath('');
                setConfigured(false);
            });
    }, [open]);

    const handleSubmit = async () => {
        if (!configured) {
            setError('개발자 비밀번호가 설정되지 않았습니다.');
            return;
        }

        try {
            setChecking(true);
            setError('');

            const result = await window.electronAPI.verifyDeveloperPassword(password);
            setConfigPath(result.configPath || configPath);

            if (!result.ok) {
                setError(result.reason === 'not_configured'
                    ? '개발자 비밀번호가 설정되지 않았습니다.'
                    : '비밀번호가 올바르지 않습니다.');
                return;
            }

            onUnlocked();
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : '개발자 권한 확인에 실패했습니다.');
        } finally {
            setChecking(false);
        }
    };

    const handleDialogClose = (_event: unknown, reason?: string) => {
        if (reason === 'backdropClick') return;
        onClose();
    };

    return (
        <Dialog open={open} onClose={handleDialogClose} maxWidth="sm" fullWidth slotProps={{ paper: { sx: dialogPaperSx } }}>
            <DialogTitle sx={{ color: 'var(--text-color)', fontWeight: 800 }}>{title}</DialogTitle>
            <DialogContent>
                <Stack spacing={2} sx={{ mt: 1 }}>
                    <Alert severity="warning">
                        개발자 전용 기능입니다. 잘못 수정하면 패치 대상이 깨지거나 실제 적용이 실패할 수 있습니다.
                    </Alert>
                    <Typography sx={{ color: 'var(--text-color)' }}>{description}</Typography>
                    {!configured && (
                        <Alert severity="info">
                            개발자 비밀번호가 설정되지 않았습니다. 아래 config JSON 파일을 직접 만든 뒤 다시 열어주세요.
                        </Alert>
                    )}
                    {configPath && (
                        <Typography sx={{ color: 'var(--text-color-light)', fontSize: 12, wordBreak: 'break-all' }}>
                            비밀번호는 OS 환경변수 HEXX_FORGE_DEVELOPER_PASSWORD 또는 config JSON 파일에서 관리됩니다: {configPath}
                        </Typography>
                    )}
                    {!configured && (
                        <Typography
                            component="pre"
                            sx={{
                                m: 0,
                                p: 1.5,
                                color: 'var(--text-color)',
                                background: 'var(--input-bg-color)',
                                border: '1px solid var(--border-color)',
                                borderRadius: 1,
                                fontSize: 12,
                                whiteSpace: 'pre-wrap'
                            }}
                        >
{`{
  "password": "원하는비밀번호",
  "createdAt": "2026-05-14T00:00:00.000Z"
}`}
                        </Typography>
                    )}
                    <TextField
                        autoFocus
                        type="password"
                        label="개발자 비밀번호"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter' && password.trim() && configured) {
                                handleSubmit();
                            }
                        }}
                        disabled={!configured}
                        error={Boolean(error)}
                        helperText={error || (configured ? 'Ctrl+Alt+C로 열린 개발자 도구입니다.' : '비밀번호 설정 후 다시 시도하세요.')}
                        sx={inputSx}
                    />
                </Stack>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2.5 }}>
                <Button onClick={onClose} sx={{ color: 'var(--text-color)' }}>취소</Button>
                <Button
                    variant="contained"
                    onClick={handleSubmit}
                    disabled={!configured || !password.trim() || checking}
                    sx={{
                        background: 'var(--button-bg-color)',
                        color: 'var(--button-text-color)',
                        '&:hover': { background: 'var(--button-hover-bg-color)' }
                    }}
                >
                    잠금 해제
                </Button>
            </DialogActions>
        </Dialog>
    );
}
