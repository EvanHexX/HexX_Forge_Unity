# Project Map

## 주요 모듈

- Mod Manager → `src/renderer/pages/ModManager.tsx`, `src/main/services/modService.ts`, `src/main/services/modCatalogService.ts`, `src/main/ipc/modIpc.ts`, `src/preload/preload.ts`
- Mod Packing Guide → `docs/modules/mod-packing-guide.md`
- Online Mod Catalog → `mods/index.json`, `mods/packages/{modId}/{version}/{modId}.zip`
- Renderer shared mod types → `src/renderer/types/modTypes.ts`
- Home → `src/renderer/pages/Home.tsx`, `src/renderer/i18n`, `docs/manuals/*.md`
- Home User Manuals → `docs/manuals/mod-forge.md`, `docs/manuals/asset-forge.md`, `docs/manuals/visual-forge.md`, `docs/manuals/core-lab.md`, `docs/manuals/synthesis-lab.md`, `docs/manuals/settings.md`
- Settings → `src/renderer/pages/Settings.tsx`, `src/renderer/i18n`, `src/main/services/configService.ts`, `src/main/ipc/configIpc.ts`
- Game Launch → `src/main/services/configService.ts`, `src/main/ipc/configIpc.ts`, `src/preload/preload.ts`, `docs/modules/game-launch.md`
- Asset Manager → `src/renderer/pages/AssetManager.tsx`, `src/main/services/assetService.ts`, `src/main/services/assetPackService.ts`, `src/main/services/assetPatcherService.ts`, `src/main/ipc/assetIpc.ts`, `src/main/ipc/assetPackIpc.ts`, `src/main/ipc/assetPatcherIpc.ts`, `src/preload/preload.ts`, `asset-catalog/index.json`, `asset-packs/index.json`, `docs/modules/asset-manager.md`
- Developer Gate → `src/renderer/components/DeveloperGateDialog.tsx`, `src/renderer/hooks/useDeveloperShortcut.ts`, `src/main/services/developerAccessService.ts`, `src/main/ipc/developerAccessIpc.ts`
