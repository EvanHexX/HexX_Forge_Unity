# Asset Manager

Unity 기반 게임의 원본 리소스를 백업하고, 텍스처/폰트 교체 작업을 `AssetManager_UnityPy.exe`로 적용하는 모듈입니다.

## 관련 파일

```text
src/renderer/pages/AssetManager.tsx
src/main/services/assetService.ts
src/main/services/assetPatcherService.ts
src/main/ipc/assetIpc.ts
src/main/ipc/assetPatcherIpc.ts
src/preload/preload.ts
config/asset_config.json
config/asset_catalog.json
config/current_fonts.json
resources/tools/AssetManager/
storage/backups/
storage/asset_packs/
storage/fonts/
```

## 백업

- Font / Asset 백업 상태를 표시합니다.
- Font / Asset 체크박스 선택 후 `백업하기`를 누르면 MUI 확인창을 표시합니다.
- 확인창 본문은 "현재 폰트와 어셋 기준으로 백업합니다." 입니다.
- 기존 백업본이 있으면 "게임이 업데이트 되지 않은경우는 다시 백업할 필요가 없습니다." 안내를 추가로 표시합니다.
- 백업 대상은 `config/asset_config.json`의 `backupTargets`를 사용합니다.
- 백업 결과는 `storage/backups/{font|asset}/{timestamp}/`에 저장됩니다.
- 같은 타입의 기존 백업은 새 백업 생성 전에 삭제하므로 `font`, `asset` 각각 마지막 백업 1개만 유지합니다.
- 백업 완료 시 `NotificationContext`로 완료 알림을 표시합니다.

## 복원

- 기존 `전체복원` 버튼은 `복원하기` 버튼으로 교체했습니다.
- 복원 전 MUI 확인창에서 마지막 백업 파일을 게임 폴더에 덮어쓴다는 설명을 표시합니다.
- 폰트는 `storage/backups/font`의 마지막 백업을 게임 폴더에 복사해 덮어씁니다.
- 어셋은 `storage/backups/asset`의 마지막 백업을 게임 폴더에 복사해 덮어씁니다.
- 복원은 더 이상 원본 데이터를 API로 재주입하지 않습니다.

## 텍스처 교체 작업

- `config/asset_catalog.json`을 UI 카탈로그로 사용합니다.
- Asset Pack ZIP import, pack target 선택, 직접 PNG 선택을 지원합니다.
- 단일 적용은 선택한 catalog item과 replacement PNG 1개를 `asset:run-clothes-patch`로 전달합니다.
- 팩 전체 적용은 선택한 pack의 모든 target을 `mode: "pack_all"`로 전달합니다.
- 팩 전체 적용 완료 시 `NotificationContext`로 완료 알림을 표시합니다.

## 폰트 교체 작업

- 텍스처 교체 작업과 분리된 탭으로 제공합니다.
- 버튼:
  - `폰트 추출`: `font_extract` plan을 만들어 실행합니다.
  - `동기화`: 현재 `resources.assets`의 폰트 목록을 `font_list` API로 읽고 `config/current_fonts.json`을 갱신합니다.
  - `폰트 추가`: `.ttf`, `.otf`, `.ttc`, `.fontdata` 파일을 `storage/fonts`로 복사한 뒤 교체 후보로 추가합니다.
  - `선택 폰트 적용`: MUI 확인창에서 재확인한 뒤 테이블에서 선택한 교체폰트만 `font` plan으로 적용합니다.
- 페이지 진입 시 `storage/fonts` 폴더를 확인하고 저장된 폰트를 교체폰트 드롭다운에 표시합니다.
- 선택 폰트 적용 완료 시 `NotificationContext`로 완료 알림을 표시합니다.
- 실패 메시지도 하단 메시지 영역과 `NotificationContext`에 함께 표시합니다.
- 테이블 열:
  - 적용대상
  - 현재폰트
  - 교체폰트
  - 미리보기
- 열 제목은 가운데 정렬합니다.
- 적용대상은 현재 `2418`부터 `2430`까지 path id를 그대로 표시합니다.
- 현재폰트는 `config/current_fonts.json`을 기준으로 표시합니다.
- 기본 `config/current_fonts.json`은 기존 추출 파일명 prefix(`${pathId}_`)와 실제 미리보기 가능한 폰트 파일명을 매칭해 작성했습니다.
- 예: `2418_SourceHanSerifCN-Medium.fontdata`는 미리보기 가능한 `SourceHanSerifCN-Medium.otf`로 등록합니다.
- 폰트를 교체하면 적용 성공 후 `config/current_fonts.json`의 해당 path id 항목을 교체 폰트 파일명으로 갱신합니다.
- 추출된 폰트 및 미리보기용 원본 폰트 파일 위치:

```text
resources/tools/AssetManager/originals/LongYinLiZhiZhuan/fonts
```

- 각 행은 hover highlight를 사용합니다.
- 각 행에서 우클릭하면 `복원하기` 메뉴가 표시되고, 해당 path id만 `font_restore` API로 복원합니다.
- 미리보기 열은 현재폰트와 교체폰트를 좌우로 나누어 표시합니다.
- 왼쪽 텍스트는 `현재폰트`, 오른쪽 텍스트는 `교체폰트`입니다.

## Patcher API

폰트 추출 plan:

```json
{
  "kind": "font_extract",
  "game_id": "LongYinLiZhiZhuan",
  "font_metadata_path": "../metadata/fonts_data.tsv",
  "originals_dir": "../originals",
  "assets_file": "D:/Games/.../LongYinLiZhiZhuan_Data/resources.assets",
  "overwrite": false
}
```

폰트 교체 plan:

```json
{
  "kind": "font",
  "game_id": "LongYinLiZhiZhuan",
  "dry_run": false,
  "stop_on_error": true,
  "font_metadata_path": "../metadata/fonts_data.tsv",
  "originals_dir": "../originals",
  "assets_file": "D:/Games/.../LongYinLiZhiZhuan_Data/resources.assets",
  "jobs": [
    {
      "path_id": 2418,
      "replacement_font_file": "D:/Mods/fonts/MyFont.ttf"
    }
  ]
}
```

폰트 복원 plan:

```json
{
  "kind": "font_restore",
  "game_id": "LongYinLiZhiZhuan",
  "dry_run": false,
  "stop_on_error": true,
  "font_metadata_path": "../metadata/fonts_data.tsv",
  "originals_dir": "../originals",
  "assets_file": "D:/Games/.../LongYinLiZhiZhuan_Data/resources.assets",
  "jobs": [
    {
      "path_id": 2418
    }
  ]
}
```

폰트 리스트 동기화 plan:

```json
{
  "kind": "font_list",
  "assets_file": "D:/Games/.../LongYinLiZhiZhuan_Data/resources.assets"
}
```

폰트 리스트 report:

```json
{
  "kind": "font_list",
  "status": "success",
  "assets_file": "D:/Games/.../LongYinLiZhiZhuan_Data/resources.assets",
  "count": 2,
  "fonts": [
    {
      "path_id": 2418,
      "font_file_name": "2418_SourceHanSerifCN-Medium.fontdata"
    }
  ]
}
```

실행 흐름:

```text
AssetManager.tsx
-> window.electronAPI.runFontExtract / runFontPatch / runFontRestore / runFontList
-> assetPatcherIpc.ts
-> assetPatcherService.ts
-> resources/tools/AssetManager/work/plans/*.json 생성
-> AssetManager_UnityPy.exe --plan <relativePlan> --report <relativeReport>
-> resources/tools/AssetManager/reports/*.report.json 확인
```

동기화 흐름:

```text
AssetManager.tsx
-> 동기화 버튼
-> MUI 확인창
-> window.electronAPI.runFontList(params)
-> assetPatcherIpc.ts
-> assetPatcherService.ts
-> font_list plan 생성 및 실행
-> report.fonts[]를 config/current_fonts.json에 반영
-> Renderer 폰트 테이블 다시 로드
```

## TODO

- [x] 백업 확인창 추가
- [x] 기존 백업본 안내 문구 추가
- [x] 백업 타입별 마지막 백업 1개만 유지
- [x] 복원 확인창 추가
- [x] 복원을 storage/backups 파일 덮어쓰기 방식으로 변경
- [x] 백업 완료 Notification 연결
- [x] 팩 전체 적용 완료 Notification 연결
- [x] 텍스처/폰트 교체 작업 탭 분리
- [x] 폰트 추출 API 연결
- [x] 폰트 교체 API 연결
- [x] 폰트 복원 API 연결
- [x] 폰트 추가 시 `storage/fonts`로 복사
- [x] 페이지 진입 시 `storage/fonts` 폴더 기반 드롭다운 구성
- [x] 선택 폰트 적용 완료 Notification 연결
- [x] 선택 폰트 적용 전 재확인 Dialog 추가
- [x] 실패 메시지 Notification 연결
- [x] 기본 현재폰트 정보용 `config/current_fonts.json` 추가
- [x] 현재폰트 표시를 `config/current_fonts.json` 기준으로 변경
- [x] 폰트 교체 성공 시 `config/current_fonts.json` 갱신
- [x] 폰트 리스트 동기화 버튼 및 확인창 추가
- [x] `font_list` API 연결 및 report 기반 동기화
- [x] 폰트 테이블 13개 path id 표시
- [x] 폰트 테이블 열 제목 가운데 정렬
- [x] 현재폰트/교체폰트 미리보기 열 추가
- [x] 폰트 행 우클릭 복원 메뉴
- [ ] dry-run 버튼 추가
- [ ] patch 실행 로그 UI
- [ ] report 상세 UI
- [ ] 현재폰트 표시명 상세 정보 보강
- [ ] 원본 백업 존재 여부를 catalog item별로 표시
- [ ] `asset_catalog.json` v2 마이그레이션 완료
- [ ] pack.json v2 검증 강화
