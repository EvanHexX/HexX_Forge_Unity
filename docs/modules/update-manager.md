# Update Manager

HexX Forge uses `electron-builder` and `electron-updater` to publish and install updates from the public GitHub Releases feed at `EvanHexX/HexX_Forge_Unity`.

## Runtime flow

- Updates are checked manually from the Settings page.
- The app exposes update actions through the preload bridge only: status, check, download, install, and status events.
- `autoUpdater.autoDownload` is disabled. A release is downloaded only after the user clicks the download button.
- `quitAndInstall()` is called only after the user clicks the restart/install button.
- Development builds do not contact GitHub for updates. They return a packaged-build-only status message instead.
- While update status is `checking` or `downloading`, the renderer shows the shared splash overlay. Download progress is passed into the overlay progress bar when available.

## Release flow

1. For beta builds, set the app version to a prerelease semver such as `1.13.3-beta.1`.
2. Set `GH_TOKEN` to a GitHub token that can create releases and upload assets.
3. Run `npm.cmd run publish` on Windows.
4. Confirm that the GitHub Release is marked as a prerelease for beta builds.
5. Confirm that the GitHub Release includes the installer artifacts and update metadata such as `latest.yml`.

For a local package without upload, run `npm.cmd run dist`.

## Platform notes

- Windows uses the NSIS target and supports the primary auto-update path.
- Windows keeps normal user-level execution. See `docs/modules/build-policy.md` for the `requestedExecutionLevel` decision.
- `package.json` enables ASAR for app code. Runtime resources that must remain executable or readable by external programs stay in `extraResources` under `release/win-unpacked/resources/{config,docs,resources,storage}`.
- `resources/tools/AssetManager`, `resources/tools/ffmpeg`, and `resources/tools/frei0r` must remain outside `app.asar`; external `.exe`/`.dll` files should never depend on ASAR virtual paths.
- If `electron-builder` ASAR integrity injection fails on Windows, treat it as a release blocker and either fix the builder/Electron path or explicitly document a temporary ASAR rollback before publishing.
- macOS builds emit `dmg` and `zip` artifacts. Real macOS auto-update validation requires Developer ID signing and notarization before release testing.
- Public GitHub releases do not require end-user GitHub tokens.

## Test checklist

- `npm.cmd run build` completes successfully.
- `npm.cmd run dist` creates Windows release artifacts and updater metadata.
- `release/win-unpacked/resources/app.asar` exists.
- `release/win-unpacked/resources/resources/tools/AssetManager/AssetManager_UnityPy.exe` exists.
- `release/win-unpacked/resources/resources/tools/ffmpeg/ffmpeg.exe` exists.
- `release/win-unpacked/resources/resources/tools/ffmpeg/ffprobe.exe` exists.
- `release/win-unpacked/resources/resources/tools/frei0r/filter/select0r.dll` exists.
- `release/win-unpacked/resources/resources/tools/frei0r/filter/keyspillm0pup.dll` exists.
- `release/win-unpacked/resources/resources/tools/frei0r/filter/alpha0ps_alpha0ps.dll` exists.
- `release/win-unpacked/resources/resources/tools/frei0r/filter/saturat0r.dll` exists.
- `release/win-unpacked/resources/resources/tools/AssetManager/metadata/ui_textures.tsv` exists.
- Packaged FFmpeg can load frei0r plugins from the packaged resource path. At minimum, run a short `frei0r=select0r` dry-run against `release/win-unpacked/resources/resources/tools/frei0r/filter` before publishing.
- `release/win-unpacked/resources/resources/tools/AssetManager/work` and `reports` are not bundled.
- `app.asar` does not contain `resources/tools`, local `config/app_settings*`, or bundled writable `storage`.
- A lower installed version can check a newer GitHub Release, download it, and restart into the new version.
- Development mode keeps the update UI stable and reports that updates are available only in packaged builds.

## Follow-up integrity policy

- Current release gate: required runtime file existence plus FFmpeg/frei0r dry-run validation.
- Next minor release target: generate a `resources/manifest.json` during release packaging and verify SHA-256 hashes for required runtime files after update installation or on first launch after update.
- If manifest validation fails, the app should keep general UI usable, disable affected tool actions, and show a copyable `NotificationContext` diagnostic instead of failing later during export.
