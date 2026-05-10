# Regression Notes

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
