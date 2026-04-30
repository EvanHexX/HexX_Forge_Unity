import { useEffect, useState } from 'react';

type AppSettings = {
    theme: string;
    gamePath: string;
};

export function useSettings() {
    const [settings, setSettings] = useState<AppSettings>({
        theme: 'default',
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