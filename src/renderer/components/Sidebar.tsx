// src/renderer/components/Sidebar.tsx
// 접힘/펼침 가능한 사이드바 메뉴입니다.

import {
    Box,
    IconButton,
    List,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    Typography
} from '@mui/material';
import HomeIcon from '@mui/icons-material/Home';
import ExtensionIcon from '@mui/icons-material/Extension';
import InventoryIcon from '@mui/icons-material/Inventory';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import SettingsIcon from '@mui/icons-material/Settings';
import MenuOpenIcon from '@mui/icons-material/MenuOpen';

type Page = 'home' | 'mod' | 'asset' | 'optimizer' | 'settings';

type Props = {
    open: boolean;
    currentPage: Page;
    onToggle: () => void;
    onChangePage: (page: Page) => void;
};

const menus = [
    { page: 'home', label: 'Home', icon: <HomeIcon /> },
    { page: 'mod', label: 'Mod Manager', icon: <ExtensionIcon /> },
    { page: 'asset', label: 'Asset Manager', icon: <InventoryIcon /> },
    { page: 'optimizer', label: 'Optimizer', icon: <AutoFixHighIcon /> },
    { page: 'settings', label: 'Settings', icon: <SettingsIcon /> }
] as const;

export default function Sidebar({ open, currentPage, onToggle, onChangePage }: Props) {
    return (
        <Box
            sx={{
                width: open ? 240 : 72,
                flexShrink: 0,
                height: '100%',
                transition: 'width 160ms ease',
                background: 'var(--sidebar-bg-color)',
                borderRight: '1px solid var(--border-color)',
                color: 'var(--text-color)',
                overflow: 'hidden'
            }}
        >
            <Box sx={{
                display:"flex",
                alignItems:"center",
                justifyContent:open ? 'space-between' : 'center',
                px:1.5,
                py:2
            }}>
                {open && (
                    <Typography sx={{fontWeight:900, fontSize:20}}>
                        HexX Forge
                    </Typography>
                )}

                <IconButton onClick={onToggle} sx={{ color: 'var(--text-color)' }}>
                    <MenuOpenIcon />
                </IconButton>
            </Box>

            <List>
                {menus.map((menu) => {
                    const active = currentPage === menu.page;

                    return (
                        <ListItemButton
                            key={menu.page}
                            onClick={() => onChangePage(menu.page)}
                            sx={{
                                mx: 1,
                                mb: 0.5,
                                borderRadius: 2,
                                color: active ? 'var(--button-text-color)' : 'var(--text-color-light)',
                                background: active ? 'var(--active-bg-color)' : 'transparent',
                                '&:hover': {
                                    background: active ? 'var(--active-bg-color)' : 'var(--hover-bg-color)',
                                    color: 'var(--button-text-color)'
                                }
                            }}
                        >
                            <ListItemIcon
                                sx={{
                                    minWidth: open ? 42 : 0,
                                    color: 'inherit',
                                    justifyContent: 'center'
                                }}
                            >
                                {menu.icon}
                            </ListItemIcon>

                            {open && <ListItemText primary={menu.label} />}
                        </ListItemButton>
                    );
                })}
            </List>
        </Box>
    );
}