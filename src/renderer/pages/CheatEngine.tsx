// src/renderer/pages/CheatEngine.tsx
// Cheat Engine integration placeholder.

import { Box, Paper, Stack, Typography } from '@mui/material';

export default function CheatEngine() {
    return (
        <Box>
            <Typography variant="h5" sx={{ fontWeight: 800, color: 'var(--text-color)' }}>
                Cheat Engine
            </Typography>
            <Typography sx={{ mt: 0.5, color: 'var(--text-color-light)' }}>
                Cheat Engine workflows will be connected here.
            </Typography>

            <Paper
                sx={{
                    mt: 3,
                    p: 2,
                    background: 'var(--sidebar-bg-color)',
                    color: 'var(--text-color)',
                    border: '1px solid var(--border-color)',
                    boxShadow: 'var(--shadow-small)',
                }}
            >
                <Stack spacing={1}>
                    <Typography sx={{ fontWeight: 700 }}>Not implemented</Typography>
                    <Typography sx={{ color: 'var(--text-color-light)', fontSize: 14 }}>
                        TODO: attach table management, process selection, and project-specific cheat helpers.
                    </Typography>
                </Stack>
            </Paper>
        </Box>
    );
}
