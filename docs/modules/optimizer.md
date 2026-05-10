# Optimizer Launcher

## Purpose

Launch and manage the existing PySide6-based optimizer tool from HexX Forge.

## Current status

- Optimizer execution is not implemented yet.
- The page includes a temporary **Splash Preview** button for testing the shared app splash overlay.
- The splash preview is intentionally temporary and should be removed or moved once the Optimizer launcher UI is implemented.

## Splash preview

- Uses the shared renderer `SplashScreen` component.
- Verifies the startup/update visual language without requiring a packaged update flow.
- The preview uses the bundled `src/renderer/assets/splash/Logo_without_title.png` asset.

## Planned settings

```json
{
  "optimizerPath": "..."
}
```

## TODO

- Implement optimizer executable path configuration.
- Launch the optimizer executable from Electron.
- Replace the temporary splash preview area with real optimizer controls when the launcher is ready.
