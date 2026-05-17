# Project Rules

이 파일은 HexX Forge Unity 작업 시 항상 참조하는 공통 규칙입니다.

## 공통
- release 패키징은 반드시 동의를 구하고 진행한다.

## UI

- 모든 UI는 Material UI와 `sx` 기반으로 작성합니다.
- 색상은 CSS 변수 기반 theme을 우선 사용합니다.
- Dialog, Button, Menu, Table 등 MUI 컴포넌트도 앱 theme 변수를 적용합니다.
- MUI v9 기준 Dialog 하위 Paper 스타일은 `PaperProps`가 아니라 `slotProps={{ paper: { sx } }}`를 사용합니다.
- 기능 실행 성공/실패 알림은 `src/renderer/context/NotificationContext.tsx`를 사용합니다.
- 폰트 변경 기능이 테마와 분리되어 있으므로, UI 내 텍스트는 폰트 변경 시에도 overflow가 나지 않도록 작성합니다.
- 게임별 설정은 `selectedGameId`와 `gamePaths` 확장 구조를 우선 사용하고, 기존 호환이 필요한 경우에만 `gamePath`를 함께 유지합니다.
- 테마 파일은 표시 이름과 CSS variables를 포함하는 컬러스킴 구조를 우선 사용합니다.
- 폰트 옵션은 `config/typography.json`에서 테마와 별도로 관리합니다.

## Docs

- 모듈별 규칙은 `docs/modules/*.md` 에서 확인한다.
- 기능 구현 후 관련 README와 모듈 문서를 갱신합니다.
- 아직 구현하지 않은 내용은 TODO로 명시합니다.
- 모듈별 상세 변경은 `docs/modules/*.md`에 기록합니다.

## Asset Manager

- 최신 상세 문서는 `docs/modules/asset-manager.md`입니다.
- 백업은 `storage/backups/{font|asset}`에 타입별 마지막 백업 1개만 유지합니다.
- 상단 복원하기는 `storage/backups`의 마지막 백업 파일을 게임 폴더에 덮어씁니다.
- 폰트 현재 상태 표시는 `config/current_fonts.json`을 기준으로 합니다.
- `AssetManager_UnityPy.exe` plan/report는 `resources/tools/AssetManager/work/plans`, `resources/tools/AssetManager/reports`에 생성합니다.

## Package.json
- 변경 완료 시, 버전 정보를 갱신한다.
- 커밋 시, 버전 정보를 갱신한다.
- 대체적으로, Semantic Versioning (SemVer) 규칙을 따릅니다.

## docs/REGRESSION.md
- 해당 파일을 반드시 참고한다.
- 코딩 오류 수정 시, 재발 방지를 위해 해당 파일에 기록/수정한다.

## I18n

- Visible user-facing text added to a new page or changed on an existing page must use `src/renderer/i18n`.
- When modifying a page or module, check whether the changed visible text already has i18n keys; add missing `en`, `ko`, and `zh-CN` keys before completing the change.
- Supported app languages are English (`en`), Korean (`ko`), and Simplified Chinese (`zh-CN`); English is the default and fallback.
- If a page cannot be migrated during a change, document the exception in `docs/TODO.md` under the I18n Migration checklist.
- Do not add another translation library unless the local module becomes insufficient and the decision is documented first.
