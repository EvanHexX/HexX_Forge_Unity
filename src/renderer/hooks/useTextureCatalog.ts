// src/renderer/hooks/useTextureCatalog.ts

import {useCallback, useEffect, useState} from 'react';

type AssetCatalogItem = {
    id: string;
    gender: string;
    type: string;
    label: string;
    textureName: string;
    pathId: number;
    category?: string;
    option1?: string;
    option1Label?: string;
    option2?: string;
    displayLabel?: string;
    size?: [number, number];
    previewUrl: string;
};

export function useTextureCatalog() {
    const [data, setData] = useState<AssetCatalogItem[]>([]);
    const [loading, setLoading] = useState(true);

    const reload = useCallback(async () => {
        setLoading(true);
        const res = await window.electronAPI.getAssetCatalog();
        setData(res.items || []);
        setLoading(false);
    }, []);

    useEffect(() => {
        reload().catch(() => setLoading(false));
    }, [reload]);

    return {
        data,
        loading,
        reload
    };
}
