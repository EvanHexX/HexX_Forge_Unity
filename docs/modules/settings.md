# Settings

## Purpose

Settings 화면은 지원 게임 선택, 게임 설치 폴더, Theme, Typography, Language, 앱 업데이트 동작을 한 곳에서 관리한다.

## Related Files

- `src/renderer/pages/Settings.tsx`
- `src/renderer/i18n`
- `src/main/services/configService.ts`
- `src/main/ipc/configIpc.ts`
- `src/preload/preload.ts`

## Public APIs

- `window.electronAPI.getSettings()`
- `window.electronAPI.setSelectedGame(gameId)`
- `window.electronAPI.setGamePath(gamePath, gameId?)`
- `window.electronAPI.setLanguage(language)`
- `window.electronAPI.checkForUpdates()`
- `window.electronAPI.downloadUpdate()`
- `window.electronAPI.installUpdate()`
- `window.electronAPI.getRuntimeIntegrityStatus()`
- `window.electronAPI.checkRuntimeIntegrity()`

## Internal Flow

1. Settings 진입 시 settings, supported games, app version, update status를 preload API로 읽는다.
2. 지원 게임을 바꾸면 `setSelectedGame`을 호출하고, 해당 게임의 저장된 `gamePath`를 화면 상태에 반영한다.
3. 설치 폴더 선택은 Electron native dialog 결과를 local state에 넣고, 저장 버튼이 `setGamePath`를 호출한다.
4. 언어 선택은 `setLanguage`로 저장하고, 화면의 visible text는 `src/renderer/i18n`의 `t()`를 통해 즉시 갱신한다.
5. 업데이트 버튼은 update service IPC를 호출하고 반환된 status를 화면에 반영한다.
6. 런타임 파일 점검은 마지막 저장 결과를 먼저 표시하고, `다시 검사` 버튼으로 현재 파일 존재와 FFmpeg/frei0r 실행 검증을 갱신한다.

## State/Data Flow

- `settings.language`가 Settings 화면의 i18n 기준이다.
- 지원 게임 표시명과 install hint는 Settings 화면에서 언어별 key로 매핑한다.
- Theme/Typography option displayName은 설정 파일에서 읽는 표시 데이터이므로 renderer i18n으로 강제 변환하지 않는다.

## Important Constraints

- MUI `Stack`의 `alignItems`, `justifyContent`, `flexWrap`는 direct prop으로 넘기지 않고 `sx`에 둔다.
- update service에서 내려오는 `error`와 `message`는 service-origin message이므로 그대로 보여준다. Settings 자체 fallback 문구만 i18n으로 관리한다.
- 새 지원 게임을 추가하면 Settings/Home 양쪽의 game display key와 install hint key도 함께 검토한다.
- FFmpeg/frei0r 바이너리는 Git에 저장하지 않으므로, 누락 상태에서는 `resources/tools/*/README.md` 안내를 표시한다.

## Known Problems

- Electron native folder dialog title은 현재 renderer language와 완전히 동기화되지 않는다.
- Theme/Typography displayName은 config data에 의존하므로 언어 전환 시 자동 번역되지 않는다.

## Regression Notes

- 언어 변경 직후 Settings 화면의 section label, button, game name, install hint, update fallback message가 바뀌어야 한다.
- `gamePath`가 비어 있으면 localized missing path warning이 표시되어야 한다.
- update status가 `idle`이면 localized manual check 안내가 보여야 한다.

## Rejected Approaches

- `SupportedGame.displayName` 자체를 언어별 object로 바꾸는 방식은 main/preload 타입 영향 범위가 커서 이번 migration에서는 사용하지 않았다.
- config data의 Theme/Typography 이름을 i18n key로 바꾸는 방식은 사용자 설정 파일과 호환성이 떨어져 보류했다.

## TODO

- Electron native dialog title도 settings language를 반영하도록 main IPC에서 language 기반 title을 선택한다.
- 지원 게임이 늘어나면 game metadata와 renderer i18n key를 함께 관리하는 registry 구조를 검토한다.
