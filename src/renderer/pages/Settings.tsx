// src/renderer/pages/Settings.tsx
// Game path, theme, typography, and app update settings.

import { useEffect, useMemo, useState } from 'react';
import { Alert, Box, Button, LinearProgress, MenuItem, Select, Stack, TextField, Typography } from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import SaveIcon from '@mui/icons-material/Save';
import SystemUpdateAltIcon from '@mui/icons-material/SystemUpdateAlt';
import type { ThemeOption, TypographyOption } from '../hooks/useTheme';
import { getSafeLanguage, SUPPORTED_LANGUAGES, t, type LanguageCode } from '../i18n';

type Props = {
    currentTheme: string;
    currentTypography: string;
    themeOptions: ThemeOption[];
    typographyOptions: TypographyOption[];
    changeTheme: (name: string) => Promise<void>;
    changeTypography: (name: string) => Promise<void>;
};

type AppSettings = Awaited<ReturnType<typeof window.electronAPI.getSettings>>;
type SupportedGame = Awaited<ReturnType<typeof window.electronAPI.getSupportedGames>>[number];
type UpdateStatus = Awaited<ReturnType<typeof window.electronAPI.getUpdateStatus>>;

const sectionLabel = {
    color: 'var(--text-color-light)',
    fontWeight: 700,
    fontSize: 11,
    letterSpacing: '0.1em',
    textTransform: 'uppercase' as const,
    mb: 1
};

export default function Settings({
    currentTheme,
    currentTypography,
    themeOptions,
    typographyOptions,
    changeTheme,
    changeTypography
}: Props) {
    const [settings, setSettings] = useState<AppSettings | null>(null);
    const [supportedGames, setSupportedGames] = useState<SupportedGame[]>([]);
    const [gamePath, setGamePath] = useState('');
    const [appVersion, setAppVersion] = useState('');
    const [updateStatus, setUpdateStatus] = useState<UpdateStatus | null>(null);

    useEffect(() => {
        window.electronAPI.getSettings().then((loadedSettings) => {
            setSettings(loadedSettings);
            setGamePath(loadedSettings.gamePath || '');
        });
        window.electronAPI.getSupportedGames().then(setSupportedGames);
        window.electronAPI.getVersion().then(setAppVersion);
        window.electronAPI.getUpdateStatus().then(setUpdateStatus);

        return window.electronAPI.onUpdateStatus(setUpdateStatus);
    }, []);

    const selectedGame = useMemo(() => {
        const selectedGameId = settings?.selectedGameId || 'long-yin-li-zhi-zhuan';
        return supportedGames.find((game) => game.id === selectedGameId) || supportedGames[0];
    }, [settings?.selectedGameId, supportedGames]);
    const currentLanguage = getSafeLanguage(settings?.language);
    const selectedGameName = getGameDisplayName(selectedGame, currentLanguage);
    const selectedGameInstallHint = getGameInstallHint(selectedGame, currentLanguage);

    const updateMessage = useMemo(() => {
        if (!updateStatus) return t('settings.update.loading', currentLanguage);
        if (updateStatus.error) return updateStatus.error;
        if (updateStatus.message) return updateStatus.message;
        if (updateStatus.state === 'idle') return t('settings.update.idle', currentLanguage);

        return '';
    }, [currentLanguage, updateStatus]);

    const isChecking = updateStatus?.state === 'checking';
    const isDownloading = updateStatus?.state === 'downloading';
    const canDownload = updateStatus?.state === 'available';
    const canInstall = updateStatus?.state === 'downloaded';
    const checkDisabled = isChecking || isDownloading;
    const downloadDisabled = !canDownload || isDownloading;
    const installDisabled = !canInstall;

    const handleSelectGame = async (gameId: string) => {
        const updated = await window.electronAPI.setSelectedGame(gameId);
        setSettings(updated);
        setGamePath(updated.gamePath || '');
    };

    const handleSelectPath = async () => {
        const selected = await window.electronAPI.selectDirectory();
        if (selected) setGamePath(selected);
    };

    const handleSave = async () => {
        const updated = await window.electronAPI.setGamePath(gamePath, settings?.selectedGameId);
        setSettings(updated);
        setGamePath(updated.gamePath || '');
    };

    const handleSelectLanguage = async (language: LanguageCode) => {
        const updated = await window.electronAPI.setLanguage(language);
        setSettings(updated);
    };

    const handleCheckUpdates = async () => {
        const nextStatus = await window.electronAPI.checkForUpdates();
        setUpdateStatus(nextStatus);
    };

    const handleDownloadUpdate = async () => {
        const nextStatus = await window.electronAPI.downloadUpdate();
        setUpdateStatus(nextStatus);
    };

    const handleInstallUpdate = async () => {
        const nextStatus = await window.electronAPI.installUpdate();
        setUpdateStatus(nextStatus);
    };

    return (
        <Box sx={{ maxWidth: 760 }}>
            <Typography variant="h5" sx={{ fontWeight: 800, color: 'var(--text-color)' }}>
                {t('settings.title', currentLanguage)}
            </Typography>

            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 1.5, mt: 4 }}>
                <Box>
                    <Typography sx={sectionLabel}>{t('settings.section.supportedGame', currentLanguage)}</Typography>
                    <Select
                        value={settings?.selectedGameId || selectedGame?.id || 'long-yin-li-zhi-zhuan'}
                        onChange={(e) => handleSelectGame(e.target.value)}
                        size="small"
                        sx={selectSx}
                    >
                        {supportedGames.map((game) => (
                            <MenuItem key={game.id} value={game.id}>
                                {getGameDisplayName(game, currentLanguage)}
                            </MenuItem>
                        ))}
                    </Select>
                </Box>
                <Box>
                    <Typography sx={sectionLabel}>{t('settings.section.theme', currentLanguage)}</Typography>
                    <Select
                        value={currentTheme}
                        onChange={(e) => changeTheme(e.target.value)}
                        size="small"
                        sx={selectSx}
                    >
                        {themeOptions.map((theme) => (
                            <MenuItem key={theme.key} value={theme.key}>
                                {theme.displayName}
                            </MenuItem>
                        ))}
                    </Select>
                </Box>
                <Box>
                    <Typography sx={sectionLabel}>{t('settings.section.typography', currentLanguage)}</Typography>
                    <Select
                        value={currentTypography}
                        onChange={(e) => changeTypography(e.target.value)}
                        size="small"
                        sx={selectSx}
                    >
                        {typographyOptions.map((typography) => (
                            <MenuItem key={typography.key} value={typography.key}>
                                {typography.displayName}
                            </MenuItem>
                        ))}
                    </Select>
                </Box>
                <Box>
                    <Typography sx={sectionLabel}>{t('settings.language.label', currentLanguage)}</Typography>
                    <Select
                        value={currentLanguage}
                        onChange={(e) => handleSelectLanguage(getSafeLanguage(e.target.value))}
                        size="small"
                        sx={selectSx}
                    >
                        {SUPPORTED_LANGUAGES.map((language) => (
                            <MenuItem key={language.code} value={language.code}>
                                {t(language.labelKey, currentLanguage)}
                            </MenuItem>
                        ))}
                    </Select>
                </Box>
            </Box>

            <Box sx={{ mt: 4 }}>
                <Typography sx={sectionLabel}>{t('settings.section.gameInstallFolder', currentLanguage)}</Typography>
                <Typography sx={{ color: 'var(--text-color-light)', fontSize: 13, mb: 1.5 }}>
                    {t('settings.gamePath.instructions.prefix', currentLanguage)}
                    {selectedGameName || t('settings.game.selectedFallback', currentLanguage)}
                    {t('settings.gamePath.instructions.suffix', currentLanguage)}
                    {selectedGameInstallHint ? ` ${t('settings.gamePath.examplePrefix', currentLanguage)} ${selectedGameInstallHint}` : ''}
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
                        sx={{ background: 'var(--button-bg-color)', color: 'var(--button-text-color)', flexShrink: 0 }}
                    >
                        {t('settings.button.select', currentLanguage)}
                    </Button>
                </Stack>
                {!gamePath && (
                    <Typography sx={{ mt: 1, fontSize: 13, color: 'error.main' }}>
                        {selectedGameName || t('settings.game.fallback', currentLanguage)} {t('settings.gamePath.missingSuffix', currentLanguage)}
                    </Typography>
                )}
            </Box>

            <Box sx={{ mt: 4 }}>
                <Typography sx={sectionLabel}>{t('settings.section.appUpdate', currentLanguage)}</Typography>
                <Stack spacing={1.5}>
                    <Typography sx={{ color: 'var(--text-color-light)', fontSize: 13 }}>
                        {t('settings.update.currentVersion', currentLanguage)} {appVersion || updateStatus?.currentVersion || '-'}
                        {updateStatus?.availableVersion ? ` / ${t('settings.update.latestVersion', currentLanguage)} ${updateStatus.availableVersion}` : ''}
                    </Typography>

                    {isDownloading && (
                        <Box>
                            <LinearProgress
                                variant="determinate"
                                value={updateStatus?.progress || 0}
                                sx={{ height: 8, borderRadius: 1, backgroundColor: 'var(--border-color)' }}
                            />
                            <Typography sx={{ color: 'var(--text-color-light)', fontSize: 12, mt: 0.75 }}>
                                {updateStatus?.progress || 0}%
                            </Typography>
                        </Box>
                    )}

                    {updateMessage && (
                        <Alert severity={updateStatus?.state === 'error' ? 'error' : 'info'}>
                            {updateMessage}
                        </Alert>
                    )}

                    <Stack direction="row" spacing={1.5} useFlexGap sx={{ alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                        <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
                            <Button
                                variant="contained"
                                startIcon={<SystemUpdateAltIcon />}
                                onClick={handleCheckUpdates}
                                disabled={checkDisabled}
                                sx={{ background: 'var(--button-bg-color)', color: 'var(--button-text-color)' }}
                            >
                                {t('settings.button.checkUpdates', currentLanguage)}
                            </Button>
                            <Button
                                variant="outlined"
                                startIcon={<DownloadIcon />}
                                onClick={handleDownloadUpdate}
                                disabled={downloadDisabled}
                                sx={{ color: 'var(--text-color)', borderColor: 'var(--border-color)' }}
                            >
                                {t('settings.button.download', currentLanguage)}
                            </Button>
                            <Button
                                variant="outlined"
                                startIcon={<RestartAltIcon />}
                                onClick={handleInstallUpdate}
                                disabled={installDisabled}
                                sx={{ color: 'var(--text-color)', borderColor: 'var(--border-color)' }}
                            >
                                {t('settings.button.installRestart', currentLanguage)}
                            </Button>
                        </Stack>
                        <Button
                            variant="contained"
                            startIcon={<SaveIcon />}
                            onClick={handleSave}
                            sx={{ background: 'var(--button-bg-color)', color: 'var(--button-text-color)' }}
                        >
                            {t('settings.button.save', currentLanguage)}
                        </Button>
                    </Stack>
                </Stack>
            </Box>
        </Box>
    );
}

function getGameDisplayName(game: SupportedGame | undefined, language: LanguageCode) {
    if (!game) return t('settings.game.selectedFallback', language);
    if (game.id === 'long-yin-li-zhi-zhuan') return t('settings.game.longYinLiZhiZhuan', language);

    return game.displayName;
}

function getGameInstallHint(game: SupportedGame | undefined, language: LanguageCode) {
    if (!game) return '';
    if (game.id === 'long-yin-li-zhi-zhuan') return t('settings.game.installHint.longYinLiZhiZhuan', language);

    return game.installFolderHint;
}

const selectSx = {
    width: '100%',
    color: 'var(--text-color)',
    background: 'var(--input-bg-color)',
    '& .MuiOutlinedInput-notchedOutline': { borderColor: 'var(--border-color)' },
    '& .MuiSvgIcon-root': { color: 'var(--text-color)' }
};
