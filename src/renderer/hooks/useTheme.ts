// src/renderer/hooks/useTheme.ts
// 설정 파일의 theme 값을 읽고 CSS 변수로 적용하는 hook입니다.

import { useCallback, useEffect, useMemo, useState } from 'react';

type ThemeVariables = Record<string, string>;

type ThemeDefinition = {
    displayName: string;
    variables: ThemeVariables;
};

type ThemeEntry = ThemeDefinition | ThemeVariables;
type ThemeMap = Record<string, ThemeEntry>;

export type ThemeOption = {
    key: string;
    displayName: string;
};

export type TypographyOption = {
    key: string;
    displayName: string;
    fontFamily: string;
};

type AppSettings = {
    theme: string;
    typography: string;
};

const DEFAULT_TYPOGRAPHY: TypographyOption = {
    key: 'default',
    displayName: 'Default',
    fontFamily: 'Pretendard, "Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, sans-serif'
};

function isThemeDefinition(theme: ThemeEntry): theme is ThemeDefinition {
    return 'variables' in theme;
}

function getThemeVariables(theme: ThemeEntry): ThemeVariables {
    return isThemeDefinition(theme) ? theme.variables : theme;
}

function getThemeDisplayName(key: string, theme: ThemeEntry): string {
    if (isThemeDefinition(theme)) return theme.displayName;

    const fallbackNames: Record<string, string> = {
        default: 'Eclipse Green',
        dark: 'Dark Forge',
        light: 'Apple Light'
    };

    return fallbackNames[key] || key
        .split('-')
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
}

export function useTheme() {
    const [settings, setSettings] = useState<AppSettings>({ theme: 'default', typography: 'default' });
    const [themes, setThemes] = useState<ThemeMap>({});
    const [typographies, setTypographies] = useState<TypographyOption[]>([DEFAULT_TYPOGRAPHY]);

    const themeOptions = useMemo(
        () => Object.entries(themes).map(([key, theme]) => ({
            key,
            displayName: getThemeDisplayName(key, theme)
        })),
        [themes]
    );

    const typographyOptions = useMemo<TypographyOption[]>(() => {
        return typographies.length > 0 ? typographies : [DEFAULT_TYPOGRAPHY];
    }, [typographies]);

    const applyThemeVariables = useCallback((
        themeName: string,
        typographyName: string,
        themeMap: ThemeMap,
        typographyList: TypographyOption[]
    ) => {
        const selectedTheme = themeMap[themeName] ?? themeMap.default;
        const selectedTypography =
            typographyList.find((item) => item.key === typographyName) || DEFAULT_TYPOGRAPHY;

        if (!selectedTheme) {
            return;
        }

        Object.entries(getThemeVariables(selectedTheme)).forEach(([key, value]) => {
            document.documentElement.style.setProperty(key, value);
        });

        document.documentElement.style.setProperty('--font-family', selectedTypography.fontFamily);
    }, []);

    const changeTheme = useCallback(
        async (themeName: string) => {
            const nextSettings = await window.electronAPI.setTheme(themeName);
            setSettings(nextSettings);
            applyThemeVariables(themeName, nextSettings.typography || 'default', themes, typographyOptions);
        },
        [applyThemeVariables, themes, typographyOptions]
    );

    const changeTypography = useCallback(
        async (typography: string) => {
            const nextSettings = await window.electronAPI.setTypography(typography);
            setSettings(nextSettings);
            applyThemeVariables(nextSettings.theme || 'default', typography, themes, typographyOptions);
        },
        [applyThemeVariables, themes, typographyOptions]
    );

    useEffect(() => {
        async function initTheme() {
            const [loadedSettings, loadedThemes, loadedTypographies] = await Promise.all([
                window.electronAPI.getSettings(),
                window.electronAPI.getThemes(),
                window.electronAPI.getTypographyOptions()
            ]);
            const nextTypographies = loadedTypographies.length > 0 ? loadedTypographies : [DEFAULT_TYPOGRAPHY];

            setSettings(loadedSettings);
            setThemes(loadedThemes);
            setTypographies(nextTypographies);
            applyThemeVariables(loadedSettings.theme, loadedSettings.typography || 'default', loadedThemes, nextTypographies);
        }

        initTheme().catch(console.error);
    }, [applyThemeVariables]);

    return {
        currentTheme: settings.theme,
        currentTypography: settings.typography || 'default',
        themeOptions,
        typographyOptions,
        changeTheme,
        changeTypography
    };
}
