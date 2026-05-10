// src/renderer/pages/Home.tsx
// HexX Forge 홈 화면입니다.

import { useEffect, useMemo, useState } from 'react';
import { Box, Button, Card, CardActionArea, CardContent, Chip, Collapse, Link, Stack, Typography } from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';

type Props = {
    onOpenSettings: () => void;
};

type AppSettings = Awaited<ReturnType<typeof window.electronAPI.getSettings>>;
type SupportedGame = Awaited<ReturnType<typeof window.electronAPI.getSupportedGames>>[number];
type UpdateStatus = Awaited<ReturnType<typeof window.electronAPI.getUpdateStatus>>;
type GitHubRelease = Awaited<ReturnType<typeof window.electronAPI.getGitHubReleases>>[number];
type AssetStatus = Awaited<ReturnType<typeof window.electronAPI.getAssetStatus>>;

const docCards = [
    {
        id: 'mod',
        title: 'Mod Manager',
        desc: 'BepInEx 플러그인과 패키지를 관리합니다.',
        status: '사용 가능',
        docs: 'docs/modules/mod-manager.md',
        detail: 'DLL 활성/비활성, zip 패키지 가져오기, 패키지 설정 편집을 중심으로 확장 중입니다.'
    },
    {
        id: 'asset',
        title: 'Asset Manager',
        desc: '백업, 폰트, 텍스처, 어셋팩 패치를 처리합니다.',
        status: '사용 가능',
        docs: 'docs/modules/asset-manager.md',
        detail: 'Unity 리소스 백업과 복원, 폰트 교체, 텍스처 교체, 어셋팩 적용 흐름을 제공합니다.'
    },
    {
        id: 'graphics',
        title: 'Graphics Tool',
        desc: '영상과 이미지 기반 그래픽 작업을 준비합니다.',
        status: '확장 중',
        docs: 'docs/modules/graphics-tool.md',
        detail: 'portrait loop, export, preset 작업을 위한 도구 영역입니다.'
    },
    {
        id: 'cheat',
        title: 'Cheat Engine',
        desc: '게임 편의 기능을 위한 도구 영역입니다.',
        status: '구현 예정',
        docs: '',
        detail: '상세 기능 설명서는 아직 작성되지 않았습니다. TODO에 문서 작성 항목으로 남깁니다.'
    },
    {
        id: 'optimizer',
        title: 'Optimizer',
        desc: '비급 최적화 도구 연결을 준비합니다.',
        status: '구현 예정',
        docs: '',
        detail: '기존 PySide6 실행 파일 연동 방식 검토 후 구현 예정입니다.'
    },
    {
        id: 'settings',
        title: 'Settings',
        desc: '게임, 테마, 타이포그래피, 업데이트를 설정합니다.',
        status: '사용 가능',
        docs: '문서 준비 중',
        detail: '지원 게임별 설치 경로와 앱 표시 환경을 관리합니다.'
    }
];

export default function Home({ onOpenSettings }: Props) {
    const [version, setVersion] = useState('');
    const [settings, setSettings] = useState<AppSettings | null>(null);
    const [supportedGames, setSupportedGames] = useState<SupportedGame[]>([]);
    const [updateStatus, setUpdateStatus] = useState<UpdateStatus | null>(null);
    const [assetStatus, setAssetStatus] = useState<AssetStatus | null>(null);
    const [releases, setReleases] = useState<GitHubRelease[]>([]);
    const [releaseError, setReleaseError] = useState('');
    const [openCardId, setOpenCardId] = useState<string | null>(null);
    const [docsCardId, setDocsCardId] = useState<string | null>(null);

    useEffect(() => {
        window.electronAPI.getVersion().then(setVersion);
        window.electronAPI.getSettings().then(setSettings);
        window.electronAPI.getSupportedGames().then(setSupportedGames);
        window.electronAPI.getUpdateStatus().then(setUpdateStatus);
        window.electronAPI.getAssetStatus().then(setAssetStatus).catch(() => setAssetStatus(null));
        window.electronAPI.getGitHubReleases()
            .then(setReleases)
            .catch(() => setReleaseError('GitHub 릴리스 정보를 불러오지 못했습니다.'));

        return window.electronAPI.onUpdateStatus(setUpdateStatus);
    }, []);

    const selectedGame = useMemo(() => {
        const gameId = settings?.selectedGameId || 'long-yin-li-zhi-zhuan';
        return supportedGames.find((game) => game.id === gameId) || supportedGames[0];
    }, [settings?.selectedGameId, supportedGames]);

    const badge = getUpdateBadge(updateStatus);
    const gamePath = settings?.gamePath || '';
    const backupState = getBackupState(gamePath, assetStatus);

    return (
        <Box sx={{ color: 'var(--text-color)' }}>
            <Stack direction="row" spacing={2} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                    <Stack direction="row" spacing={1.25} useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                        <Typography variant="h4" sx={{ fontWeight: 900, color: 'var(--text-color)' }}>
                            HexX Forge v{version || '1.13.x'}-beta
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
                        Unity 기반 게임의 모드, 폰트, 어셋 패치를 한 곳에서 관리하는 데스크톱 도구입니다.
                    </Typography>
                    <Typography sx={{ mt: 1, color: 'var(--text-color-secondary)', fontSize: 13 }}>
                        지원 게임: {selectedGame?.displayName || '용윤입지전'}
                    </Typography>
                </Box>
            </Stack>

            <Box sx={sectionSx}>
                <Typography variant="h6" sx={{ fontWeight: 800 }}>
                    상태
                </Typography>
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mt: 2 }}>
                    <StatusItem label="현재 게임" value={selectedGame?.displayName || '용윤입지전'} />
                    <StatusItem label="백업 상태" value={backupState.label} tone={backupState.tone} />
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
                            Settings
                        </Button>
                    )}
                </Stack>
                {gamePath && backupState.missing.length > 0 && (
                    <Stack direction="row" spacing={1.5} sx={{ mt: 2, alignItems: 'center' }}>
                        <Typography sx={{ color: 'var(--text-color-secondary)', fontSize: 13 }}>
                            Asset Manager에서 {backupState.missing.join(', ')} 백업을 먼저 진행하세요.
                        </Typography>
                    </Stack>
                )}
            </Box>

            <Box sx={sectionSx}>
                <Typography variant="h6" sx={{ fontWeight: 800 }}>
                    뉴스 및 업데이트
                </Typography>
                <Stack spacing={1.5} sx={{ mt: 2 }}>
                    {releases.slice(0, 3).map((release) => (
                        <Box key={release.id} sx={newsItemSx}>
                            <Stack direction="row" spacing={2} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
                                <Typography sx={{ fontWeight: 800 }}>{release.name}</Typography>
                                <Typography sx={{ color: 'var(--text-color-secondary)', fontSize: 12 }}>
                                    {formatDate(release.publishedAt)}
                                </Typography>
                            </Stack>
                            <Typography sx={{ mt: 0.75, color: 'var(--text-color-light)', fontSize: 13 }}>
                                {summarizeRelease(release.body)}
                            </Typography>
                            <Link href={release.htmlUrl} target="_blank" rel="noreferrer" sx={{ mt: 0.75, display: 'inline-block' }}>
                                GitHub에서 보기
                            </Link>
                        </Box>
                    ))}
                    {releases.length === 0 && (
                        <Typography sx={{ color: 'var(--text-color-light)' }}>
                            {releaseError || '표시할 GitHub 릴리스가 아직 없습니다.'}
                        </Typography>
                    )}
                </Stack>
            </Box>

            <Box sx={{ ...sectionSx, mb: 2 }}>
                <Typography variant="h6" sx={{ fontWeight: 800 }}>
                    설명서
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
                                                {card.title}
                                            </Typography>
                                            <Chip size="small" label={card.status} />
                                        </Stack>
                                        <Typography sx={{ mt: 1, color: 'var(--text-color-light)', fontSize: 14 }}>
                                            {card.desc}
                                        </Typography>
                                    </CardContent>
                                </CardActionArea>
                                <Collapse in={open} timeout="auto" unmountOnExit>
                                    <CardContent sx={{ pt: 0 }}>
                                            <Box sx={{ pt: 2, borderTop: '1px solid var(--border-color)' }}>
                                                <Typography sx={{ color: 'var(--text-color-light)', fontSize: 13 }}>
                                                    {card.detail}
                                                </Typography>
                                                <Button
                                                    variant="outlined"
                                                    size="small"
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        setDocsCardId(docsOpen ? null : card.id);
                                                    }}
                                                    sx={{ mt: 1.5, color: 'var(--text-color)', borderColor: 'var(--border-color)' }}
                                                >
                                                    상세 설명 보기
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
                                                            {card.title} 설명서
                                                        </Typography>
                                                        <Typography sx={{ mt: 1, color: 'var(--text-color-light)', fontSize: 13 }}>
                                                            연결 문서: {card.docs || '문서 준비 중'}
                                                        </Typography>
                                                        <Typography sx={{ mt: 1, color: 'var(--text-color-secondary)', fontSize: 13 }}>
                                                            다음 단계에서 이 영역에 docs 파일 내용을 렌더링하도록 연결합니다.
                                                        </Typography>
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

function getBackupState(gamePath: string, assetStatus: AssetStatus | null) {
    if (!gamePath) {
        return {
            label: '설정 필요',
            message: '설정에서 게임 설치 폴더를 지정하세요.',
            tone: 'warning' as const,
            color: 'var(--accent-color)',
            missing: [] as string[]
        };
    }

    if (!assetStatus) {
        return {
            label: '확인 중',
            message: '어셋 백업 상태를 확인하는 중입니다.',
            tone: 'normal' as const,
            color: 'var(--text-color-light)',
            missing: [] as string[]
        };
    }

    const missing = [
        assetStatus.font ? '' : '폰트',
        assetStatus.asset ? '' : '어셋'
    ].filter(Boolean);

    if (missing.length > 0) {
        return {
            label: '백업 필요',
            message: '설정 정보가 연결되었습니다. 안전한 작업을 위해 필요한 백업을 먼저 진행하세요.',
            tone: 'warning' as const,
            color: 'var(--accent-color)',
            missing
        };
    }

    return {
        label: '정상',
        message: '설정 정보와 폰트/어셋 백업 상태가 정상입니다.',
        tone: 'normal' as const,
        color: 'var(--text-color-light)',
        missing: [] as string[]
    };
}

function getUpdateBadge(status: UpdateStatus | null) {
    if (!status) {
        return {
            label: '상태 확인 중',
            color: 'var(--text-color)',
            bg: 'color-mix(in srgb, var(--secondary-color) 18%, transparent)',
            border: 'var(--border-color)'
        };
    }

    if (status.state === 'available') return badge('업데이트 있음', '#0f5132', '#d1e7dd', '#badbcc');
    if (status.state === 'downloaded') return badge('설치 준비됨', '#664d03', '#fff3cd', '#ffecb5');
    if (status.state === 'error') return badge('업데이트 오류', '#842029', '#f8d7da', '#f5c2c7');
    if (status.state === 'checking' || status.state === 'downloading') return badge('업데이트 확인 중', '#084298', '#cfe2ff', '#b6d4fe');

    return badge('최신 상태', '#055160', '#cff4fc', '#b6effb');
}

function badge(label: string, color: string, bg: string, border: string) {
    return { label, color, bg, border };
}

function summarizeRelease(body: string) {
    const firstLine = body
        .split('\n')
        .map((line) => line.replace(/^#+\s*/, '').trim())
        .find(Boolean);

    if (!firstLine) return '릴리스 상세 내용은 GitHub에서 확인할 수 있습니다.';
    return firstLine.length > 140 ? `${firstLine.slice(0, 140)}...` : firstLine;
}

function formatDate(value: string) {
    if (!value) return '-';
    return new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(value));
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
