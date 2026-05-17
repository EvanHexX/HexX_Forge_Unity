// src/renderer/pages/Home.tsx
// HexX Forge 홈 화면입니다.

import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { Box, Button, Card, CardActionArea, CardContent, Chip, CircularProgress, Collapse, Link, Stack, Typography } from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import SettingsIcon from '@mui/icons-material/Settings';
import { useNotification } from '../context/NotificationContext';
import { getSafeLanguage, t, type I18nKey, type LanguageCode } from '../i18n';
import ShinyText from '../components/ShinyText';

type Props = {
    onOpenSettings: () => void;
};

type AppSettings = Awaited<ReturnType<typeof window.electronAPI.getSettings>>;
type SupportedGame = Awaited<ReturnType<typeof window.electronAPI.getSupportedGames>>[number];
type UpdateStatus = Awaited<ReturnType<typeof window.electronAPI.getUpdateStatus>>;
type GitHubRelease = Awaited<ReturnType<typeof window.electronAPI.getGitHubReleases>>[number];
type AssetStatus = Awaited<ReturnType<typeof window.electronAPI.getAssetStatus>>;

type DocCard = {
    id: string;
    titleKey: I18nKey;
    descKey: I18nKey;
    statusKey: I18nKey;
    docs: string;
    detailKey: I18nKey;
};

const NEWS_RELEASE_LIMIT = 3;

const docCards: DocCard[] = [
    {
        id: 'mod',
        titleKey: 'nav.modForge',
        descKey: 'home.doc.mod.desc',
        statusKey: 'home.doc.mod.status',
        docs: 'docs/manuals/mod-forge.md',
        detailKey: 'home.doc.mod.detail'
    },
    {
        id: 'asset',
        titleKey: 'nav.assetForge',
        descKey: 'home.doc.asset.desc',
        statusKey: 'home.doc.asset.status',
        docs: 'docs/manuals/asset-forge.md',
        detailKey: 'home.doc.asset.detail'
    },
    {
        id: 'graphics',
        titleKey: 'nav.visualForge',
        descKey: 'home.doc.graphics.desc',
        statusKey: 'home.doc.graphics.status',
        docs: 'docs/manuals/visual-forge.md',
        detailKey: 'home.doc.graphics.detail'
    },
    {
        id: 'cheat',
        titleKey: 'nav.coreLab',
        descKey: 'home.doc.cheat.desc',
        statusKey: 'home.doc.cheat.status',
        docs: 'docs/manuals/core-lab.md',
        detailKey: 'home.doc.cheat.detail'
    },
    {
        id: 'optimizer',
        titleKey: 'nav.synthesisLab',
        descKey: 'home.doc.optimizer.desc',
        statusKey: 'home.doc.optimizer.status',
        docs: 'docs/manuals/synthesis-lab.md',
        detailKey: 'home.doc.optimizer.detail'
    },
    {
        id: 'settings',
        titleKey: 'nav.settings',
        descKey: 'home.doc.settings.desc',
        statusKey: 'home.doc.settings.status',
        docs: 'docs/manuals/settings.md',
        detailKey: 'home.doc.settings.detail'
    }
];

export default function Home({ onOpenSettings }: Props) {
    const { showNotification } = useNotification();
    const [version, setVersion] = useState('');
    const [settings, setSettings] = useState<AppSettings | null>(null);
    const [supportedGames, setSupportedGames] = useState<SupportedGame[]>([]);
    const [updateStatus, setUpdateStatus] = useState<UpdateStatus | null>(null);
    const [assetStatus, setAssetStatus] = useState<AssetStatus | null>(null);
    const [releases, setReleases] = useState<GitHubRelease[]>([]);
    const [releaseLoadFailed, setReleaseLoadFailed] = useState(false);
    const [launchingGame, setLaunchingGame] = useState(false);
    const [openCardId, setOpenCardId] = useState<string | null>(null);
    const [docsCardId, setDocsCardId] = useState<string | null>(null);
    const [docsContentByPath, setDocsContentByPath] = useState<Record<string, string>>({});
    const [docsLoadingPath, setDocsLoadingPath] = useState<string | null>(null);
    const [docsErrorPath, setDocsErrorPath] = useState<string | null>(null);

    useEffect(() => {
        window.electronAPI.getVersion().then(setVersion);
        window.electronAPI.getSettings().then(setSettings);
        window.electronAPI.getSupportedGames().then(setSupportedGames);
        window.electronAPI.getUpdateStatus().then(setUpdateStatus);
        window.electronAPI.getAssetStatus().then(setAssetStatus).catch(() => setAssetStatus(null));
        window.electronAPI.getGitHubReleases()
            .then(setReleases)
            .catch(() => setReleaseLoadFailed(true));

        return window.electronAPI.onUpdateStatus(setUpdateStatus);
    }, []);

    const currentLanguage = getSafeLanguage(settings?.language);
    const selectedGame = useMemo(() => {
        const gameId = settings?.selectedGameId || 'long-yin-li-zhi-zhuan';
        return supportedGames.find((game) => game.id === gameId) || supportedGames[0];
    }, [settings?.selectedGameId, supportedGames]);

    const badge = getUpdateBadge(updateStatus, currentLanguage);
    const gamePath = settings?.gamePath || '';
    const selectedGameName = getGameDisplayName(selectedGame, currentLanguage);
    const backupState = getBackupState(gamePath, assetStatus, currentLanguage);
    const latestReleases = useMemo(
        () => [...releases]
            .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
            .slice(0, NEWS_RELEASE_LIMIT),
        [releases]
    );

    const handleLaunchGame = async () => {
        if (!gamePath || launchingGame) return;

        setLaunchingGame(true);
        try {
            const result = await window.electronAPI.launchGame();
            if (result.ok) {
                showNotification(t('home.launch.success', currentLanguage), 'success');
                return;
            }

            showNotification(t('home.launch.failure', currentLanguage), 'error', {
                copyText: result.message
            });
        } catch (error) {
            showNotification(t('home.launch.failure', currentLanguage), 'error', {
                copyText: getErrorMessage(error)
            });
        } finally {
            setLaunchingGame(false);
        }
    };

    const handleToggleDocs = async (card: DocCard, docsOpen: boolean) => {
        if (docsOpen) {
            setDocsCardId(null);
            return;
        }

        setDocsCardId(card.id);
        if (!card.docs || docsContentByPath[card.docs] || docsLoadingPath === card.docs) return;

        setDocsLoadingPath(card.docs);
        setDocsErrorPath(null);
        try {
            const content = await window.electronAPI.readManualDocument(card.docs);
            setDocsContentByPath((current) => ({ ...current, [card.docs]: content }));
        } catch (error) {
            setDocsErrorPath(card.docs);
            showNotification(t('home.docs.loadFailed', currentLanguage), 'error', {
                copyText: getErrorMessage(error)
            });
        } finally {
            setDocsLoadingPath((current) => (current === card.docs ? null : current));
        }
    };

    return (
        <Box sx={{ color: 'var(--text-color)' }}>
            <Stack direction="row" spacing={2} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                    <Typography sx={{ color: 'var(--text-color-secondary)', fontSize: 12, fontWeight: 800, textTransform: 'uppercase' }}>
                        {t('nav.forgeHub', currentLanguage)}
                    </Typography>
                    <Stack direction="row" spacing={1.25} useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                        <Typography variant="h4" sx={{ fontWeight: 900, color: 'var(--text-color-light)' }}>
                            <ShinyText
                                text="HexX Forge" speed={4.8}/> v{version || '1.16.0-beta.0'}
                        </Typography>
                        <Chip
                            size="small"
                            label={badge.label}
                            sx={{
                                color: badge.color,
                                backgroundColor: badge.bg,
                                border: `1px solid ${badge.border}`,
                                fontWeight: 800
                            }}
                        />
                    </Stack>
                    <Typography sx={{ mt: 1, color: 'var(--text-color-light)', maxWidth: 760 }}>
                        {t('home.app.subtitle', currentLanguage)}
                    </Typography>
                    <Typography sx={{ mt: 1, color: 'var(--text-color-secondary)', fontSize: 13 }}>
                        {t('home.supportedGame', currentLanguage)} {selectedGameName}
                    </Typography>
                </Box>
            </Stack>

            <Box sx={sectionSx}>
                <Typography variant="h6" sx={{ fontWeight: 800 }}>
                    {t('home.section.status', currentLanguage)}
                </Typography>
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mt: 2 }}>
                    <StatusItem
                        label={t('home.status.currentGame', currentLanguage)}
                        value={selectedGameName}
                    />
                    <StatusItem
                        label={t('home.status.backup', currentLanguage)}
                        value={backupState.label}
                        tone={backupState.tone}
                    />
                    <Box sx={{ ...statusItemSx, display: 'flex', flexDirection: 'column', gap: 1 }}>
                        <Typography sx={{ color: 'var(--text-color-secondary)', fontSize: 12, fontWeight: 700 }}>
                            {t('home.status.launch', currentLanguage)}
                        </Typography>
                        <Button
                            variant="contained"
                            size="small"
                            startIcon={<PlayArrowIcon />}
                            onClick={handleLaunchGame}
                            disabled={!gamePath || launchingGame}
                            sx={{ alignSelf: 'flex-start', background: 'var(--button-bg-color)', color: 'var(--button-text-color)' }}
                        >
                            {launchingGame ? t('home.button.launchingGame', currentLanguage) : t('home.button.launchGame', currentLanguage)}
                        </Button>
                        <Typography sx={{ color: 'var(--text-color-light)', fontSize: 12 }}>
                            {t('home.status.launchHint', currentLanguage)}
                        </Typography>
                    </Box>
                </Stack>
                <Stack direction="row" spacing={1.5} sx={{ mt: 2, alignItems: 'center' }}>
                    <Typography sx={{ color: backupState.color, fontSize: 14 }}>
                        {backupState.message}
                    </Typography>
                    {!gamePath && (
                        <Button
                            variant="contained"
                            size="small"
                            startIcon={<SettingsIcon />}
                            onClick={onOpenSettings}
                            sx={{ background: 'var(--button-bg-color)', color: 'var(--button-text-color)' }}
                        >
                            {t('home.button.settings', currentLanguage)}
                        </Button>
                    )}
                </Stack>
                {gamePath && backupState.missing.length > 0 && (
                    <Stack direction="row" spacing={1.5} sx={{ mt: 2, alignItems: 'center' }}>
                        <Typography sx={{ color: 'var(--text-color-secondary)', fontSize: 13 }}>
                            {t('home.backup.missingMessagePrefix', currentLanguage)} {backupState.missing.join(', ')}
                        </Typography>
                    </Stack>
                )}
            </Box>

            <Box sx={sectionSx}>
                <Typography variant="h6" sx={{ fontWeight: 800 }}>
                    {t('home.section.news', currentLanguage)}
                </Typography>
                <Stack spacing={1.5} sx={{ mt: 2 }}>
                    {latestReleases.map((release) => (
                        <Box key={release.id} sx={newsItemSx}>
                            <Stack direction="row" spacing={2} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
                                <Typography sx={{ fontWeight: 800 }}>{release.name}</Typography>
                                <Typography sx={{ color: 'var(--text-color-secondary)', fontSize: 12 }}>
                                    {formatDate(release.publishedAt, currentLanguage)}
                                </Typography>
                            </Stack>
                            <Typography sx={{ mt: 0.75, color: 'var(--text-color-light)', fontSize: 13 }}>
                                {summarizeRelease(release.body, currentLanguage)}
                            </Typography>
                            <Link href={release.htmlUrl} target="_blank" rel="noreferrer" sx={{ mt: 0.75, display: 'inline-block' }}>
                                {t('home.button.details', currentLanguage)}
                            </Link>
                        </Box>
                    ))}
                    {releases.length === 0 && (
                        <Typography sx={{ color: 'var(--text-color-light)' }}>
                            {releaseLoadFailed ? t('home.release.loadFailed', currentLanguage) : t('home.release.empty', currentLanguage)}
                        </Typography>
                    )}
                </Stack>
            </Box>

            <Box sx={{ ...sectionSx, mb: 2 }}>
                <Typography variant="h6" sx={{ fontWeight: 800 }}>
                    {t('home.section.docs', currentLanguage)}
                </Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 2, mt: 2 }}>
                    {docCards.map((card) => {
                        const open = openCardId === card.id;
                        const docsOpen = docsCardId === card.id;

                        return (
                            <Card
                                key={card.id}
                                sx={{
                                    gridColumn: docsOpen ? '1 / -1' : 'auto',
                                    background: 'var(--sidebar-bg-color)',
                                    color: 'var(--text-color)',
                                    border: `1px solid ${open ? 'var(--primary-color)' : 'var(--border-color)'}`,
                                    boxShadow: 'var(--shadow-small)',
                                    borderRadius: 2,
                                    transition: 'border-color 160ms ease, background 160ms ease',
                                    '&:hover': {
                                        borderColor: 'var(--primary-color)',
                                        background: 'color-mix(in srgb, var(--primary-color) 14%, var(--sidebar-bg-color))'
                                    }
                                }}
                            >
                                <CardActionArea
                                    onClick={() => {
                                        setOpenCardId(open ? null : card.id);
                                        if (open) setDocsCardId(null);
                                    }}
                                >
                                    <CardContent>
                                        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
                                            <Typography variant="h6" sx={{ fontWeight: 800 }}>
                                                {t(card.titleKey, currentLanguage)}
                                            </Typography>
                                            <Chip size="small" label={t(card.statusKey, currentLanguage)} />
                                        </Stack>
                                        <Typography sx={{ mt: 1, color: 'var(--text-color-light)', fontSize: 14 }}>
                                            {t(card.descKey, currentLanguage)}
                                        </Typography>
                                    </CardContent>
                                </CardActionArea>
                                <Collapse in={open} timeout="auto" unmountOnExit>
                                    <CardContent sx={{ pt: 0 }}>
                                        <Box sx={{ pt: 2, borderTop: '1px solid var(--border-color)' }}>
                                            <Typography sx={{ color: 'var(--text-color-light)', fontSize: 13 }}>
                                                {t(card.detailKey, currentLanguage)}
                                            </Typography>
                                            <Button
                                                variant="outlined"
                                                size="small"
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    void handleToggleDocs(card, docsOpen);
                                                }}
                                                sx={{ mt: 1.5, color: 'var(--text-color)', borderColor: 'var(--border-color)' }}
                                            >
                                                {t('home.button.more', currentLanguage)}
                                            </Button>
                                            <Collapse in={docsOpen} timeout="auto" unmountOnExit>
                                                <Box
                                                    sx={{
                                                        mt: 2,
                                                        p: 2,
                                                        border: '1px solid var(--border-color)',
                                                        borderRadius: 1,
                                                        background: 'var(--input-bg-color)'
                                                    }}
                                                    onClick={(event) => event.stopPropagation()}
                                                >
                                                    <Typography sx={{ fontWeight: 800 }}>
                                                        {t(card.titleKey, currentLanguage)} {t('home.section.docs', currentLanguage)}
                                                    </Typography>
                                                    <Typography sx={{ mt: 1, color: 'var(--text-color-light)', fontSize: 13 }}>
                                                        {t('home.docs.connectedDocument', currentLanguage)} {card.docs || t('home.docs.notReady', currentLanguage)}
                                                    </Typography>
                                                    <ManualDocument
                                                        content={card.docs ? docsContentByPath[card.docs] : ''}
                                                        loading={docsLoadingPath === card.docs}
                                                        error={docsErrorPath === card.docs}
                                                        language={currentLanguage}
                                                    />
                                                </Box>
                                            </Collapse>
                                        </Box>
                                    </CardContent>
                                </Collapse>
                            </Card>
                        );
                    })}
                </Box>
            </Box>
        </Box>
    );
}

function ManualDocument({
    content,
    loading,
    error,
    language
}: {
    content: string;
    loading: boolean;
    error: boolean;
    language: LanguageCode;
}) {
    if (loading) {
        return (
            <Stack direction="row" spacing={1.25} sx={{ mt: 2, alignItems: 'center', color: 'var(--text-color-light)' }}>
                <CircularProgress size={18} />
                <Typography sx={{ fontSize: 13 }}>{t('home.docs.loading', language)}</Typography>
            </Stack>
        );
    }

    if (error) {
        return (
            <Typography sx={{ mt: 2, color: 'error.main', fontSize: 13 }}>
                {t('home.docs.loadFailed', language)}
            </Typography>
        );
    }

    if (!content) {
        return (
            <Typography sx={{ mt: 1, color: 'var(--text-color-secondary)', fontSize: 13 }}>
                {t('home.docs.nextStep', language)}
            </Typography>
        );
    }

    return (
        <Box sx={manualViewerSx}>
            {renderMarkdown(content)}
        </Box>
    );
}

function renderMarkdown(content: string) {
    return content
        .replace(/\r\n/g, '\n')
        .split('\n')
        .map((line, index) => renderMarkdownLine(line, index))
        .filter(Boolean);
}

function renderMarkdownLine(line: string, index: number) {
    const trimmed = line.trim();
    if (!trimmed) return <Box key={index} sx={{ height: 8 }} />;

    const heading = /^(#{1,3})\s+(.+)$/.exec(trimmed);
    if (heading) {
        const level = heading[1].length;
        return (
            <Typography
                key={index}
                variant={level === 1 ? 'h5' : level === 2 ? 'h6' : 'subtitle1'}
                sx={{
                    mt: level === 1 ? 0 : 2,
                    mb: 0.75,
                    color: 'var(--text-color)',
                    fontWeight: 900,
                    fontSize: level === 1 ? 22 : level === 2 ? 18 : 15
                }}
            >
                {renderInlineMarkdown(heading[2])}
            </Typography>
        );
    }

    if (trimmed.startsWith('[스크린샷:')) {
        return (
            <Box key={index} sx={screenshotPlaceholderSx}>
                {renderInlineMarkdown(trimmed)}
            </Box>
        );
    }

    const ordered = /^\d+\.\s+(.+)$/.exec(trimmed);
    if (ordered) {
        return (
            <Typography key={index} sx={manualListItemSx}>
                <Box component="span" sx={manualBulletSx}>{`${trimmed.split('.')[0]}.`}</Box>
                {renderInlineMarkdown(ordered[1])}
            </Typography>
        );
    }

    const bullet = /^-\s+(.+)$/.exec(trimmed);
    if (bullet) {
        return (
            <Typography key={index} sx={manualListItemSx}>
                <Box component="span" sx={manualBulletSx}>-</Box>
                {renderInlineMarkdown(bullet[1])}
            </Typography>
        );
    }

    return (
        <Typography key={index} sx={{ my: 0.75, color: 'var(--text-color-light)', fontSize: 14, lineHeight: 1.75 }}>
            {renderInlineMarkdown(trimmed)}
        </Typography>
    );
}

function renderInlineMarkdown(text: string): ReactNode[] {
    return text.split(/(`[^`]+`)/g).filter(Boolean).map((part, index) => {
        if (part.startsWith('`') && part.endsWith('`')) {
            return (
                <Box
                    key={index}
                    component="code"
                    sx={{
                        px: 0.5,
                        py: 0.15,
                        borderRadius: 0.5,
                        color: 'var(--text-color)',
                        backgroundColor: 'color-mix(in srgb, var(--primary-color) 14%, transparent)',
                        fontFamily: 'monospace',
                        fontSize: '0.92em'
                    }}
                >
                    {part.slice(1, -1)}
                </Box>
            );
        }

        return part;
    });
}

function StatusItem({ label, value, tone = 'normal' }: { label: string; value: string; tone?: 'normal' | 'warning' }) {
    return (
        <Box sx={statusItemSx}>
            <Typography sx={{ color: 'var(--text-color-secondary)', fontSize: 12, fontWeight: 700 }}>
                {label}
            </Typography>
            <Typography sx={{ mt: 0.5, color: tone === 'warning' ? 'var(--accent-color)' : 'var(--text-color)', fontWeight: 800 }}>
                {value}
            </Typography>
        </Box>
    );
}

function getGameDisplayName(game: SupportedGame | undefined, language: LanguageCode) {
    if (!game) return t('home.defaultGame', language);
    if (game.id === 'long-yin-li-zhi-zhuan') return t('home.game.longYinLiZhiZhuan', language);

    return game.displayName;
}

function getBackupState(gamePath: string, assetStatus: AssetStatus | null, language: LanguageCode) {
    if (!gamePath) {
        return {
            label: t('home.backup.requiredSettings', language),
            message: t('home.backup.requiredSettingsMessage', language),
            tone: 'warning' as const,
            color: 'var(--accent-color)',
            missing: [] as string[]
        };
    }

    if (!assetStatus) {
        return {
            label: t('home.backup.checking', language),
            message: t('home.backup.checkingMessage', language),
            tone: 'normal' as const,
            color: 'var(--text-color-light)',
            missing: [] as string[]
        };
    }

    const missing = [
        assetStatus.font ? '' : t('home.backup.missing.font', language),
        assetStatus.asset ? '' : t('home.backup.missing.asset', language)
    ].filter(Boolean);

    if (missing.length > 0) {
        return {
            label: t('home.backup.required', language),
            message: t('home.backup.requiredMessage', language),
            tone: 'warning' as const,
            color: 'var(--accent-color)',
            missing
        };
    }

    return {
        label: t('home.backup.normal', language),
        message: t('home.backup.normalMessage', language),
        tone: 'normal' as const,
        color: 'var(--text-color-light)',
        missing: [] as string[]
    };
}

function getUpdateBadge(status: UpdateStatus | null, language: LanguageCode) {
    if (!status) {
        return {
            label: t('home.updateBadge.checking', language),
            color: 'var(--text-color)',
            bg: 'color-mix(in srgb, var(--secondary-color) 18%, transparent)',
            border: 'var(--border-color)'
        };
    }

    if (status.state === 'available') return badge(t('home.updateBadge.available', language), '#0f5132', '#d1e7dd', '#badbcc');
    if (status.state === 'downloaded') return badge(t('home.updateBadge.downloaded', language), '#664d03', '#fff3cd', '#ffecb5');
    if (status.state === 'error') return badge(t('home.updateBadge.error', language), '#842029', '#f8d7da', '#f5c2c7');
    if (status.state === 'checking' || status.state === 'downloading') return badge(t('home.updateBadge.inProgress', language), '#084298', '#cfe2ff', '#b6d4fe');

    return badge(t('home.updateBadge.latest', language), '#055160', '#cff4fc', '#b6effb');
}

function badge(label: string, color: string, bg: string, border: string) {
    return { label, color, bg, border };
}

function summarizeRelease(body: string, language: LanguageCode) {
    const firstLine = body
        .split('\n')
        .map((line) => line.replace(/^#+\s*/, '').trim())
        .find(Boolean);

    if (!firstLine) return t('home.release.summaryFallback', language);
    return firstLine.length > 140 ? `${firstLine.slice(0, 140)}...` : firstLine;
}

function formatDate(value: string, language: LanguageCode) {
    if (!value) return '-';
    return new Intl.DateTimeFormat(getDateLocale(language), { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(value));
}

function getDateLocale(language: LanguageCode) {
    if (language === 'ko') return 'ko-KR';
    if (language === 'zh-CN') return 'zh-CN';
    return 'en-US';
}

function getErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : '';
}

const sectionSx = {
    mt: 4,
    p: 2.5,
    border: '1px solid var(--border-color)',
    borderRadius: 2,
    background: 'color-mix(in srgb, var(--sidebar-bg-color) 70%, transparent)'
};

const statusItemSx = {
    flex: 1,
    minWidth: 220,
    p: 1.5,
    border: '1px solid var(--border-color)',
    borderRadius: 1,
    background: 'var(--input-bg-color)'
};

const newsItemSx = {
    p: 1.5,
    border: '1px solid var(--border-color)',
    borderRadius: 1,
    background: 'var(--input-bg-color)'
};

const manualViewerSx = {
    mt: 2,
    maxHeight: 560,
    overflowY: 'auto' as const,
    pr: 1,
    color: 'var(--text-color)',
    '&::-webkit-scrollbar': {
        width: 8
    },
    '&::-webkit-scrollbar-thumb': {
        backgroundColor: 'var(--border-color)',
        borderRadius: 1
    }
};

const manualListItemSx = {
    my: 0.5,
    pl: 2.5,
    color: 'var(--text-color-light)',
    fontSize: 14,
    lineHeight: 1.65,
    position: 'relative' as const
};

const manualBulletSx = {
    position: 'absolute' as const,
    left: 0,
    color: 'var(--primary-color)',
    fontWeight: 800
};

const screenshotPlaceholderSx = {
    my: 1.25,
    p: 1.25,
    border: '1px dashed var(--border-color)',
    borderRadius: 1,
    color: 'var(--text-color-secondary)',
    background: 'color-mix(in srgb, var(--primary-color) 8%, transparent)',
    fontSize: 13,
    lineHeight: 1.6
};
