// src/renderer/components/Sidebar.tsx
// 🎨 접힘/펼침 가능한 사이드바 메뉴 (애니메이션 최적화 버전)

import {
    Box,
    IconButton,
    List,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    Typography
} from '@mui/material';
import { useEffect, useState, type ReactNode } from 'react';
import HomeIcon from '@mui/icons-material/Home';
import ExtensionIcon from '@mui/icons-material/Extension';
import InventoryIcon from '@mui/icons-material/Inventory';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import SettingsIcon from '@mui/icons-material/Settings';
import MenuOpenIcon from '@mui/icons-material/MenuOpen';
import BrushIcon from '@mui/icons-material/Brush';
import MemoryIcon from '@mui/icons-material/Memory';
import type { Page } from '../App';
import ShinyText from './ShinyText';
import { getSafeLanguage, t, type I18nKey, type LanguageCode } from '../i18n';

type Props = {
    open: boolean;
    currentPage: Page;
    onToggle: () => void;
    onChangePage: (page: Page) => void;
};

const menus: { page: Page; labelKey?: I18nKey; label?: string; icon: ReactNode }[] = [
    { page: 'home', labelKey: 'nav.forgeHub', icon: <HomeIcon /> },
    { page: 'mod', labelKey: 'nav.modForge', icon: <ExtensionIcon /> },
    { page: 'asset', labelKey: 'nav.assetForge', icon: <InventoryIcon /> },
    { page: 'graphics', labelKey: 'nav.visualForge', icon: <BrushIcon /> },
    { page: 'cheat', labelKey: 'nav.coreLab', icon: <MemoryIcon /> },
    { page: 'optimizer', labelKey: 'nav.synthesisLab', icon: <AutoFixHighIcon /> },
    { page: 'settings', labelKey: 'nav.settings', icon: <SettingsIcon /> }
];

export default function Sidebar({ open, currentPage, onToggle, onChangePage }: Props) {
    const SIDEBAR_WIDTH = 240;
    const COLLAPSED_WIDTH = 54;
    const [currentLanguage, setCurrentLanguage] = useState<LanguageCode>('en');

    useEffect(() => {
        window.electronAPI.getSettings().then((settings) => {
            setCurrentLanguage(getSafeLanguage(settings.language));
        });
    }, [currentPage]);

    return (
        <Box
            sx={{
                width: open ? SIDEBAR_WIDTH : COLLAPSED_WIDTH,
                flexShrink: 0,
                height: '100%',
                transition: 'width 200ms cubic-bezier(0.4, 0, 0.2, 1)',
                background: 'var(--sidebar-bg-color)',
                borderRight: '1px solid var(--border-color)',
                color: 'var(--text-color)',
                overflowX: 'hidden'
            }}
        >
            <Box sx={{
                display: "flex",
                alignItems: "center",
                minHeight: 64,
                px: 1.5, // ✅ 패딩 고정
                position: 'relative'
            }}>
                {/* 로고 텍스트 애니메이션 */}
                <Typography
                    sx={{
                        fontWeight: 900,
                        fontSize: 18,
                        whiteSpace: 'nowrap',
                        transition: 'opacity 150ms ease, transform 200ms ease',
                        opacity: open ? 1 : 0,
                        transform: open ? 'translateX(0)' : 'translateX(-10px)', // ✅ 살짝 밀려나오듯 등장
                        pointerEvents: 'none'
                    }}
                >
                    <ShinyText text="HexX Forge" speed={4.8} />
                </Typography>

                <IconButton
                    onClick={onToggle}
                    sx={{
                        color: 'var(--text-color)',
                        position: 'absolute',
                        right: 7, // ✅ 오른쪽에 고정시켜 아이콘 이동 방지
                        transform: open ? 'rotate(0deg)' : 'rotate(180deg)',
                        transition: 'transform 200ms ease'
                    }}
                >
                    <MenuOpenIcon />
                </IconButton>
            </Box>

            <List sx={{ px: 1 }}>
                {menus.map((menu) => {
                    const active = currentPage === menu.page;

                    return (
                        <ListItemButton
                            key={menu.page}
                            onClick={() => onChangePage(menu.page)}
                            sx={{
                                minHeight: 38,
                                px: 0, // ✅ 전체 패딩 해제 후 내부에서 정렬
                                mb: 0.5,
                                borderRadius: 2,
                                display: 'flex',
                                justifyContent: 'flex-start', // ✅ 항상 왼쪽 정렬 유지
                                transition: 'all 200ms ease',
                                color: active ? 'var(--button-text-color)' : 'var(--text-color-light)',
                                background: active ? 'var(--active-bg-color)' : 'transparent',
                                '&:hover': {
                                    background: active ? 'var(--active-bg-color)' : 'var(--hover-bg-color)',
                                }
                            }}
                        >
                            {/* ✅ 아이콘 영역: 너비를 고정하여 위치를 고정시킴 */}
                            <ListItemIcon
                                sx={{
                                    minWidth: COLLAPSED_WIDTH - 16, // ✅ 닫혔을 때의 너비에 맞춰 고정 (px:1 고려)
                                    display: 'flex',
                                    justifyContent: 'center',
                                    color: 'inherit',
                                    margin: 0 // ✅ 마진 변화 제거
                                }}
                            >
                                {menu.icon}
                            </ListItemIcon>

                            {/* ✅ 텍스트 영역: 아이콘 뒤에서 자연스럽게 나타남 */}
                            <ListItemText
                                primary={menu.labelKey ? t(menu.labelKey, currentLanguage) : menu.label}
                                sx={{
                                    m: 0,
                                    opacity: open ? 1 : 0,
                                    transition: 'opacity 200ms ease',
                                    '& .MuiTypography-root': {
                                        fontWeight: active ? 600 : 400,
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden'
                                    }
                                }}
                            />
                        </ListItemButton>
                    );
                })}
            </List>
        </Box>
    );
}
