# Regression Notes

## 2026-05-16 Graphics Tool chroma export and preview state

- 증상: Video Tool에서 Chroma Key: Advanced를 적용해 WebM으로 export하면 투명 처리된 영역에 이전 프레임의 잔상처럼 보이는 픽셀이 남을 수 있었다.
- 원인: export filtergraph가 portrait 합성용 base를 `nullsrc`로 만들고 있어 VP8 alpha 출력에서 투명 배경 의도를 명시적으로 보존하지 못했다. preview 쪽도 select0r `operation`을 `Minimum`처럼만 처리해 `Shape`, `Edge`, `Operation` 변경 효과가 즉시 드러나지 않았다.
- 예방: export 합성 base는 `color=c=black@0,format=rgba` 투명 source를 사용한다. select0r preview는 `shape`, `edge`, `operation`, `invert`를 alpha 조합으로 반영해야 하며, mask brush preview는 portrait 좌표계를 media frame 좌표계로 crop/scale해서 적용해야 한다.
- 확인: 2026-05-16 사용자 재테스트에서 Chroma Key: Advanced 적용 후 export 영상의 전 프레임 잔상이 사라진 것을 확인했다.
- 추가 증상: Chroma Key: Advanced의 `Invert`는 export 결과가 정상인데 renderer preview에서 반대로 표시될 수 있었다.
- 추가 원인: renderer preview가 app-side `invert` 상태를 FFmpeg/frei0r export에 전달하는 의미와 반대로 alpha selection에 적용했다.
- 예방: preview의 `invert` 의미는 export와 동일하게 유지한다. app-side `invert=true`는 선택 색을 투명하게 만드는 사용자 의미이며, export의 `select0r` parameter inversion과 혼동하지 않는다.
- 추가 증상: brush mask를 칠하면 마스크 일부만 필터에 반영되거나 다른 chroma preview 상태가 초기화된 것처럼 보였다.
- 추가 원인: mask canvas는 `1200 x 1500` portrait 좌표인데 preview pass에서는 이를 media-local canvas 전체로 단순 scale했다.
- 예방: preview mask sampling은 현재 transform과 source aspect ratio를 기준으로 portrait mask의 media 영역만 잘라서 source preview canvas에 매핑한다.

## 2026-05-16 Graphics Tool packaged alpha export

- 증상: 설치된 ASAR build에서 장인 공방 Video Tool export가 `Could not find module 'alpha0ps'`로 실패했다.
- 원인: export filtergraph가 `frei0r=alpha0ps`를 생성했지만 번들된 Windows plugin 파일명은 `alpha0ps_alpha0ps.dll`이다. 파일명으로 바꾸면 모듈은 로딩되지만 FFmpeg가 `Display input alpha` boolean parameter 값을 거부해 다른 오류로 이어진다.
- 예방: export에서는 Alpha Channel: Adjust를 `frei0r.alpha0ps` 직접 호출 대신 native FFmpeg `lut` alpha approximation으로 생성한다. `select0r`, `keyspillm0pup`, `saturat0r`처럼 FFmpeg에서 실제 parameter dry-run이 통과한 frei0r filter만 직접 호출한다.

## 2026-05-15 Mod Manager package export

- 증상: 목록에서 내보낸 ZIP을 `모드 추가 > 로컬 > ZIP`으로 다시 설치할 수 없거나 `mod-info.json` metadata가 손실될 수 있다.
- 원인: export가 설치 상태 DB를 그대로 복사하거나, 최상위 `mod-info.json`을 재생성하지 않고 기존 nested manifest/source metadata에 의존하면 local import flow와 schema가 어긋난다.
- 예방: export ZIP은 항상 최상위 `mod-info.json`을 새로 생성하고, `version`, `dependency`, `files`를 보존한다. `enabled`, GitHub `source` 등 로컬 설치 상태는 제외한다.
- DLL은 활성/비활성 위치에서, non-DLL 배포 파일은 `storage/packages/{packageId}`에서 읽어야 한다. `folder`는 ZIP entry가 아니라 manifest entry로만 유지한다.

## 2026-05-17 Mod Manager update policy

- 증상: 온라인 모드 업데이트가 항상 기존 package 삭제 후 재설치로만 동작하면 사용자 config, registry JSON, asset pack 폴더가 손실될 수 있다.
- 원인: catalog/manifest에 업데이트 정책이 없고 update flow가 `deletePackage -> importZipMod` 단일 경로였다.
- 예방: `mod-info.json`/catalog의 `updatePolicy`를 읽고 `replace-confirm`, `merge`, `overwrite`를 분기한다.
- `merge`에서는 `preserve[]` 경로를 package storage와 BepInEx 배포 위치 양쪽에서 덮어쓰기/삭제하지 않아야 한다.
- `removeMissing: true` 또는 `overwrite`에서도 `preserve[]`는 삭제하면 안 된다.
- 종속 모드 `dependency.installBase`가 있는 파일은 `files[].path`와 최종 BepInEx 배포 경로를 모두 보존 경로 매칭 대상으로 본다.
- `updatePolicy`가 없는 기존 ZIP/catalog는 호환을 위해 `replace-confirm`으로 처리하고, renderer는 업데이트 전에 삭제 후 재설치 확인 Dialog를 보여줘야 한다.

## 2026-05-17 Mod Manager online distribution editor

- 증상: 관리자 도구에서 온라인 모드를 추가/수정했지만 앱 온라인 탭에서 404 또는 catalog 형식 오류가 발생할 수 있다.
- 원인: `downloadPath`와 실제 ZIP 위치가 어긋나거나, `mods/index.json`이 `{ schemaVersion: 1, mods: [] }` 형식을 유지하지 못하면 raw catalog parser가 실패한다.
- 예방: 배포 도구는 ZIP을 `mods/packages/{modId}/{version}/{modId}.{version}.zip`으로 복사하고 같은 값을 `downloadPath`에 기록한다. 저장 후 `mods/index.json`은 항상 pretty JSON + trailing newline으로 쓴다.
- 삭제는 catalog 항목만 지우고 package 폴더를 남기면 stale ZIP이 쌓인다. 관리자 삭제는 `mods/packages/{modId}`도 함께 제거한다.
- Electron 실행 cwd가 repo root가 아니면 현재 폴더의 `mods/index.json`을 읽지 못해 등록된 모드가 비어 보일 수 있다. distribution root 탐색은 `process.cwd()/mods`뿐 아니라 main bundle 기준 repo root 후보도 확인해야 한다.
- 같은 모드 업데이트를 등록할 때 id를 실수로 바꾸면 기존 catalog item이 중복될 수 있다. 수정 모드에서는 id를 잠그고, `다음 버전 준비`로 version/downloadPath/sha256 갱신 흐름을 사용한다.
- 모드 README md는 `readme` 파일 타입으로 보존해야 한다. `asset`으로 오탐하면 상세정보에서 표시되지 않고, `config/asset` 배포 경로에 섞일 수 있다.
- 온라인 자세히보기는 ZIP 내부 파일을 다운로드해서 열지 않는다. catalog item의 `readmePath`가 GitHub raw 기준 markdown 경로를 가리켜야 한다.
- 모드 추가 Dialog는 한 번 읽은 온라인 catalog state를 계속 들고 있으면 push 직후 새 항목이 보이지 않을 수 있다. Dialog를 닫으면 `onlineLoaded`와 목록을 초기화하고, catalog fetch는 cache-busting query/no-cache header로 raw CDN stale 응답을 피한다.

## 2026-05-15 Asset Manager catalog editor focus and applied pack state

- 증상: 비밀 Catalog Editor에서 `id` 입력 중 한 글자마다 TextField focus가 빠지고, 사용자가 저장 전 입력을 마치기 어렵다.
- 원인: catalog row React key가 `id` 값에 의존해 `id` 변경마다 row가 remount되었다.
- 예방: 편집용 row는 저장 대상 data field와 별개인 stable `rowId`를 key로 사용한다. 사용자가 편집하는 field 값을 React key로 쓰지 않는다.
- Catalog Editor는 `asset_catalog.json` 원본 target/preview 관리용이다. 변경 PNG는 pack 배포 도구 또는 직접 적용 flow에서만 선택한다.
- pack 적용 성공 후에는 `config/current_asset_packs.json`에 catalogId별 적용 pack 상태를 기록한다. 미리보기 UI는 이 파일을 기준으로 현재 적용 pack preview를 우선 표시한다.
- 어셋 백업 복원이나 외부 게임 업데이트로 원본 파일이 돌아간 뒤 `current_asset_packs.json`이 남아 있으면 UI가 잘못된 pack preview를 현재 상태처럼 보여준다. 어셋 복원 시 자동 초기화하고, 외부 복원 대응용 수동 초기화 버튼을 유지한다.

## 2026-05-17 Asset Manager remote catalog sync

- 증상: 새 어셋팩 target을 추가하려면 `config/asset_catalog.json`과 preview 파일이 앱에 번들되어야 해서 전체 앱 업데이트가 필요했다.
- 원인: Asset Manager의 원본 대상 catalog는 로컬 config만 읽고, 온라인 어셋팩 ZIP catalog와 별도의 작은 업데이트 채널이 없었다.
- 예방: 배포용 catalog는 `asset-catalog/index.json`과 `asset-catalog/previews/...`에 두고, 앱은 수동 `Catalog 동기화`로 GitHub raw catalog를 받아 `config/asset_catalog.json`과 preview cache를 갱신한다.
- 같은 catalog `id`는 원격 항목이 우선한다. 로컬 preview download가 실패하면 해당 항목은 유지하되 preview를 비워 UI가 stale 이미지를 현재 원본처럼 보여주지 않게 한다.

## 2026-05-17 Asset Manager metadata TSV editor

- 증상: `asset_catalog.json`만 UI에서 수정할 수 있으면 UnityPy patch 기준인 `metadata/data.tsv`, `metadata/ui_textures.tsv`와 catalog가 쉽게 desync될 수 있다.
- 원인: Electron catalog와 UnityPy metadata가 역할은 분리되어 있지만, 개발자 도구가 한쪽만 편집하게 되어 있었다.
- 예방: Catalog Editor는 catalog JSON과 metadata TSV를 tab으로 분리해 관리한다. TSV tab은 metadata registry를 기준으로 columns를 렌더링하고, 각 row는 기본 접힘 accordion으로 표시해 100개 이상 행에서도 스캔 가능하게 유지한다.
- `data.tsv`와 `ui_textures.tsv`는 서로 다른 UnityPy API의 source of truth이므로 한 파일에 섞지 않는다. 신규 asset kind는 별도 TSV/plan kind/registry entry로 추가한다.
- 추가 증상: `asset_catalog.json` 항목 추가가 특정 metadata 파일만 암묵적으로 사용하거나, 사용자가 `category/option1/option2/textureName/pathId`를 먼저 직접 입력하면 UnityPy metadata와 다른 catalog target이 생길 수 있다.
- 예방: catalog 항목 추가는 metadata source file과 metadata row를 먼저 선택해 생성한다. `pathId`는 중복 가능하므로 unique key로 단독 사용하지 말고, metadata file key와 stable row id를 함께 사용한다. 실제 patch identity field는 catalog editor에서 읽기 전용으로 유지한다.

## 2026-05-17 Asset Pack distribution edit

- 증상: 한 번 배포한 어셋팩에서 일부 target만 유지/교체/삭제하려면 pack을 처음부터 다시 구성해야 했다.
- 원인: 배포 도구가 `asset-packs/index.json`에 새 항목을 upsert하고 ZIP을 새로 쓰는 기능만 제공했고, 기존 ZIP의 target entry를 재사용하는 경로가 없었다.
- 예방: 배포 도구는 기존 배포 항목을 읽고, 유지 row는 기존 ZIP entry를 새 ZIP staging으로 복사한다. 사용자가 `PNG 교체`한 row만 새 PNG를 사용하고, 삭제한 row는 다음 `pack.json`에서 제외한다.
- 추가 증상: ZIP 생성 실패 뒤 `asset-packs/packages/.../__pack_staging/files/...png` 같은 raw 작업물이 남고, `asset-packs/index.json`은 존재하지 않는 ZIP을 가리킬 수 있었다.
- 추가 원인: staging을 최종 version 폴더 안에 만들고, 생성 시작 시 기존 `packages/{packId}`를 먼저 삭제해 수정 배포에서 기존 ZIP entry를 재사용하기 어렵거나 실패 산출물이 남을 수 있었다.
- 예방: 배포 생성은 `packages/__tmp-{packId}-{timestamp}`에서 ZIP과 thumbnail을 완성한 뒤 검증에 성공한 경우에만 최종 ZIP/thumbnail/index를 갱신한다. 성공/실패 후 `__pack_staging`과 `__tmp-*`를 정리하고, 배포 catalog 조회는 missing ZIP/thumbnail을 `깨짐` 상태로 표시해야 한다.
- 추가 증상: 온라인 어셋팩 목록의 작은 thumbnail을 클릭 확대 preview에도 그대로 사용하면 이미지가 흐릿하게 보인다.
- 예방: catalog item은 목록용 `thumbnailPath`와 확대용 `previewPath`를 분리한다. 생성 도구는 thumbnail을 최대 `420x280`, 대표 preview를 최대 `1920x1080`으로 별도 생성하고, UI는 클릭 확대 시 `previewUrl`을 우선 사용한다.
- 추가 증상: Asset Manager의 변경 미리보기가 pack target의 저해상도 `previewUrl`을 실제 교체 PNG보다 먼저 사용하면 흐릿하게 보인다.
- 예방: 변경 미리보기와 현재 적용 pack 기록은 `target.pngUrl`을 우선 사용한다. pack 내부 target preview를 새로 생성할 때도 thumbnail 크기가 아니라 최대 `1920x1080`으로 생성한다.

## 2026-05-17 Asset Manager texture selection UX

- 증상: pack target이 1개뿐이어도 사용자가 다시 `적용 대상`을 선택해야 하고, 후보가 있는 dropdown에 `선택 안함`이 남아 실제 적용 가능한 선택지를 흐릴 수 있다.
- 예방: `availablePackTargets.length === 1`이면 기존 target 선택 handler로 자동 선택한다. 후보가 있는 경우 `선택 안함` 항목을 숨기고, 후보가 없으면 선택 상태와 replacement preview를 비운 뒤 `선택한 원본 대상이 이 팩에 포함되어 있지 않습니다.`를 표시한다.
- 직접 이미지 선택 버튼은 `직접 이미지 선택` mode에만 보여야 한다. `어셋팩 사용` mode에 함께 노출되면 pack flow와 direct flow가 섞여 사용자가 잘못된 replacement source를 고를 수 있다.

## 2026-05-11 Graphics Tool preview parity

- 증상: Video Tool에서 `Color Grading`을 조정해도 viewport에 적용되지 않거나, `Alpha Channel: Adjust`가 단순 alpha 배율처럼 동작해 Shotcut/frei0r 결과와 크게 달라 보일 수 있다.
- 원인: canvas preview pass 실행 조건에 `colorGrading`이 빠져 있었고, `alpha0ps` preview가 operation mode를 구분하지 않았다.
- 예방: canvas preview pass는 chroma/key spill/alpha/color grading/image background alpha 중 하나라도 enabled이면 실행한다. Alpha preview는 `No Change`, `Threshold`, shrink/grow 계열을 최소한 mode별로 분리해 근사한다.
- Image Tool의 background alpha는 export canvas와 preview canvas가 같은 color-key helper를 공유해야 한다. export-only 처리로 남기면 사용자가 내보내기 전 결과를 확인할 수 없다.
- `config/graphics_presets.json`과 renderer fallback registry의 visible labels는 UTF-8 다국어 문자열로 유지한다. JSON parse 실패가 발생하면 fallback label이 그대로 UI에 노출된다.

## 2026-05-11 Mod Manager linked JSON reconcile

- Symptoms: 사용자가 예시 linked JSON으로 패킹할 때 JSON에만 남은 registry entry와 현재 패킹 asset에만 있는 파일을 수동으로 맞춰야 했다.
- Cause: `file_manager` linked JSON editor는 preview/metadata 추론용 상태였고, 패킹 ZIP에 들어갈 JSON entry content override 경로가 없었다.
- Prevention: linked JSON 정리 기능은 원본 JSON/ZIP을 직접 수정하지 않고 `contentTextOverride`를 통해 패킹 출력에만 반영한다.
- Pack output 검증 시 linked JSON entry가 원본 ZIP bytes가 아니라 override text로 기록되는지 확인한다.
- 추가 후보는 공통 default 값으로 일괄 생성하면 안 된다. 후보를 체크한 뒤 후보별 metadata 입력값이 해당 JSON key에만 반영되어야 한다.

## 2026-05-11 Korean UI text mojibake prevention

- 증상: 새로 추가한 Mod Manager visible text가 mojibake된 문자열로 저장될 수 있다.
- 원인: 한글 UI 문자열을 패치한 뒤 UTF-8 원문 검증 없이 빌드만 통과시키면, TypeScript 문법은 정상이어도 화면에는 깨진 문구가 남는다.
- 예방: 한글 visible text를 추가/수정한 뒤에는 `node` 또는 UTF-8 aware read로 해당 라인을 확인하고, mojibake 후보 패턴 검색을 함께 실행한다.
- 빌드 통과는 인코딩 정상의 증거가 아니다. 사용자에게 보이는 새 한글 문구는 최종 응답 전 원문을 직접 확인한다.

## 2026-05-11 Mod Manager dependency install base

- 종속 모드 asset pack은 main mod 하위 폴더에 설치되어야 할 수 있다. 예: `plugins/ResourceInjector/pack`.
- `dependency.installBase`가 있는 경우 BepInEx rooted path가 아닌 배포 파일/folder는 타입이 `config`여도 BepInEx 기준 `installBase` 아래로 배포한다.
- 이미 `plugins/`, `config/`, `patchers/`로 시작하는 file path에는 `installBase`를 중복 적용하지 않는다.
- DLL 위치는 기존 `plugins/*.dll` enable/disable 규칙을 유지한다.
- file_manager `targetDir`은 `dependency.installBase` 기준 상대경로가 아니라 항상 BepInEx 기준 상대경로다. `종속 설치 기준 사용` 버튼은 값을 복사하는 shortcut일 뿐 runtime path 해석 규칙을 바꾸지 않는다.
- `banana_zero_pack/pack_info.json` 같은 종속 config가 `BepInEx/banana_zero_pack/...`에 떨어지면 안 된다. installBase가 `plugins/ResourceInjector/packs`이면 최종 경로는 `BepInEx/plugins/ResourceInjector/packs/banana_zero_pack/pack_info.json`이어야 한다.
- 종속 모드 file_manager의 `linkedConfigPath`도 runtime에서 BepInEx 기준으로 해석되므로, 패킹 시 installBase가 붙은 최종 경로로 저장되어야 한다.

## 2026-05-11 Mod Manager dialog focus recovery

- Symptoms: In Mod Packing and related dialogs, TextField focus could intermittently stop accepting keyboard input after using Electron native file/save dialogs or MUI Select menus. Alt+Tab out and back restored input.
- Likely cause: Electron window activation, native dialog return timing, and MUI menu focus restore could leave keyboard focus on a stale non-editable element.
- Prevention: After native dialogs and Select menu close, run delayed focus recovery several times. Do not blur the active element if it is already an input, textarea, or contenteditable element.

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
- dependency parent를 접었는데 dependent가 root row로 다시 나타나면 안 된다.
  - parent가 확인된 child는 fallback root 렌더링에서 제외하고, orphan dependent만 root 위치에 남긴다.
## 2026-05-11 Mod Manager version regressions

- Local pack/import에서 `mod-info.json.version`을 버리면 온라인 update 비교와 로컬 목록 표시가 불가능하다.
  - `inspectZip`, `importZipMod`, `importZipWithConfig`, `packMod`, `createAndImportPackage` 모두 package-level `version`을 전달해야 한다.
- GitHub catalog version은 online install metadata로 우선 적용하되, local ZIP import는 `mod-info.json.version`을 fallback으로 사용한다.

## 2026-05-11 Graphics Tool timeline seek regression

- 증상: timeline ruler를 클릭하면 UI에는 `Seeking 00:00:01.xxx`가 표시되지만 preview와 playback state가 다시 0초로 돌아가고, 이후 Play도 0초에서 반복적으로 멈췄다. Stop 후 Play는 정상 동작했다.
- 추정 원인: hidden video의 native `loadedmetadata` / `timeupdate` / stale 0초 publish가 user seek state보다 늦게 들어오면서 parent `currentTime`을 덮었다. React `seekRequest` prop/effect만으로는 실제 media element 상태가 authoritative하지 않았다.
- 예방: Video Tool controls는 실제 `HTMLVideoElement` ref를 직접 잡고 `currentTime`, `play()`, `pause()`를 실행한다. `Stop`만 0초 reset을 만들고 seek/play 경로는 stop/reset state를 공유하지 않는다.
- UI 주의: timeline ruler 위에 MUI `Tooltip`을 올리지 않는다. pointer event/drag seek를 방해하거나 디버깅을 어렵게 만들 수 있다.
