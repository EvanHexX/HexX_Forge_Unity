// src/renderer/pages/ModManager.tsx
// BepInEx/plugins DLL 파일을 스캔하고 활성/비활성 상태를 관리합니다.

import {useEffect, useState} from 'react';
import {
    Alert,
    Box,
    Button,
    Checkbox,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    IconButton,
    Paper,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TextField,
    Typography
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import RefreshIcon from '@mui/icons-material/Refresh';

type ModInfo = {
    fileName: string;
    relativePath: string;
    displayName: string;
    author: string;
    enabled: boolean;
    sourcePath: string;
};

export default function ModManager() {
    const [mods, setMods] = useState<ModInfo[]>([]);
    const [error, setError] = useState('');

    const [importPath, setImportPath] = useState('');
    const [importName, setImportName] = useState('');
    const [importAuthor, setImportAuthor] = useState('');
    const [importDialogOpen, setImportDialogOpen] = useState(false);

    const loadMods = async () => {
        try {
            setError('');
            const result = await window.electronAPI.scanMods();
            setMods(result);
        } catch (err) {
            setError(err instanceof Error ? err.message : '모드 스캔 실패');
        }
    };

    const handleToggle = async (fileName: string, enabled: boolean) => {
        try {
            setError('');
            const result = await window.electronAPI.setModEnabled(fileName, enabled);
            setMods(result);
        } catch (err) {
            setError(err instanceof Error ? err.message : '모드 상태 변경 실패');
        }
    };

    const handleSelectImportFile = async () => {
        try {
            setError('');

            const selected = await window.electronAPI.selectModImportFile();
            if (!selected) return;

            setImportPath(selected);

            if (selected.toLowerCase().endsWith('.zip')) {
                const result = await window.electronAPI.importZipMod(selected);
                setMods(result);
                return;
            }

            const fileName = selected.split(/[\\/]/).pop() || '';
            setImportName(fileName.replace(/\.dll$/i, ''));
            setImportAuthor('');
            setImportDialogOpen(true);
        } catch (err) {
            setError(err instanceof Error ? err.message : '모드 추가 실패');
        }
    };

    const handleImportDll = async () => {
        try {
            setError('');

            const result = await window.electronAPI.importDllMod(
                importPath,
                importName,
                importAuthor
            );

            setMods(result);
            setImportDialogOpen(false);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'DLL 모드 등록 실패');
        }
    };

    const handleDelete = async (relativePath: string) => {
        const ok = window.confirm(`정말 삭제할까요?\n${relativePath}`);

        if (!ok) return;

        try {
            setError('');
            const result = await window.electronAPI.deleteMod(relativePath);
            setMods(result);
        } catch (err) {
            setError(err instanceof Error ? err.message : '모드 삭제 실패');
        }
    };

    useEffect(() => {
        loadMods();
    }, []);

    return (
        <Box>
            <Box sx={{display: "flex", alignItems: "center", justifyContent: "space-between"}}>
                <Box>
                    <Typography variant="h5" sx={{fontWeight: 800, color: "var(--text-color)"}}>
                        모드 관리자
                    </Typography>
                    <Typography sx={{mt: 1, color: "var(--text-color-light)"}}>
                        BepInEx/plugins 안의 DLL 파일을 활성/비활성 관리합니다.
                    </Typography>
                </Box>

                <Button
                    variant="contained"
                    startIcon={<RefreshIcon/>}
                    onClick={loadMods}
                    sx={{
                        background: 'var(--button-bg-color)',
                        color: 'var(--button-text-color)'
                    }}
                >
                    새로고침
                </Button>
                <Button
                    variant="contained"
                    startIcon={<AddIcon/>}
                    onClick={handleSelectImportFile}
                    sx={{
                        background: 'var(--button-bg-color)',
                        color: 'var(--button-text-color)'
                    }}
                >
                    모드 추가
                </Button>
            </Box>

            {error && (
                <Alert severity="error" sx={{mt: 2}}>
                    {error}
                </Alert>
            )}

            <TableContainer
                component={Paper}
                sx={{
                    mt: 3,
                    background: 'var(--sidebar-bg-color)',
                    border: '1px solid var(--border-color)',
                    boxShadow: 'var(--shadow-small)'
                }}
            >
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell sx={{color: 'var(--text-color)', width: 80}}>사용</TableCell>
                            <TableCell sx={{color: 'var(--text-color)'}}>표시 이름</TableCell>
                            <TableCell sx={{color: 'var(--text-color)'}}>제작자</TableCell>
                            <TableCell sx={{color: 'var(--text-color)'}}>파일 경로</TableCell>
                            <TableCell sx={{color: 'var(--text-color)'}}>상태</TableCell>
                            <TableCell sx={{color: 'var(--text-color)', width: 80}}>삭제</TableCell>
                        </TableRow>
                    </TableHead>

                    <TableBody>
                        {mods.map((mod) => (
                            <TableRow key={`${mod.relativePath}-${mod.enabled}`}>
                                <TableCell>
                                    <Checkbox
                                        checked={mod.enabled}
                                        onChange={(e) => handleToggle(mod.relativePath, e.target.checked)}
                                        sx={{
                                            color: 'var(--text-color-light)',
                                            '&.Mui-checked': {
                                                color: 'var(--primary-color)'
                                            }
                                        }}
                                    />
                                </TableCell>

                                <TableCell sx={{color: 'var(--text-color)'}}>
                                    {mod.displayName}
                                </TableCell>

                                <TableCell sx={{color: 'var(--text-color-light)'}}>
                                    {mod.author || '-'}
                                </TableCell>

                                <TableCell sx={{color: 'var(--text-color-light)'}}>
                                    {mod.relativePath}
                                </TableCell>

                                <TableCell sx={{color: mod.enabled ? 'var(--primary-color)' : 'var(--accent-color)'}}>
                                    {mod.enabled ? '활성' : '보관됨'}
                                </TableCell>

                                <TableCell>
                                    <IconButton
                                        onClick={() => handleDelete(mod.relativePath)}
                                        sx={{color: 'var(--accent-color)'}}
                                    >
                                        <DeleteIcon/>
                                    </IconButton>
                                </TableCell>
                            </TableRow>
                        ))}

                        {mods.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={6} sx={{color: 'var(--text-color-light)', py: 4}}>
                                    표시할 DLL 모드가 없습니다.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </TableContainer>
            <Dialog
                open={importDialogOpen}
                onClose={() => setImportDialogOpen(false)}
                slotProps={{
                    paper: {
                        sx: {
                            background: 'var(--sidebar-bg-color)',
                            color: 'var(--text-color)',
                            border: '1px solid var(--border-color)'
                        }
                    }
                }}
            >
                <DialogTitle>DLL 모드 등록</DialogTitle>

                <DialogContent>
                    <Stack spacing={2} sx={{mt: 1, minWidth: 420}}>
                        <Typography color="var(--text-color-light)">
                            {importPath}
                        </Typography>

                        <TextField
                            label="표시 이름"
                            value={importName}
                            onChange={(e) => setImportName(e.target.value)}
                            sx={{
                                input: {color: 'var(--text-color)'},
                                label: {color: 'var(--text-color-light)'},
                                '& .MuiOutlinedInput-root': {
                                    backgroundColor: 'var(--input-bg-color)',
                                    '& fieldset': {borderColor: 'var(--border-color)'}
                                }
                            }}
                        />

                        <TextField
                            label="제작자"
                            value={importAuthor}
                            onChange={(e) => setImportAuthor(e.target.value)}
                            sx={{
                                input: {color: 'var(--text-color)'},
                                label: {color: 'var(--text-color-light)'},
                                '& .MuiOutlinedInput-root': {
                                    backgroundColor: 'var(--input-bg-color)',
                                    '& fieldset': {borderColor: 'var(--border-color)'}
                                }
                            }}
                        />
                    </Stack>
                </DialogContent>

                <DialogActions>
                    <Button
                        onClick={() => setImportDialogOpen(false)}
                        sx={{color: 'var(--text-color-light)'}}
                    >
                        취소
                    </Button>
                    <Button
                        variant="contained"
                        onClick={handleImportDll}
                        sx={{
                            background: 'var(--button-bg-color)',
                            color: 'var(--button-text-color)'
                        }}
                    >
                        등록
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}