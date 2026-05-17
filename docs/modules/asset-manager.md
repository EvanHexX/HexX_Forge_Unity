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
config/current_asset_packs.json
resources/tools/AssetManager/
storage/backups/
storage/asset_packs/
storage/fonts/
asset-catalog/index.json
asset-catalog/previews/
asset-packs/index.json
asset-packs/packages/
asset-packs/thumbnails/
```

## 배포 / ASAR 주의

- ASAR release build에서도 `AssetManager_UnityPy.exe`와 Python runtime 파일은 `extraResources`로 복사된 `resources/tools/AssetManager` 아래의 실제 파일 경로에 있어야 합니다.
- `AssetManager_UnityPy.exe`는 ASAR 내부 파일을 실행하거나 직접 읽는 구조가 아니므로, `metadata`, `originals`, bundled dependency `.dll`/`.pyd` 파일을 `app.asar`에 넣지 않습니다.
- plan/report 작업 파일은 패키징된 앱에서 `app.getPath('userData')/storage/asset-manager-work/{plans,reports}`에 생성합니다. repo의 `resources/tools/AssetManager/work`와 `reports`는 release bundle에 포함하지 않습니다.
- release 검증은 `scripts/verify-release.mjs`에서 `AssetManager_UnityPy.exe`, `metadata/ui_textures.tsv`, FFmpeg/frei0r 파일 존재와 ASAR 제외 경로를 확인합니다.

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
- 앱에 번들된 catalog를 바꾸지 않아도 새 target을 추가할 수 있도록 GitHub raw 기반 원격 catalog 동기화를 지원한다.
- 원격 catalog 위치는 `asset-catalog/index.json`이며, 원본 preview PNG는 `asset-catalog/previews/<category>/<id>_preview.png`에 둔다.
- Asset Manager는 원격 catalog 상태를 확인해 업데이트 가능 여부를 표시하고, 사용자가 `Catalog 동기화`를 눌렀을 때만 `config/asset_catalog.json`과 preview 파일을 갱신한다.
- 동기화 시 같은 `id`는 원격 catalog 항목이 우선하며, 로컬에만 있는 항목은 보존한다. 원격에서 내려받은 preview는 `config/asset-catalog/previews/...`에 저장되어 기존 `hexx-resource://preview/...` 경로로 표시된다.
- 네트워크 오류나 원격 manifest 오류가 있어도 기존 local catalog를 계속 사용한다.
- Asset Pack ZIP import, pack target 선택, 직접 PNG 선택을 지원합니다.
- 어셋팩 추가 Dialog는 Mod Manager와 같은 온라인/로컬 탭 구조를 사용한다.
- 온라인 어셋팩 catalog 위치는 `asset-packs/index.json`이며, ZIP은 `asset-packs/packages/{packId}/{version}/{packId}.zip` 경로를 사용한다.
- 온라인 catalog item은 `id`, `name`, `author`, `description`, `version`, `downloadPath`, `thumbnailPath`, `sha256`, `gameIds`를 지원한다.
- 온라인에서 설치한 어셋팩은 `pack.json`에 `version`과 `source: { type: "github", catalogId, downloadPath }`를 보존해서 설치/업데이트 상태를 비교한다.
- 단일 적용은 선택한 catalog item과 replacement PNG 1개를 `asset:run-clothes-patch`로 전달합니다.
- 팩 전체 적용은 선택한 pack의 모든 target을 `mode: "pack_all"`로 전달합니다.
- 팩 전체 적용 완료 시 `NotificationContext`로 완료 알림을 표시합니다.
- pack target 적용 성공 후 `config/current_asset_packs.json`에 catalogId별 현재 적용 pack/target/preview 상태를 기록한다.
- 원본 미리보기 영역은 해당 catalogId에 현재 적용 pack 기록이 있으면 원본 preview 대신 현재 적용 pack preview를 보여준다. caption은 `현재 적용됨: {packName} · {targetLabel}` 형식이다.
- 미리보기 이미지는 클릭하면 확대 Dialog로 열린다.
- 어셋을 포함해 `복원하기`를 실행하면 `config/current_asset_packs.json` 기록을 자동으로 비운다.
- 게임 업데이트나 외부 도구로 원본 파일이 복원된 경우를 위해 텍스처 교체 작업에는 `적용 기록 초기화` 버튼을 제공한다.

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

## Asset Catalog v2 / Developer Editor

- `config/asset_catalog.json`은 의상뿐 아니라 UI Texture2D 대상도 담는 범용 catalog로 확장한다.
- `config/asset_catalog.json`은 앱 표시, 원본 대상 선택, pack target 연결을 위한 Electron-side catalog이다. UnityPy가 실제 패치 가능 여부를 판단하는 source of truth는 아니다.
- v2 catalog는 기존 `gender` 필드를 legacy alias로 유지하되, 신규 작성/편집은 `option1`을 우선 사용한다.
- UI 라벨에서는 `gender` 대신 `대상 구분`으로 표시한다. 예: `category=UI`, `option1=title`, `option1Label=타이틀`, `displayLabel=UI 타이틀`.
- patch payload는 Python/UnityPy 계약을 유지한다. Electron은 `category`, `option1`, `option2`, `textureName`, `pathId`, `size`, `pngPath`를 plan으로 변환한다.
- 실제 패치 metadata는 category별로 분리한다. 현재 라우팅은 `category=UI`만 `ui_texture` plan과 `metadata/ui_textures.tsv`를 사용하고, 그 외 기존 texture target은 `texture` plan과 `metadata/data.tsv`를 사용한다.
- `category=UI` target은 UnityPy `ui_texture` plan으로 라우팅한다. 이 API는 `path_id`와 `png_file`을 중심으로 `metadata/ui_textures.tsv`에서 실제 `assets_file`, size, format, flip_y를 찾는다.
- UI Texture plan은 `game_id`, `data_dir`, `dry_run`, `stop_on_error`, `ui_texture_metadata_path`, `originals_dir`, `jobs[].path_id`, `jobs[].png_file` 구조를 사용한다.
- UI Texture 대상은 현재 DXT5 PNG 교체만 지원하며, PNG 크기는 `ui_textures.tsv`의 `width`/`height`와 정확히 같아야 한다.
- pack 전체 적용에 의상 target과 UI target이 섞이면 Electron은 기존 `texture` plan과 신규 `ui_texture` plan으로 나누어 순차 실행한다.
- `Ctrl+Alt+C`는 공용 developer shortcut이다. `DeveloperGateDialog` 비밀번호 확인 후 Asset Manager의 Catalog Editor를 연다.
- 비밀번호 확인 후 열리는 개발자 전용 도구에는 Catalog Editor와 어셋팩 배포용 파일 생성 도구가 있다.
- developer password는 OS 환경변수 `HEXX_FORGE_DEVELOPER_PASSWORD` 또는 `config/developer_access.json`에서 명시적으로 관리한다. 둘 다 없으면 Catalog Editor 접근은 차단되며 파일을 자동 생성하지 않는다.
- Catalog Editor는 tab 구조를 사용한다. `asset_catalog.json`, `metadata/data.tsv`, `metadata/ui_textures.tsv`를 별도 tab으로 관리하고, 각 row는 기본 접힘 상태의 accordion으로 렌더링한다.
- Catalog Editor에서 원본 미리보기 PNG를 선택하면 `config/resources/previews/<category>/<id>_preview.png`로 복사하고 item의 `preview` 값을 갱신한다.
- Catalog Editor/개발자 도구의 `배포 catalog export`는 현재 local catalog와 preview를 `asset-catalog/index.json`, `asset-catalog/previews/...` 배포 구조로 복사한다. 생성된 파일은 개발자가 확인 후 커밋/push해야 앱에서 동기화할 수 있다.
- `asset-catalog/index.json` manifest는 `schemaVersion: 1`, `catalogVersion`, `updatedAt`, `items[]`를 사용한다. `items[].previewSha256`이 있으면 동기화 시 preview 다운로드 검증에 사용한다.
- 어셋팩 배포 도구는 PNG 여러 개를 선택하고 각 PNG마다 catalog target을 지정해 `pack.json`과 배포 ZIP을 생성할 수 있다. 완성된 ZIP을 직접 선택하는 legacy 경로도 유지한다.
- 어셋팩 배포 도구는 `asset-packs/index.json`의 기존 배포 항목을 불러와 수정/삭제할 수 있다. 기존 target은 기본적으로 ZIP entry를 유지하며, row별 `PNG 교체`를 누른 항목만 새 PNG로 교체되고 삭제한 row는 다음 ZIP에서 제외된다.
- PNG 기반 배포 생성 시 각 row의 `catalogId`, `category`, `option1`, `option2`, `displayLabel`, `textureName`, `pathId`, `size`, `png`, `preview`를 pack target으로 기록한다. `category=UI` target은 `option2` 없이 생성할 수 있다.
- 생성은 atomic flow를 사용한다. 먼저 `asset-packs/packages/__tmp-{packId}-{timestamp}`에서 `pack.json`, `files/...`, `previews/...`, ZIP, thumbnail을 완성하고 검증한 뒤, 성공한 경우에만 최종 `asset-packs/packages/{packId}/{version}/{packId}.zip`과 `asset-packs/thumbnails/{packId}.png`로 복사한다.
- 배포 repo에는 최종 산출물만 남긴다. `__pack_staging`, `__tmp-*`, raw PNG 같은 작업용 파일은 성공/실패와 관계없이 정리 대상이며, `asset-packs/packages/...` 아래에 source asset을 보관하지 않는다.
- 생성된 ZIP은 `asset-packs/packages/{packId}/{version}/{packId}.zip`으로 저장하고, 각 target preview는 pack 내부 `previews/<category>/..._preview.png`에 최대 `420x280` 크기로 저장한다. ZIP 검증은 `pack.json`, `targets[].png`, `targets[].preview` entry 존재를 확인한다.
- 선택한 대표 미리보기 PNG가 있으면 이를 최대 `420x280` 크기의 catalog thumbnail로 줄여 `asset-packs/thumbnails/{packId}.png`에 저장한다. 대표 미리보기 PNG가 없으면 첫 번째 target PNG를 사용하고, 기존 pack 수정에서 모든 row가 유지 상태이면 기존 ZIP의 첫 번째 target PNG 또는 기존 thumbnail을 사용한다.
- 어셋팩 배포 도구는 `asset-packs/index.json`을 생성/갱신하고 ZIP의 `sha256`을 catalog item에 기록한다. 생성된 `asset-packs` 하위 파일은 개발자가 확인 후 커밋한다.
- `asset-packs/index.json`이 가리키는 ZIP 또는 thumbnail이 없으면 배포 도구는 해당 항목을 `깨짐` 상태로 표시한다. 깨진 항목은 삭제할 수 있고, 새 PNG target을 추가해 같은 id/version으로 재생성할 수 있다.
- 배포 삭제는 `asset-packs/index.json` 항목, `asset-packs/packages/{packId}` 전체, `asset-packs/thumbnails/{packId}.png`, stale staging/temp 폴더를 함께 정리한다.
- 배포 ZIP 생성 후에는 같은 ZIP을 로컬 `storage/asset_packs`에도 import해서 Asset Manager의 `팩 선택` 드롭다운에서 즉시 테스트할 수 있게 한다.
- 실제 적용 성공 여부는 의상은 `resources/tools/AssetManager/metadata/data.tsv`, UI Texture는 `resources/tools/AssetManager/metadata/ui_textures.tsv`와 UnityPy 검증에 의존한다.

## UnityPy Metadata Catalog Policy

`asset_catalog.json`과 `resources/tools/AssetManager/metadata/*.tsv`는 역할이 다르다.

| 파일 | 소유 계층 | 역할 | 현재 사용처 |
| --- | --- | --- | --- |
| `config/asset_catalog.json` | Electron/Renderer | 앱에서 보여줄 원본 대상 catalog와 pack target 작성 기준 | 원본 대상 선택, Catalog Editor, pack 배포 UI |
| `resources/tools/AssetManager/metadata/data.tsv` | UnityPy patcher | 기존 의상/texture target의 실제 patch metadata | `kind: "texture"` plan |
| `resources/tools/AssetManager/metadata/ui_textures.tsv` | UnityPy patcher | UI Texture2D target의 실제 patch metadata | `kind: "ui_texture"` plan |
| `resources/tools/AssetManager/metadata/fonts_data.tsv` | UnityPy patcher | font target metadata | font extract/patch/restore |

- `ui_textures.tsv`는 “UI가 아닌 모든 새 asset”을 담기 위한 catch-all 파일이 아니다. 이름 그대로 UI Texture2D patch API용 metadata이다.
- UI가 아닌 신규 asset category가 생기면, 먼저 UnityPy plan kind와 metadata TSV 이름/columns를 정하고, 이 문서의 표와 `assetPatcherService.ts` routing을 함께 갱신한다.
- 새 metadata 파일을 추가할 때는 `asset_catalog.json`의 `category` 값, pack target 작성 규칙, UnityPy metadata row, 배포 리소스 포함 여부를 한 세트로 관리한다.
- Catalog Editor의 metadata TSV tab은 `assetService.ts`의 metadata catalog registry를 기준으로 렌더링한다. 현재 registry는 `texture-data(data.tsv)`와 `ui-textures(ui_textures.tsv)`이며, 나중에 `sprite_texture`, `sound` 같은 catalog가 추가되면 registry에 key/label/path/columns/requiredColumns를 추가한다.
- `metadata/data.tsv`는 행이 많아질 수 있으므로 editor에서 `pathID` 또는 표시명 기준 정렬을 지원한다. 정렬은 화면 표시 순서용이며 저장 시 현재 편집 상태 전체를 TSV로 다시 기록한다.
- Catalog Editor는 `data.tsv`, `ui_textures.tsv`를 형식 검증 후 저장한다. `data.tsv`는 `size=width,height`, `ui_textures.tsv`는 `width/height`, `flip_y=true|false`를 검증한다.
- Catalog Editor row는 입력 중 `id`나 `pathID`가 바뀌어도 focus가 튀지 않도록 별도 `rowId`를 React key로 사용한다.
- Catalog Editor는 원본 preview 관리만 담당한다. 변경 PNG 선택은 pack 배포 도구 또는 직접 이미지 적용 흐름에서 처리한다.

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
- [x] `asset_catalog.json` v2 마이그레이션 완료
- [x] pack.json v2 검증 강화
