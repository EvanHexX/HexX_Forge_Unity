// src/renderer/App.tsx
// HexX Forge main renderer layout.

import { lazy, Suspense, useEffect, useState } from 'react';
import { Box, CircularProgress, Stack, Typography } from '@mui/material';
import Sidebar from './components/Sidebar';
import Home from './pages/Home';
import { useTheme } from './hooks/useTheme';
import { NotificationProvider } from './context/NotificationContext';
import SplashScreen from './components/SplashScreen';

const Settings = lazy(() => import('./pages/Settings'));
const ModManager = lazy(() => import('./pages/ModManager'));
const AssetManager = lazy(() => import('./pages/AssetManager'));
const GraphicsTool = lazy(() => import('./pages/GraphicsTool'));
const CheatEngine = lazy(() => import('./pages/CheatEngine'));
const Optimizer = lazy(() => import('./pages/Optimizer'));

export type Page = 'home' | 'mod' | 'asset' | 'graphics' | 'cheat' | 'optimizer' | 'settings';
type UpdateStatus = Awaited<ReturnType<typeof window.electronAPI.getUpdateStatus>>;

function PageFallback() {
    return (
        <Stack
            sx={{
                minHeight: '50vh',
                alignItems: 'center',
                justifyContent: 'center'
            }}
            spacing={2}
        >
            <CircularProgress size={28} />
            <Typography variant="body2" color="text.secondary">
                Loading page...
            </Typography>
        </Stack>
    );
}

export default function App() {
    const {
        currentTheme,
        currentTypography,
        themeOptions,
        typographyOptions,
        changeTheme,
        changeTypography
    } = useTheme();

    const [page, setPage] = useState<Page>('home');
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [startupSplashOpen, setStartupSplashOpen] = useState(true);
    const [updateStatus, setUpdateStatus] = useState<UpdateStatus | null>(null);

    useEffect(() => {
        const timer = window.setTimeout(() => setStartupSplashOpen(false), 1200);

        window.electronAPI.getUpdateStatus().then(setUpdateStatus);
        const unsubscribe = window.electronAPI.onUpdateStatus(setUpdateStatus);

        return () => {
            window.clearTimeout(timer);
            unsubscribe();
        };
    }, []);

    const renderPage = () => {
        switch (page) {
            case 'home':
                return <Home onOpenSettings={() => setPage('settings')} />;
            case 'mod':
                return <ModManager />;
            case 'settings':
                return (
                    <Settings
                        currentTheme={currentTheme}
                        currentTypography={currentTypography}
                        themeOptions={themeOptions}
                        typographyOptions={typographyOptions}
                        changeTheme={changeTheme}
                        changeTypography={changeTypography}
                    />
                );
            case 'asset':
                return <AssetManager />;
            case 'graphics':
                return <GraphicsTool />;
            case 'cheat':
                return <CheatEngine />;
            case 'optimizer':
                return <Optimizer />;
            default:
                return <Home onOpenSettings={() => setPage('settings')} />;
        }
    };

    const updateSplashOpen = updateStatus?.state === 'checking' || updateStatus?.state === 'downloading';
    const splashMessage = updateStatus?.message || (updateStatus?.state === 'downloading' ? 'Downloading update...' : 'Checking for updates...');

    return (
        <NotificationProvider>
            <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden', bgcolor: 'var(--bg-color)' }}>
                <Sidebar
                    open={sidebarOpen}
                    currentPage={page}
                    onToggle={() => setSidebarOpen((prev) => !prev)}
                    onChangePage={setPage}
                />

                <Box component="main" sx={{ flex: 1, p: 4, overflow: 'auto' }}>
                    <Suspense fallback={<PageFallback />}>
                        {renderPage()}
                    </Suspense>
                </Box>
            </Box>
            <SplashScreen
                open={startupSplashOpen}
                mode="startup"
                message="Loading HexX Forge..."
            />
            <SplashScreen
                open={!startupSplashOpen && updateSplashOpen}
                mode="update"
                progress={updateStatus?.state === 'downloading' ? updateStatus.progress : undefined}
                message={splashMessage}
            />
        </NotificationProvider>
    );
}
