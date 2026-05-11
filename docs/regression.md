# Regression Notes

## 2026-05-11 Graphics Tool seek-then-play commit

- 증상: timeline seek 후 UI bar는 선택 위치를 가리키지만 Play를 누르면 preview video가 0초부터 재생될 수 있다.
- 원인: `video.currentTime = target` 직후 seek operation이 아직 commit되기 전에 `play()`가 호출되면 Chromium/Electron이 이전 playback position에서 재생을 시작할 수 있다.
- 예방: `VideoPreviewController.seek(seconds)`는 `Promise<void>`를 반환하고, `seeked` 이벤트 또는 짧은 timeout fallback 이후 resolve한다. `play()`는 마지막 commanded time이 남아 있으면 먼저 `await seek(lastCommandedTime)`을 수행한 뒤 `video.play()`를 호출한다.
- 추가 원인: `hexx-resource://selected-media`가 HTTP Range 요청을 지원하지 않으면 Chromium media pipeline이 seekable range를 만들지 못해 `currentTime` 변경 후 0초로 돌아갈 수 있다.
- 예방: custom protocol media response는 `Accept-Ranges: bytes`를 제공하고, `Range: bytes=start-end` 요청에는 `206 Partial Content`, `Content-Range`, `Content-Length`를 반환해야 한다.
- Stop만 0초 reset을 수행한다. Pause/Play/Seek 경로에서 stop/reset state를 공유하지 않는다.

## 2026-05-11 Graphics Tool preview follow-up

- Draw loop refactor 후 오래된 `frameId` 참조가 남으면 파일 로드 시 `ReferenceError: frameId is not defined`가 발생한다. missing canvas/source 또는 media dimension 준비 전에는 현재 `scheduleDraw()` 경로만 사용한다.
- paused seek 후 Play가 0초부터 시작하면 controller가 마지막 seek 목표 시간을 잃은 것이다. controller 내부에 마지막 commanded time을 저장하고 `play()` 직전에 필요 시 `video.currentTime`에 재적용한다.

## 2026-05-11 Graphics Tool video preview control regression

- Symptoms: timeline seek returned to 0 seconds, Play/Pause/Stop became unstable, preview stuttered, console showed `Maximum update depth exceeded`, `play() request was interrupted by pause()`, and `media was removed from the document`.
- Cause: video control was split across parent direct `HTMLVideoElement` refs, `playing` effects, `seekRequest`/`stopRequest` effects, and native event publishers. `onPlaybackState` identity changes also caused event listener re-registration and immediate state publishing loops.
- Prevention: `CanvasFilteredMedia` is the only owner of the preview video element. Parent components use `VideoPreviewController` only. Do not reintroduce `playing`, `seekRequest`, or `stopRequest` props for media commands.
- Event listener effects must not depend on unstable parent callbacks. Store callbacks in refs and publish only meaningful playback state changes.
- `AbortError` from `video.play()` is expected during interrupted playback and should be swallowed or dev-only logged.

## Renderer console warnings

- 2026-05-10: `src/renderer/App.tsx`의 `PageFallback`에서 MUI `Stack`에 `alignItems`/`justifyContent`를 직접 전달해 React unknown DOM prop warning이 발생했다.
  - 원인: 현재 MUI Grid/Stack 조합에서 layout props가 styled root DOM element까지 전달될 수 있다.
  - 예방: renderer fallback/loading UI를 포함한 모든 MUI layout component에서는 layout styling을 `sx`에 넣는다.
  - 확인 명령: `rg -n "\b(alignItems|justifyContent|flexWrap)=" src\renderer`
- Do not pass layout props such as `alignItems`, `justifyContent`, or `flexWrap` directly to MUI `Stack`.
  - Put them inside `sx`, for example: `<Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>`.
  - Before finishing renderer UI patches, run:
    - `rg -n "\b(alignItems|justifyContent|flexWrap)=" src\renderer`
- Do not render interactive controls inside another interactive control.
  - `CardActionArea` renders as a button by default, so do not place MUI `Button` inside it.
  - For expandable cards, keep `CardActionArea` around the summary/header only, then render expanded actions and detail panels outside it.
- Smoke test after Home/card changes:
  - Start or refresh the app.
  - Open DevTools console.
  - Click Home document cards and detail buttons.
  - Confirm there are no React warnings for unknown DOM props or nested `<button>` elements.

## Mod Manager path regressions

- 패킹된 DLL 경로는 `plugins/*.dll`이 표준이며, 활성화 대상 base는 `{gamePath}/BepInEx`이다.
  - `plugins/MyMod.dll`을 `{gamePath}/BepInEx/plugins/MyMod.dll`로 이동해야 한다.
  - `{gamePath}/BepInEx/plugins/plugins/MyMod.dll`이 생기면 경로 base가 잘못된 것이다.
- `asset`/`config` 배포도 `BepInEx` 기준 상대 경로를 사용한다.
- `folder` 타입 삭제 시 `plugins`, `config`, `patchers` 같은 공용 최상위 폴더 자체는 삭제하지 않는다.
- `mod-info.json`의 folder path는 trailing slash 유무를 무시하고 비교한다.
  - `plugins/MyMod`와 `plugins/MyMod/`는 같은 folder로 본다.
  - folder 타입은 실제 ZIP directory entry가 없어도 “mod-info에 선언됐으나 ZIP에 없음” 경고를 내지 않는다.
- 자동 parent folder 합성 시 최상위 `plugins/` 자체는 목록에 추가하지 않는다.
## 2026-05-10 Mod Manager script builder regressions

- ZIP root 기준 변환 후 renderer 표시 경로에 `plugins/`가 붙어도, ZIP 내부 text read는 원본 entry path 또는 `plugins/` 제거 fallback으로 찾아야 한다.
- `CFG 필드` 생성 JSON preview는 해당 feature card 내부에 있어야 하며, 전역 하단 preview로 되돌리면 접힘/펼침 UX가 깨진다.
- CFG 파일 읽기 시 `config/config.cfg` 기본값을 유지하지 말고, 선택한 파일명 기준 `config/{fileName}`으로 갱신해야 한다.
- ResourceInjector portrait JSON처럼 top-level `files` object map을 쓰는 linked JSON은 배열이 아니어도 대상 후보로 인식해야 한다.
- 파일관리 linked JSON 필터는 자동으로 `type=png`를 강제하지 않는다. 필터가 없는 단일 확장자 모드도 지원해야 하며, 사용자가 필요할 때 직접 filter key/value를 선택한다.
- `plugins/ResourceInjector/config/*.json` linked config와 `plugins/ResourceInjector/portraits/png` targetDir 조합에서는 JSON key가 `portraits/png/{fileName}`이어야 한다. `plugins/ResourceInjector` prefix를 JSON key에 중복 저장하지 않는다.
- 파일관리 삭제는 managed file만 지우는 것이 아니라 linked JSON의 해당 object map entry도 함께 지워야 한다.
- 일반 `.json` 파일을 `mod-info`로 오탐하지 않는다. `mod-info.json` / `hexx-mod-info.json`만 manifest로 취급하고 그 외 JSON은 `config`가 기본이다.
- mod-info 없는 ZIP에서 표시되는 synthetic `mod-info.json`은 패킹용 preview 항목이며 원본 ZIP entry처럼 복사하면 안 된다.
- linked JSON entry key는 `linkedConfigKeyTemplate`의 `$` placeholder 치환 결과를 우선 사용한다.
- linked JSON 대상 path는 UI에서 `/` 구분자를 쓴다. `root`, `files`, `files/pngs`가 표준 표기이며, legacy `.` path도 호환해야 한다.
- 파일관리 linked JSON 내용 editor는 큰 JSON으로 Step 3 UI를 밀어내지 않도록 접힘/펼침 상태를 유지한다.
- JSON key 생성 규칙을 입력한 뒤에도 선택 target path의 하위 metadata field 목록이 보여야 한다. candidate 매칭 실패 시 현재 JSON object map에서 preview 후보를 재구성한다.
- 연동 JSON path 입력 중 빈 값이 즉시 `root`로 되돌아가면 편집이 잠긴 것처럼 보일 수 있다. 빈 값은 UI에 그대로 두고 preview/apply에서만 root로 해석한다.
- PackModDialog에서 Electron native dialog 또는 MUI Select 사용 후 TextField 입력이 간헐적으로 잠기면 Dialog focus trap/restore와 activeElement focus 상태를 먼저 확인한다.
- 파일관리 field preview는 별도 “등록한 어셋 파일 선택” control에 의존하지 않는다. Step 2 asset 목록 또는 `test.{extension}` fallback으로 preview 파일명을 계산해야 한다.
- linked JSON 앞에 UTF-8 BOM(`\uFEFF`) 또는 zero-width/invisible 문자가 있으면 `JSON.parse`가 실패해 “JSON 내용 없음 또는 파싱 실패”로 표시될 수 있다. renderer/main parse 경계에서 선두 invisible character를 제거한다.
- 모드 설정 화면에서 linked JSON을 설정 파일보기로 연 상태에서 file_manager 삭제를 저장하면, 오래된 `configText`가 삭제 결과를 덮어쓰면 안 된다. 직접 편집 text는 먼저 저장하고 file_manager add/delete가 나중에 최종 상태를 반영해야 한다.
- file_manager 삭제 버튼은 같은 파일에 대해 여러 번 누를 수 없어야 한다. 이미 `pendingDeletes`에 있거나 저장 중이면 버튼을 disabled 처리한다.
## 2026-05-10 Mod Manager package dependency regressions

- DLL이 없는 asset-only package는 `scanMods()`가 DLL 목록만 기준으로 package row를 만들면 목록에서 사라진다.
  - `dllPaths: []` package는 package-level `enabled` flag를 기준으로 표시/활성 상태를 유지해야 한다.
- Package dependency는 `files[].dependsOn`과 다른 최상위 metadata이다.
  - 파일 단위 `dependsOn`을 main mod dependency로 해석하면 기존 mod-info 파일 의존성이 깨진다.
- 활성 dependent가 있는 main mod를 비활성화하거나 삭제하면 dependent asset/config가 남아 broken state가 될 수 있다.
  - main mod disable/delete 전에 active dependent를 검사하고 먼저 비활성화/삭제하도록 차단한다.
## 2026-05-11 Mod Manager version regressions

- Local pack/import에서 `mod-info.json.version`을 버리면 온라인 update 비교와 로컬 목록 표시가 불가능하다.
  - `inspectZip`, `importZipMod`, `importZipWithConfig`, `packMod`, `createAndImportPackage` 모두 package-level `version`을 전달해야 한다.
- GitHub catalog version은 online install metadata로 우선 적용하되, local ZIP import는 `mod-info.json.version`을 fallback으로 사용한다.

## 2026-05-11 Graphics Tool timeline seek regression

- 증상: timeline ruler를 클릭하면 UI에는 `Seeking 00:00:01.xxx`가 표시되지만 preview와 playback state가 다시 0초로 돌아가고, 이후 Play도 0초에서 반복적으로 멈췄다. Stop 후 Play는 정상 동작했다.
- 추정 원인: hidden video의 native `loadedmetadata` / `timeupdate` / stale 0초 publish가 user seek state보다 늦게 들어오면서 parent `currentTime`을 덮었다. React `seekRequest` prop/effect만으로는 실제 media element 상태가 authoritative하지 않았다.
- 예방: Video Tool controls는 실제 `HTMLVideoElement` ref를 직접 잡고 `currentTime`, `play()`, `pause()`를 실행한다. `Stop`만 0초 reset을 만들고 seek/play 경로는 stop/reset state를 공유하지 않는다.
- UI 주의: timeline ruler 위에 MUI `Tooltip`을 올리지 않는다. pointer event/drag seek를 방해하거나 디버깅을 어렵게 만들 수 있다.
