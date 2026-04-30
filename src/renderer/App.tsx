// src/renderer/App.tsx
// HexX Forge 메인 레이아웃입니다.

import { useState } from 'react';
import { Box, Typography } from '@mui/material';
import Sidebar from './components/Sidebar';
import Home from './pages/Home';
import Settings from './pages/Settings';
import ModManager from './pages/ModManager';
import { useTheme } from './hooks/useTheme';

type Page = 'home' | 'mod' | 'asset' | 'optimizer' | 'settings';

export default function App() {
    useTheme();

    const [page, setPage] = useState<Page>('home');
    const [sidebarOpen, setSidebarOpen] = useState(true);

    const renderPage = () => {
        switch (page) {
            case 'home':
                return <Home />;
            case 'mod':
                return <ModManager />;
            case 'settings':
                return <Settings />;
            case 'asset':
                return <Placeholder title="어셋 관리자" />;
            case 'optimizer':
                return <Placeholder title="비급 최적화 도구" />;
            default:
                return <Home />;
        }
    };

    return (
        <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'var(--bg-color)' }}>
            <Sidebar
                open={sidebarOpen}
                currentPage={page}
                onToggle={() => setSidebarOpen((prev) => !prev)}
                onChangePage={setPage}
            />

            <Box component="main" sx={{ flex: 1, p: 4, overflow:"auto"}}>
                {renderPage()}
            </Box>
        </Box>
    );
}

function Placeholder({ title }: { title: string }) {
    return (
        <Box>
            <Typography variant="h5" sx={{ fontWeight: 800, color:"var(--text-color)"}}>
                {title}
            </Typography>
            <Typography  sx={{ mt:1, color:"var(--text-color-light)"}}>
                아직 연결되지 않았습니다.
            </Typography>
        </Box>
    );
}