# TODO

## Settings

- 추가 지원 게임이 생기면 `selectedGameId`와 `gamePaths` 기반으로 게임별 install hint, 검증 규칙 추가
- `config/typography.json` 폰트 옵션을 실제 폰트 세트와 연결

## Updates

- GitHub Releases 뉴스 피드의 캐시 정책과 오프라인 표시 개선

## Mod Manager

- 온라인 모드 catalog ZIP의 signature/hash 검증 정책 강화
- GitHub catalog 캐시와 오프라인 fallback 개선
- 모드 패킹 Step 3 `settings.configurator.json` 고급 직접 편집 모드 재검토
- 모드 패킹 설명서 팝업 plain markdown 표시를 rich markdown renderer로 고도화 검토
- 파일관리 `linkedConfigPath`/`linkedConfigArrayPath` metadata를 실제 설정 적용 시 JSON 파일 추가/삭제와 연동
- 온라인 모드 update 시 package 상태 보존 범위 확대

## Asset Manager

- UI 타이틀 / UI 메인배경 실제 적용 전 `scripts/verify-release.mjs`의 `ui_textures.tsv` release packaging 검증이 통과하는지 확인한다.
- 온라인 어셋팩 catalog는 `asset-packs/index.json`을 사용한다. GitHub raw 반영 전에는 앱 온라인 탭에서 빈 목록 또는 404가 보일 수 있으므로 배포 파일 커밋/push 후 확인한다.
- Catalog Editor는 v2 최소 편집 기능만 제공한다. pack.json 생성/수정 wizard와 metadata 자동 동기화는 후속 작업으로 검토한다.
- 어셋팩 배포 도구는 PNG별 target 입력으로 pack.json/ZIP을 생성한다. 추후 대상 metadata를 UnityPy TSV에서 자동 제안하는 기능을 검토한다.
- UI가 아닌 신규 asset patch API를 추가할 때는 `ui_textures.tsv`에 섞지 말고 별도 UnityPy metadata 파일, plan kind, Electron routing, 문서 표를 함께 추가한다.
- 어셋팩 기능 릴리즈 시 minor version bump를 적용한다.

## I18n Migration

- [x] Base renderer i18n module (`src/renderer/i18n`)
- [x] Settings language selector
- [x] Home
- [ ] Sidebar
- [x] Settings remaining page strings
- [ ] Mod Manager
  - 2026-05-10: 온라인/로컬 모드 추가와 패킹 단계 UI는 기존 `ModManager.tsx` 직접 문자열 구조를 유지했다. Mod Manager 전체 i18n migration 때 새 visible text까지 함께 `src/renderer/i18n`으로 이동한다.
- [ ] Asset Manager
- [ ] Graphics Tool
- [ ] Cheat Engine
- [ ] Optimizer
- [ ] Splash Screen
- [ ] Notification messages
- `src/renderer/pages/GraphicsTool.tsx` still contains visible strings directly in the component. The current filter work follows the existing page style and Shotcut reference labels, but a later pass should move Graphics Tool visible text into `src/renderer/i18n` for `en`, `ko`, and `zh-CN`.

When all existing renderer surfaces are checked, replace this migration checklist with a short rule to use i18n only for new or changed pages.

## Graphics Filter Parity

- Contrast is currently approximated with FFmpeg `eq`/gamma because Shotcut uses MLT `lift_gamma_gain`, and MLT is not bundled.
- Exact Chroma Key/Key Spill/Alpha/Saturation parity depends on the bundled FFmpeg build supporting `frei0r` and loading the copied frei0r DLLs.

## Release Runtime Resource Check

- Before the next Graphics Tool release, add a startup or Graphics Tool entry health check for required runtime files:
  - `resources/tools/ffmpeg/ffmpeg.exe`
  - `resources/tools/ffmpeg/ffprobe.exe`
  - `resources/tools/frei0r/filter/select0r.dll`
  - `resources/tools/frei0r/filter/keyspillm0pup.dll`
  - `resources/tools/frei0r/filter/alpha0ps_alpha0ps.dll`
  - `resources/tools/frei0r/filter/saturat0r.dll`
- The check must include real FFmpeg validation, not only file existence:
  - `ffmpeg -filters` contains `frei0r`.
  - A short `frei0r=select0r` dry-run can load the plugin from the packaged resource path.
- If the health check fails, disable the affected Graphics Tool frei0r filters and show a `NotificationContext` warning with a short message.
- The warning should carry copyable diagnostic text containing `ffmpegPath`, `frei0rPath`, missing files, failed dry-run output, and whether `FREI0R_PATH` / `PATH` include the plugin directory.
- For a later minor version, add `resources/manifest.json` with SHA-256 entries for required runtime files and verify the manifest after update installation or first launch after update.

## NotificationContext

- Graphics Tool FFmpeg errors should show a short summary notification instead of dumping the full stderr text into the toast.
- Keep the full FFmpeg log as copy payload on the notification; clicking the notification copies the original log to the clipboard.
- Error notifications that carry copyable logs should auto-dismiss after 10 seconds.
- Persistent log-file storage is deferred; v1 separates user-visible summaries from the original log payload only.
## 2026-05-10 Mod Manager follow-up

- 파일관리 `linkedConfigValueKey` metadata를 실제 파일 추가/삭제 apply 단계에서 linked JSON 갱신에 연결한다.
## 2026-05-10 Mod Manager dependency follow-up

- Package dependency version constraint, optional dependency, cascade disable/delete 정책, dependency graph cycle UI를 검토한다.
