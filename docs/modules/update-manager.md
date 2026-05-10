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
- The first beta disables ASAR packaging because `electron-builder@26` failed while injecting Windows ASAR integrity metadata in local packaging. Re-enable ASAR after that builder/Electron path is validated.
- macOS builds emit `dmg` and `zip` artifacts. Real macOS auto-update validation requires Developer ID signing and notarization before release testing.
- Public GitHub releases do not require end-user GitHub tokens.

## Test checklist

- `npm.cmd run build` completes successfully.
- `npm.cmd run dist` creates Windows release artifacts and updater metadata.
- `release/win-unpacked/resources/resources/tools/AssetManager/AssetManager_UnityPy.exe` exists.
- `release/win-unpacked/resources/resources/tools/ffmpeg/ffmpeg.exe` exists.
- `release/win-unpacked/resources/resources/tools/AssetManager/work` and `reports` are not bundled.
- A lower installed version can check a newer GitHub Release, download it, and restart into the new version.
- Development mode keeps the update UI stable and reports that updates are available only in packaged builds.
