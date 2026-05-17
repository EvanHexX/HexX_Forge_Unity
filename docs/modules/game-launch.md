# Game Launch

## Purpose

Home 화면에서 현재 선택된 지원 게임을 바로 실행하는 기능이다. 사용자가 Settings에서 지정한 `gamePath`와 게임별 executable metadata를 조합해 실제 실행 파일을 찾는다.

## Related Files

- `src/renderer/pages/Home.tsx`
- `src/main/services/configService.ts`
- `src/main/ipc/configIpc.ts`
- `src/preload/preload.ts`
- `src/renderer/i18n`

## Public APIs

- Renderer API: `window.electronAPI.launchGame()`
- IPC channel: `game:launch`
- Return shape: `{ ok: boolean; message?: string }`

## Internal Flow

1. Home의 `게임 실행` 버튼이 `window.electronAPI.launchGame()`을 호출한다.
2. preload가 `game:launch` IPC로 main process에 요청한다.
3. main process는 `getAppSettings()`로 현재 `selectedGameId`와 `gamePath`를 읽는다.
4. `SupportedGame.executableName`을 `gamePath`와 결합해 실행 파일 경로를 만든다.
5. 파일이 존재하면 `spawn`을 `detached` 모드로 실행하고 즉시 `{ ok: true }`를 반환한다.

## State/Data Flow

- 실행 대상은 renderer가 직접 넘기지 않는다.
- main process가 현재 저장된 settings와 지원 게임 metadata를 기준으로 실행 대상을 결정한다.
- 현재 기본 executable은 `LongYinLiZhiZhuan.exe`이다.

## Important Constraints

- renderer에서 임의 executable path를 전달하지 않는다. 실행 파일명은 `SupportedGame` metadata에만 둔다.
- `gamePath`가 없거나 executable이 없으면 실행하지 않고 실패 결과를 반환한다.
- 백업 상태는 게임 실행 가능 여부를 막지 않는다. 백업은 patch 작업 안전성 기준이고, 게임 실행은 설치 경로와 executable 존재 여부만 확인한다.
- 실행 실패/성공 안내는 Home에서 `NotificationContext`와 i18n 문자열을 사용한다.

## Known Problems

- 현재는 게임별 executable 후보가 1개뿐이다. Steam shortcut, launcher exe, platform URI 실행은 아직 지원하지 않는다.
- 실행 후 process 종료 상태를 추적하지 않는다. 버튼은 launch 요청 완료까지만 loading 상태를 유지한다.

## Regression Notes

- `gamePath`가 없을 때 버튼은 disabled 상태여야 하며 Settings 이동 안내는 유지한다.
- executable이 없는 경로에서는 `{ ok: false }`와 message를 반환해야 한다.
- Home UI 변경 시 MUI `Stack` layout prop은 직접 prop으로 전달하지 말고 `sx`에 넣는다.

## Rejected Approaches

- 설치 폴더 안의 `.exe` 자동 검색은 잘못된 launcher/helper 실행 파일을 고를 수 있어 사용하지 않는다.
- renderer에서 executable path를 직접 넘기는 방식은 IPC boundary의 실행 범위가 넓어져 사용하지 않는다.

## TODO

- 지원 게임이 늘어나면 `SupportedGame.executableName`을 게임별로 추가한다.
- launcher 기반 게임이 필요해지면 executable metadata와 별도로 `launchMode` 설계를 추가한다.
