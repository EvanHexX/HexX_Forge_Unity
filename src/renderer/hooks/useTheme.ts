// src/renderer/hooks/useTheme.ts
// 설정 파일의 theme 값을 읽고 CSS 변수로 적용하는 hook입니다.

import { useCallback, useEffect, useMemo, useState } from 'react';

type ThemeVariables = Record<string, string>;
type ThemeMap = Record<string, ThemeVariables>;

type AppSettings = {
    theme: string;
};

export function useTheme() {
    const [settings, setSettings] = useState<AppSettings>({ theme: 'default' });
    const [themes, setThemes] = useState<ThemeMap>({});

    const themeNames = useMemo(() => Object.keys(themes), [themes]);

    const applyThemeVariables = useCallback((themeName: string, themeMap: ThemeMap) => {
        const selectedTheme = themeMap[themeName] ?? themeMap.default;

        if (!selectedTheme) {
            return;
        }

        Object.entries(selectedTheme).forEach(([key, value]) => {
            document.documentElement.style.setProperty(key, value);
        });
    }, []);

    const changeTheme = useCallback(
        async (themeName: string) => {
            const nextSettings = await window.electronAPI.setTheme(themeName);
            setSettings(nextSettings);
            applyThemeVariables(themeName, themes);
        },
        [applyThemeVariables, themes]
    );

    useEffect(() => {
        async function initTheme() {
            const [loadedSettings, loadedThemes] = await Promise.all([
                window.electronAPI.getSettings(),
                window.electronAPI.getThemes()
            ]);

            setSettings(loadedSettings);
            setThemes(loadedThemes);
            applyThemeVariables(loadedSettings.theme, loadedThemes);
        }

        initTheme().catch(console.error);
    }, [applyThemeVariables]);

    return {
        currentTheme: settings.theme,
        themeNames,
        changeTheme
    };
}