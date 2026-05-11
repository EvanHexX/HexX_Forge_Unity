# Graphics Filters

## Purpose

Graphics Tool video filters are modeled after Shotcut filter definitions so later filter additions can be made through a registry instead of scattered hard-coded UI.

## Registry

Filter definitions live in `config/graphics_presets.json` under `videoFilters.filters`.

Each entry should include:

- `id`: stable app-side filter id.
- `labels`: localized display labels for `en`, `ko`, and `zh-CN`.
- `shotcut.sourcePath`: reference QML folder.
- `shotcut.mltService`: Shotcut/MLT service name.
- `engine`: `frei0r` or `ffmpeg-native`.
- `pluginFile`: required frei0r DLL when applicable.
- `enabled`: whether the filter appears in the UI.
- `defaults`: default UI/export values.

## Current Filters

| App id | English | Korean | Chinese | Shotcut source | Service | Runtime |
| --- | --- | --- | --- | --- | --- | --- |
| `chromaKeyAdvanced` | Chroma Key: Advanced | 크로마 키: 고급 | 色鍵：進階 | `references/shotcut-master/src/qml/filters/select0r` | `frei0r.select0r` | `select0r.dll` |
| `keySpillAdvanced` | Key Spill: Advanced | 키 스필: 고급 | 色键溢色: 高级 | `references/shotcut-master/src/qml/filters/keyspillm0pup` | `frei0r.keyspillm0pup` | `keyspillm0pup.dll` |
| `alphaChannelAdjust` | Alpha Channel: Adjust | 알파 채널: 조정 | 透明通道: 调节 | `references/shotcut-master/src/qml/filters/alpha_adjust` | `frei0r.alpha0ps` | `alpha0ps_alpha0ps.dll` |
| `saturation` | Saturation | 채도 | 饱和度 | `references/shotcut-master/src/qml/filters/saturation` | `frei0r.saturat0r` | `saturat0r.dll` |
| `contrast` | Contrast | 대비 | 對比 | `references/shotcut-master/src/qml/filters/contrast` | `lift_gamma_gain` | FFmpeg approximation |
| `colorGrading` | Color Grading | 색 보정 | 颜色分级 | `references/shotcut-master/src/qml/filters/color` | `lift_gamma_gain` style controls | FFmpeg approximation |

## Parameter Mapping

### Chroma Key: Advanced

Shotcut uses `frei0r.select0r`.

- `0`: key color
- `1`: invert
- `2`: red or hue delta
- `3`: green or chroma delta
- `4`: blue or intensity delta
- `5`: slope
- `6`: color space
- `7`: shape
- `8`: edge
- `9`: operation

### Key Spill: Advanced

Shotcut uses `frei0r.keyspillm0pup`.

- `0`: key color
- `1`: target color
- `2`: mask type
- `3`: tolerance
- `4`: slope
- `5`: hue gate
- `6`: saturation threshold
- `7`: operation 1
- `8`: amount 1
- `9`: operation 2
- `10`: amount 2
- renderer-only controls: show mask, send mask to alpha channel preview.

### Alpha Channel: Adjust

Shotcut uses `frei0r.alpha0ps`.

- `2`: operation
- `3`: threshold
- `4`: amount
- `5`: invert

### Saturation

Shotcut uses `frei0r.saturat0r`. The UI percent is converted through `level / 800` for frei0r param `0`.

### Contrast And Color Grading

Shotcut uses MLT `lift_gamma_gain` or GPU `movit.lift_gamma_gain` for exact lift/gamma/gain behavior. HexX Forge does not bundle MLT in v1, so contrast is approximated with FFmpeg `eq`, and color grading is approximated with per-channel FFmpeg `lutrgb` expressions. Keep this limitation in documentation only; the UI should not show implementation caveats to the user.

## Renderer Preview

Viewport preview is intentionally approximate. Saturation, contrast, and color presets use browser CSS filters where possible. Chroma key, key spill, alpha channel adjustment, and color grading use a renderer canvas pass over the visible preview size so filter changes appear immediately without running FFmpeg on every slider move. Export remains the source of truth and uses the FFmpeg/frei0r filtergraph.

Color Grading keeps the Shotcut `Shadows (Lift)`, `Midtones (Gamma)`, and `Highlights (Gain)` control model. Preview and export share the same per-channel approximation so the three grading groups do not collapse into one averaged brightness/contrast effect.

## Runtime Assets

Required frei0r files are copied to `resources/tools/frei0r`.

- `filter/select0r.dll`
- `filter/keyspillm0pup.dll`
- `filter/alpha0ps_alpha0ps.dll`
- `filter/saturat0r.dll`
- `LICENSE.txt`
- `README.txt`
- `VERSION.txt`

The main process sets `FREI0R_PATH` to `resources/tools/frei0r/filter` when running FFmpeg.

## Validation

Graphics Tool checks:

- bundled FFmpeg exists.
- `ffmpeg -filters` contains `frei0r`.
- required plugin DLL files exist.

If validation fails, frei0r filter rows stay visible but disabled and `NotificationContext` warns the user once instead of showing a persistent alert.

## Release Health Check

Before release, packaged builds must validate that FFmpeg can actually load the bundled frei0r plugins. File existence is not enough because `ffmpeg.exe` can be present and built with `--enable-frei0r` while still failing with `Could not find module 'select0r'` on a tester machine.

Release validation should check:

- `resources/tools/ffmpeg/ffmpeg.exe`
- `resources/tools/ffmpeg/ffprobe.exe`
- `resources/tools/frei0r/filter/select0r.dll`
- `resources/tools/frei0r/filter/keyspillm0pup.dll`
- `resources/tools/frei0r/filter/alpha0ps_alpha0ps.dll`
- `resources/tools/frei0r/filter/saturat0r.dll`
- `ffmpeg -filters` includes `frei0r`
- a short `frei0r=select0r` dry-run succeeds with `FREI0R_PATH` pointing at `resources/tools/frei0r/filter`

If a dry-run fails, Graphics Tool should disable affected frei0r filter rows and show a short `NotificationContext` warning. The full diagnostic payload should include the resolved FFmpeg path, frei0r path, missing files, and dry-run stderr so tester reports are actionable.

## Translation References

Shotcut labels were checked against:

- `references/shotcut-master/translations/shotcut_en.ts`
- `references/shotcut-master/translations/shotcut_ko.ts`
- `references/shotcut-master/translations/shotcut_zh-Hans.ts`

Important Shotcut UI/control translations currently reused:

- `Level` / `레벨`
- `Amount` / `분량`
- `Invert` / `반전`
- `Hue gate` / `색조 제어`
- `Saturation threshold` / `채도 문턱값`

## Adding A Filter

1. Add a registry entry in `config/graphics_presets.json`.
2. Add default UI state in `GraphicsTool.tsx`.
3. Add renderer controls under the filter row.
4. Add preview approximation if the filter needs visible realtime feedback.
5. Add FFmpeg/frei0r mapping in `graphicsService.ts`.
6. Add `en`, `ko`, and `zh-CN` visible text keys before completing the change.
7. Document Shotcut source path, service name, plugin file, and parameters here.
