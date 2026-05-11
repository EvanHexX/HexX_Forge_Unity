import { useEffect, useState } from 'react';
import { Box, List, ListItem, ListItemText, Stack, Typography } from '@mui/material';
import SplashScreen from '../components/SplashScreen';
import { getSafeLanguage, t, type I18nKey, type LanguageCode } from '../i18n';

const featureKeys: I18nKey[] = [
    'placeholder.coreLab.feature.memory',
    'placeholder.coreLab.feature.saveData',
    'placeholder.coreLab.feature.process',
    'placeholder.coreLab.feature.tables',
    'placeholder.coreLab.feature.customSkill'
];

export default function CheatEngine() {
    const [previewOpen, setPreviewOpen] = useState(true);
    const [currentLanguage, setCurrentLanguage] = useState<LanguageCode>('en');

    useEffect(() => {
        window.electronAPI.getSettings().then((settings) => {
            setCurrentLanguage(getSafeLanguage(settings.language));
        });
    }, []);

    return (
        <Box sx={{ color: 'var(--text-color)', maxWidth: 820 }}>
            <Stack spacing={1}>
                <Typography variant="h5" sx={{ fontWeight: 800, color: 'var(--text-color)' }}>
                    {t('placeholder.coreLab.title', currentLanguage)}
                </Typography>
                <Typography sx={{ color: 'var(--text-color-light)' }}>
                    {t('placeholder.coreLab.subtitle', currentLanguage)}
                </Typography>
            </Stack>

            <Box sx={sectionSx}>
                <Typography sx={{ color: 'var(--text-color-light)', fontSize: 14 }}>
                    {t('placeholder.coreLab.body', currentLanguage)}
                </Typography>
                <List dense sx={{ mt: 1.5, p: 0 }}>
                    {featureKeys.map((key) => (
                        <ListItem key={key} sx={listItemSx}>
                            <ListItemText
                                primary={t(key, currentLanguage)}
                                primaryTypographyProps={{
                                    sx: { color: 'var(--text-color)', fontWeight: 700, fontSize: 14 }
                                }}
                            />
                        </ListItem>
                    ))}
                </List>
            </Box>

            <SplashScreen
                open={previewOpen}
                mode="preview"
                message={t('placeholder.coreLab.splash', currentLanguage)}
                onClose={() => setPreviewOpen(false)}
            />
        </Box>
    );
}

const sectionSx = {
    mt: 4,
    p: 2.5,
    border: '1px solid var(--border-color)',
    borderRadius: 2,
    background: 'color-mix(in srgb, var(--sidebar-bg-color) 70%, transparent)'
};

const listItemSx = {
    px: 0,
    py: 0.75,
    borderBottom: '1px solid color-mix(in srgb, var(--border-color) 62%, transparent)',
    '&:last-of-type': {
        borderBottom: 'none'
    }
};
