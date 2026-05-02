// src/renderer/hooks/useTextureCatalog.ts

import {useEffect, useState} from 'react';

type AssetCatalogItem = {
    id: string;
    gender: string;
    type: string;
    label: string;
    textureName: string;
    pathId: number;
    previewUrl: string;
};

export function useTextureCatalog() {
    const [data, setData] = useState<AssetCatalogItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        window.electronAPI.getAssetCatalog().then((res) => {
            setData(res.items || []);
            setLoading(false);
        });
    }, []);

    return {
        data,
        loading
    };
}