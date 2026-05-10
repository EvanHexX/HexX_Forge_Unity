import { useEffect, useState } from 'react';

type AppSettings = {
    theme: string;
    typography: string;
    language: string;
    selectedGameId: string;
    gamePaths: Record<string, string>;
    gamePath: string;
};

export function useSettings() {
    const [settings, setSettings] = useState<AppSettings>({
        theme: 'default',
        typography: 'default',
        language: 'en',
        selectedGameId: 'long-yin-li-zhi-zhuan',
        gamePaths: {},
        gamePath: ''
    });

    useEffect(() => {
        window.electronAPI.getSettings().then(setSettings);
    }, []);

    const setGamePath = async (path: string) => {
        const updated = await window.electronAPI.setGamePath(path);
        setSettings(updated);
    };

    return {
        settings,
        setGamePath
    };
}
