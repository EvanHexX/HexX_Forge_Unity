# Mod Manager

## 🎯 목적

BepInEx 기반 DLL 모드를 관리한다.

---

## 📂 대상 경로

```text
{gamePath}/BepInEx/plugins      ← 활성 DLL
{gamePath}/BepInEx/config       ← 설정 파일 (cfg)
storage/disabled_mods/          ← 비활성 DLL
storage/packages/{packageId}/   ← 패키지 비-DLL 파일 (script, config, asset)
config/mod_list.json            ← 패키지 메타데이터 DB
```

---

## 📦 구조

```text
mod_list.json:
{
  "packages": {
    "{uuid}": { id, name, author, description, packageType, dllPaths[], files[], version?, source? }
  },
  "mods": {
    "relative/path.dll": { name, author, description, packageId? }
  }
}
```

GitHub catalog로 설치된 package는 `version`과 `source`를 저장한다.

```json
{
  "version": "1.0.0",
  "source": {
    "type": "github",
    "catalogId": "sample-mod",
    "downloadPath": "mods/packages/sample-mod/1.0.0/sample-mod.zip"
  }
}
```

---

## ⚙️ 기능

### 1. 스캔

- plugins 및 disabled_mods 하위 재귀 탐색 (*.dll)
- mod_list.json 기준 패키지 단위로 그룹핑
- 결과 타입: `ModPackage[]`

### 2. 활성 / 비활성

- 패키지 토글: 패키지 내 모든 DLL 이동
- 개별 DLL 토글: 해당 DLL만 이동
- EXDEV 대응: rename 실패 시 copy → unlink

### 3. 패키지 타입

| 타입           | 설명                     |
|--------------|------------------------|
| `single`     | DLL 1개                 |
| `collection` | DLL 여러 개, 테이블에서 접기/펼치기 |

### 4. mod-info.json 스키마

```json
{
  "name": "패키지 이름",
  "author": "제작자",
  "description": "설명",
  "packageType": "collection | single",
  "files": [
    {
      "path": "test.dll",
      "name": "표시 이름",
      "author": "제작자",
      "type": "dll | asset | mod-info | script | config | folder",
      "dependsOn": "modpack | <dllPath> | \"\""
    }
  ]
}
```

**파일 타입 규칙:**

- `dll` — 활성화 대상 DLL
- `asset` — 종속 에셋 파일
- `mod-info` — 하위 mod-info.json (packageType은 single만 가능)
- `script` — 설정 UI용 configurator JSON
- `config` — BepInEx/config 내 직접 편집 대상 cfg
- `folder` — 삭제 시 함께 제거할 폴더 (공통 폴더명 사용 지양)

**dependsOn:**

- `"modpack"` 또는 `""` — 패키지 전체에 종속
- `"relative/path.dll"` — 특정 DLL에 종속

**BepInEx 기준 경로:**

- 새로 패킹되는 DLL은 `plugins/*.dll` 경로를 표준으로 한다.
- 활성화 시 `plugins/MyMod.dll`은 `{gamePath}/BepInEx/plugins/MyMod.dll`로 이동한다.
- 기존 legacy `MyMod.dll` 항목은 migration 없이 계속 인식하지만, 새 패킹/설치 결과는 `plugins/MyMod.dll` 형식을 우선한다.

### 5. 모드 추가 다이얼로그

상단 탭을 `온라인` / `로컬`로 분리한다.

**온라인 탭:**

- GitHub raw catalog를 읽어 등록된 모드를 표시한다.
- catalog 위치: `https://raw.githubusercontent.com/EvanHexX/HexX_Forge_Unity/main/mods/index.json`
- ZIP 다운로드는 같은 raw base URL에 `downloadPath`를 붙여 수행한다.
- catalog schema는 `mods/index.json`의 `schemaVersion: 1` 형식을 따른다.
- 설치된 GitHub 모드는 `source.catalogId`와 `version`으로 최신 버전 여부를 비교한다.
- 업데이트는 기존 package 삭제 후 새 ZIP import 방식으로 처리하며, 기존 package가 활성 상태였으면 가능한 경우 다시 활성화한다.

**로컬 탭:**

- 단일 DLL 파일은 기존처럼 metadata 입력 후 추가한다.
- ZIP은 `mod-info.json` 또는 `hexx-mod-info.json`이 있는 패킹 ZIP만 허용한다.
- ZIP 내부 목록은 읽기 전용 preview로 표시하며 type/name/author를 수정하지 않는다.
- `packageType: "single"` ZIP은 내부 DLL이 정확히 1개여야 한다. 0개 또는 2개 이상이면 설치를 차단한다.

**ZIP 모드 (inspect flow):**

1. "파일 추가 (DLL / ZIP)" 버튼 — 툴팁으로 사용 방법 안내
2. ZIP 선택 → `inspectZip` 호출
3. ZIP 내 파일/폴더 목록을 테이블로 표시
    - mod-info.json 있음: 메타데이터 pre-fill + 불일치 항목 경고 표시
    - mod-info.json 없음: 로컬 추가에서는 설치 차단, 패킹에서는 사용자 입력 기반 재생성
4. 패킹 Dialog에서는 각 항목 행에 파일타입 Select, 이름/제작자 TextField, 경고 아이콘, **삭제 버튼**을 표시한다.
    - `ErrorOutlineIcon` (red): mod-info에 선언됐으나 ZIP에 없음
    - `WarningAmberIcon` (yellow): ZIP에 있으나 mod-info에 없음, 또는 공통 폴더명
    - `folder` 타입 항목은 삭제 버튼으로 목록에서 제거 가능
5. 모드 추가 Dialog에서는 ZIP 목록을 읽기 전용으로 표시한다.
6. "추가" → `importZipConfigured(zipPath, config)` 호출

**DLL 모드:**

- 파일 목록에 DLL 추가 후 일괄 등록 (`createAndImportPackage`)
- "파일 추가" 버튼 반복 클릭으로 DLL 여러 개 추가 가능
- 필드: 패키지타입, 표시이름, 제작자, 설명, 파일별 이름/제작자
- 타입 Select 표시 (DLL은 고정값 `dll`)
- collection 타입 시 각 DLL의 `{name}.json` + `mod-info.json` 생성 후 임시 zip으로 import

### 8. DLL 충돌 방지 (변경: 추가는 허용, 활성화 시 경고)

`importDllMod` 실행 시:

1. `mod_list.mods[relativePath]` 이미 등록됐으면 **에러 없이** 현재 목록 반환 (중복 스킵)
2. `plugins/` 또는 `disabled_mods/` 에 파일이 이미 존재하면 복사 없이 mod_list에만 등록
3. 미존재 시 `disabled_mods/`로 복사 후 등록

`setPackageEnabled(id, true)` / `setDllEnabled(path, true)` 실행 시:

- 대상 plugins/ 경로에 DLL이 이미 존재하면 해당 DLL 이동 **스킵** + `warnings[]` 반환
- UI에서 warnings를 `showNotification(msg, 'warning')` (우하단 toast) 으로 표시

### 12. 모드 패킹 다이얼로그

모드 배포자용: DLL/ZIP 파일들을 mod-info.json이 포함된 배포 ZIP으로 패킹

- 헤더의 "모드 패킹" 버튼 (`ArchiveIcon`) → `PackModDialog` 열기
- Dialog는 Sidebar 제외 콘텐츠 영역 대부분을 사용한다.
- 우측 상단 `?` 아이콘은 `docs/modules/mod-packing-guide.md` 설명서를 팝업으로 표시한다.
- 단계형 흐름:
    - Step 1: 패키지타입, 패키지이름, 제작자, 설명
    - Step 2: DLL/ZIP 파일 추가 및 내부 파일 확인
    - Step 3: 설정 Script 작성
- 패키지 이름, 제작자, 설명은 필수이며, 입력 전에는 Step 2/3과 다음 버튼이 비활성화된다.
- ZIP/DLL 다중 등록 또는 전체 DLL 항목 2개 이상인 경우 packageType은 `collection`으로 고정되고 `single`로 되돌릴 수 없다.
- 파일 추가 (DLL / ZIP)
    - DLL 파일은 `plugins/{fileName}` 경로로 추가하며, 2개 이상이면 자동으로 `collection` 전환
    - ZIP 파일은 `inspectZip`으로 내부 파일/폴더 전체 목록을 읽고 패킹 목록 테이블로 표시
    - ZIP에 mod-info가 없어도 패킹용 source로 허용하며, 패킹 시 최상위 `mod-info.json`을 생성한다.
    - ZIP 내부 root DLL이 발견되면 `plugins/` 기준 변환 확인을 띄우고, 확인 시 모든 non-mod-info entry 앞에 `plugins/`를 붙인다.
    - 단일 ZIP 소스는 ZIP 내부 파일을 다시 묶고 최상위 `mod-info.json` 1개를 생성
    - 여러 ZIP/DLL 소스는 각 소스별 `{sourceName}.json`을 생성해 최상위 `mod-info.json`에 `type: "mod-info"` 항목으로 등록
    - 기존 ZIP 안의 `mod-info.json` / `hexx-mod-info.json`은 그대로 복사하지 않고 패킹 시 사용자가 입력한 값으로 재생성
- ZIP 추가 시 Step 1의 제작자 값이 내부 파일 제작자의 기본값으로 들어간다.
- DLL과 folder type은 패킹 테이블에서 type 변경을 허용하지 않는다. `.dll`이 아닌 파일은 DLL 타입으로, 폴더가 아닌 항목은 folder 타입으로 변경할 수 없다.
- 같은 source 파일 또는 같은 normalized ZIP entry 경로는 중복 등록할 수 없다.
- ZIP inspect에서 `mod-info.json`의 folder 항목은 trailing slash 유무와 관계없이 같은 폴더로 인식한다.
- 파일 경로에서 parent folder를 자동 합성할 때 최상위 `plugins/`는 제외하고 전용 하위 폴더만 표시한다.
- 경로는 `BepInEx` 기준으로 작성한다. 예: `config/*.cfg`, `plugins/...`, `patchers/...`
- 여러 DLL과 asset이 섞인 ZIP은 권장하지 않는 구성으로 경고 표시
    - ZIP 목록 하단에 전체 파일을 표시
    - DLL이 2개 이상이면 `Depends On` 선택 컬럼을 열어 asset/config/script가 특정 DLL 또는 package/modpack에 종속되도록 지정 가능
- 저장 경로 선택 (`dialog.showSaveDialog`)
- "패킹" → `packMod(data)` IPC 호출
    - 배포 ZIP을 지정 경로에 저장
    - 로컬 모드 관리자에 **비활성 상태**로 추가

### 9. config/asset 자동 배포

`setPackageEnabled(id, true)` 호출 시 `deployPackageFiles` 실행:

- `config` 타입 파일 → `BepInEx/` 기준 상대 경로로 복사 (대상 미존재 시만, 비파괴)
- `asset` 타입 파일 → `BepInEx/` 기준 상대 경로로 복사 (대상 미존재 시만, 비파괴)
- `folder` 타입 파일 → 비활성화/삭제 시 `BepInEx/` 기준 상대 경로의 폴더 삭제 대상

### 10. 중첩 mod-info 처리

`resolveNestedModInfo(zip, infoFile, visited)`:

- `mod-info` 타입 파일 항목 재귀 파싱
- `visited` Set으로 무한 루프 방지
- 중첩 mod-info의 `packageType: 'collection'` 불허 (강제로 `single`)

### 11. ZIP inspect 결과 타입

```ts
type ZipInspectResult = {
    hasModInfo: boolean;
    modInfo: { name, author, description, packageType } | null;
    entries: ZipEntryInfo[];
    warnings: string[];
};

type ZipEntryInfo = {
    entryName: string;
    isDirectory: boolean;
    size: number;
    suggestedType: ModFileType;
    fromModInfo: boolean;
    modInfoData?: { name?, author?, type?, dependsOn? };
    mismatch?: 'missing_in_zip' | 'missing_in_modinfo';
};
```

### 6. 삭제

- packages: 패키지 디렉터리 + 모든 DLL + folder 항목 삭제
- standalone DLL: 해당 파일만 삭제

### 7. 설정 팝업 (script/config)

- script 파일: configurator JSON 파싱 → 섹션/필드 렌더링
    - `switch` → BepInEx cfg key 읽기/쓰기 (applyCfgValue)
    - `image_picker` → 파일 선택, 이미지/webm 미리보기, 적용 시 plugins 경로 복사
- script v1 `features[]` 지원
    - `cfg_fields`: BepInEx 기준 cfg 경로와 자동 생성 필드를 정의한다. cfg 파일이 아직 없으면 "모드를 한 번 실행한 뒤 다시 열기" 경고를 표시한다.
    - `file_manager`: 관리명, BepInEx 기준 폴더, 허용 확장자를 정의한다. 설정 UI에서 import/delete를 제공하며 delete는 앱이 import해 manifest에 기록한 파일만 허용한다.
    - `json_manager`: 관리명, BepInEx 기준 JSON 경로, 샘플 JSON, 추론 필드를 정의한다. JSON 파일이 없으면 샘플로 생성하고, 있으면 지정 path 값만 갱신한다.
- config 파일: BepInEx/config/{path} 텍스트 직접 편집
- [적용] → 변경값 일괄 저장 / [닫기] → 다이얼로그 종료

#### script v1 예시

```json
{
  "type": "configurator",
  "version": 1,
  "features": [
    {
      "id": "file_manager_1",
      "type": "file_manager",
      "name": "의상변경",
      "targetDir": "plugins/MyMod/Costumes",
      "extensions": ["png", "webp"],
      "fields": []
    },
    {
      "id": "json_manager_1",
      "type": "json_manager",
      "name": "프리셋 설정",
      "jsonPath": "plugins/MyMod/settings.json",
      "sample": { "enabled": true, "scale": 1 },
      "fields": [
        { "id": "enabled", "label": "enabled", "ui_type": "switch", "jsonPath": "enabled", "default": true },
        { "id": "scale", "label": "scale", "ui_type": "number", "jsonPath": "scale", "default": 1 }
      ]
    }
  ]
}
```

#### 설정 파일 작성 흐름

- `PackModDialog` Step 3의 "설정 Script 작성"에서 CFG 필드 / 파일관리 / JSON 파일관리를 추가한다.
- 새 기능 카드는 기본 접힘 상태로 생성되며, 펼침 아이콘으로 열어 편집한다.
- 파일관리 기본 이름은 `어셋파일관리`이다.
- 파일관리는 패킹 Step 2에서 추가된 JSON entry를 `linkedConfigPath`로 선택하고, 문자열 배열 JSON path를 `linkedConfigArrayPath`로 기록할 수 있다.
- 폼으로 작성한 내용은 `settings.configurator.json` 미리보기 JSON으로 표시된다.
- 생성 JSON 아래에는 실제 설정 Dialog와 유사한 read-only UI 미리보기를 표시한다.
- v1에서는 생성 JSON을 직접 수정하지 않는다. 고급 직접 편집은 TODO로 분리한다.
- 패킹 시 ZIP에 `settings.configurator.json`을 포함하고 `mod-info.json.files[]`에 `{ "path": "settings.configurator.json", "type": "script" }`로 등록한다.
- 파일관리 manifest는 `storage/packages/{packageId}/settings-managed-files.json`에 저장한다.

---

## 📊 테이블 컬럼

| 컬럼       | 설명                                      |
|----------|-----------------------------------------|
| 사용       | Checkbox (collection: indeterminate 지원) |
| (expand) | collection이면 ▶/▼ 아이콘                    |
| 모드 이름    | 패키지 표시 이름 + 컬렉션 뱃지                      |
| 제작자      | 패키지 제작자                                 |
| 상태       | Chip: 활성/비활성/혼합                         |
| 설정       | SettingsIcon (설정 없으면 greyed out)        |
| 삭제       | DeleteIcon                              |

- 행 hover 하이라이트
- 우클릭 컨텍스트 메뉴: 모드관리, 상세정보, 모드설정, 삭제
- 비활성 행 opacity 45%
- collection 펼침 시 child DLL 행 들여쓰기 표시

---

## 📁 변경 파일 목록 (구현 이후)

| 파일                                             | 변경 내용                                                                                                                                                                                                                                                                                 |
|------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `src/main/services/modService.ts`              | 전면 재작성; `inspectZip`, `importZipWithConfig`, `resolveNestedModInfo`, `deployPackageFiles`, `suggestFileType`, **`packMod`** 추가; 패킹 시 DLL/ZIP source 입력, nested mod-info 재생성, ZIP 내부 asset 포함 지원; 충돌 시 에러→스킵+경고로 변경; `setPackageEnabled`/`setDllEnabled` → `{ packages, warnings }` 반환 |
| `src/main/ipc/modIpc.ts`                       | IPC 핸들러 추가 (set-package-enabled, set-dll-enabled, delete-package, get-package-settings, apply-cfg-value, read-config-text, write-config-text, copy-resource, select-file, create-and-import, inspect-zip, import-zip-configured, **pack-mod**, **select-save-path**)                  |
| `src/preload/preload.ts`                       | API 메서드 추가 (setPackageEnabled, setDllEnabled, deletePackage, getPackageSettings, applyCfgValue, readConfigText, writeConfigText, copyResource, selectFile, createAndImportPackage, inspectZip, importZipConfigured, **packMod** source 입력, **selectSavePath**)                        |
| `src/renderer/pages/ModManager.tsx`            | 전면 재작성: PackModDialog 추가, 패킹 DLL/ZIP 선택, ZIP inspect 목록 표시, `Depends On` 지정 UI, ZIP 항목 삭제 버튼, 파일추가 툴팁, 전역 알림 훅 연동, 충돌 warning 표시                                                                                                                                                      |
| `src/renderer/types/modTypes.ts`               | 신규: renderer 공유 타입 (ModPackage, PackageSettings, ScriptField, ZipEntryInfo, ZipInspectResult, **ToggleResult**)                                                                                                                                                                       |
| `src/renderer/context/NotificationContext.tsx` | **신규**: 전역 알림 시스템 (우하단 고정 Stack, 클릭 해제, success/info 4초 자동 소멸)                                                                                                                                                                                                                        |
| `src/renderer/App.tsx`                         | `NotificationProvider`로 앱 전체 래핑                                                                                                                                                                                                                                                       |

---

## ⚠️ TODO / 제한

- [x] script의 `mod-info` 중첩 처리 — `resolveNestedModInfo` 재귀 파싱 구현
- [x] 모드 활성화 시 config/asset 파일 자동 배포 — `deployPackageFiles` 구현
- [x] folder type: ZIP inspect 시 공통 폴더명 경고 + 목록에서 **삭제 가능**
- [x] 복합 모드 (DLL + Asset 등) 지원 — `importZipConfigured` 로 per-file 타입 지정 가능
- [x] DLL 충돌 방지: 추가 시 에러 없이 스킵; 활성화 시 충돌 경고 toast 표시
- [x] ZIP inspect flow — mod-info 있음/없음 분기, 불일치 경고 아이콘, 파일타입 Select
- [x] 알림 시스템 — 앱 우하단 고정 stack, 클릭 해제, success 4초 자동 소멸 (`NotificationContext`)
- [x] 모드 패킹 — `PackModDialog`: DLL/ZIP→배포 ZIP 생성 + 로컬 비활성 등록
- [x] 패킹 ZIP import: ZIP 내부 asset 목록 표시, 단일 ZIP은 최상위 mod-info 1개 생성, 여러 ZIP/DLL은 nested mod-info로 등록
- [x] 파일 추가 버튼 툴팁 — DLL/ZIP 선택 가이드
- [ ] 작은 화면 UI: TableContainer `overflowX: auto` 처리 완료; 모바일 레이아웃 미지원
- [ ] `deployPackageFiles`: 대상 파일 이미 존재 시 덮어쓰기 옵션 미제공 (현재 skip)
- [ ] 네스팅 3단계 이상 mod-info 검증 미구현 (2단계까지만 실용적 지원)
## 2026-05-10 Script Builder linked JSON

- `CFG 필드`의 생성 JSON preview는 전역 하단이 아니라 해당 CFG feature card 내부에 둔다.
- CFG 파일 읽기 버튼으로 파일을 선택하면 `BepInEx 기준 cfg 경로`는 기존 값과 무관하게 `config/{선택한 파일명}`으로 갱신한다.
- ZIP root 기준 변환으로 표시 경로에 `plugins/`가 붙어도, ZIP 내부 파일 읽기는 원본 `sourceEntryName`을 우선 사용한다.
- 파일관리 `linkedConfigPath`는 JSON 내용을 즉시 수정하지 않고 metadata와 preview/editor 입력으로만 사용한다.
- object array JSON은 `file`, `fileName`, `path`, `name`, `id` 후보 key를 `linkedConfigValueKey`로 기록할 수 있다.
- `files: { "path/file.png": { ...metadata } }` 같은 object map JSON은 `linkedConfigTargetPath`, `linkedConfigFilterKey`, `linkedConfigFilterValue`, `linkedConfigAssetPath`, `linkedConfigSelectedFields` metadata로 대상/필터/등록 asset/입력 필드를 기록한다.
- 파일관리 linked JSON 필터는 기본값을 자동 강제하지 않는다. 단일 확장자 모드처럼 필터가 필요 없으면 `필터 없음` 상태로 두고, 필요할 때만 사용자가 `type` / `png` 등을 선택한다.
- ResourceInjector 형식의 `files` object map은 런타임 파일 추가/삭제와 연동한다. 예: `targetDir = plugins/ResourceInjector/portraits/png`, `linkedConfigPath = plugins/ResourceInjector/config/portrait_file_infos.json`이면 `test.png` 추가 시 JSON key는 `files["portraits/png/test.png"]`가 된다.
- 파일관리 설정 UI는 체크된 metadata field를 사용자 입력으로 받고, 체크 해제된 field는 `linkedConfigFieldDefaults` 값을 고정 기본값으로 기록한다. 삭제 시 managed file과 linked JSON entry를 함께 제거한다.
- 일반 `.json` 파일은 기본 type을 `config`로 추론한다. `mod-info.json` / `hexx-mod-info.json`만 `mod-info`로 취급한다.
- mod-info가 없는 ZIP을 패킹 source로 읽으면 생성 예정 `mod-info.json`을 목록에 표시하되, 원본 ZIP에서 복사하지 않고 패킹 시 새로 생성한다.
- linked JSON은 `linkedConfigTargetPath`와 `linkedConfigKeyTemplate`을 기준으로 entry를 추가/삭제한다. `$` placeholder는 추가 파일명으로 치환한다.
- linked JSON 대상 path의 UI 표기는 `/` 구분자를 사용한다. 예: `root`, `files`, `files/pngs`. 기존 `files.pngs`처럼 저장된 legacy dot path도 main/renderer에서 계속 읽는다.
- 파일관리의 `연동 JSON 내용` editor는 접을 수 있으며 기본적으로 접힌 상태로 열린다.
- JSON key 생성 규칙 입력 후 field preview가 사라지지 않도록, 선택 path의 candidate가 없으면 현재 JSON object map에서 즉시 field 후보를 재구성한다.
- `연동 배열 JSON path`와 `JSON key 생성 규칙`의 예시는 placeholder가 아니라 Tooltip으로 안내한다. 빈 path는 편집 중 강제로 `root`를 다시 채우지 않고 preview/apply 시 root로 해석한다.
- 파일관리 script builder의 “등록한 어셋 파일 선택” control은 제거했다. field preview용 파일명은 Step 2 asset 목록에서 확장자가 맞는 첫 파일을 사용하고, 없으면 `test.{extension}`을 사용한다.
- Electron native dialog 이후 TextField 입력이 잠기는 회귀를 줄이기 위해 PackModDialog는 focus trap/restore를 완화하고 native dialog 종료 후 focus를 정리한다.
- linked JSON은 UTF-8 BOM 또는 선두 invisible character가 있어도 preview/candidate 추론과 런타임 add/delete에서 정상 parse해야 한다. editor에는 원문을 보존하고 내부 parse에서만 sanitize한다.
- 모드 설정 저장 시 `configText` 직접 편집 내용은 먼저 저장하고, 이후 file_manager add/delete가 linked JSON 최종 상태를 반영한다. 삭제 버튼은 pending 상태에서 중복 클릭할 수 없다.
## Package Dependency

- 패키지 단위 종속성은 `mod-info.json` 최상위와 `config/mod_list.json` package metadata의 `dependency` 필드로 기록한다.
- Schema:

```json
{
  "dependency": {
    "target": "main-mod-catalog-id-or-package-name",
    "displayName": "Main Mod"
  }
}
```

- 기존 `files[].dependsOn`은 파일 단위 의존성으로 유지한다. 패키지 종속성과 혼동하지 않는다.
- dependency target 매칭 순서: `source.catalogId` → package `id` → package `name`.
- 종속 모드 활성화 시 main mod가 없거나 비활성 상태이면 활성화를 차단한다.
- main mod 비활성화/삭제 시 활성화된 종속 모드가 있으면 먼저 종속 모드를 비활성화하거나 삭제하라는 오류로 차단한다.
- DLL이 없는 asset-only package도 패키지로 유지한다. 이 경우 `dllPaths: []`와 package-level `enabled` flag로 활성 상태를 저장한다.
- Mod Manager 목록은 main/root package를 먼저 보여주고, dependent package는 parent 아래 tree row로 들여쓴다. dependency expand state와 collection DLL expand state는 별도로 관리한다.

## Package Version

- `mod-info.json` 최상위 `version`은 모드 패키지 버전이다. 예: `"version": "1.0.0"`.
- `version`은 local pack/import와 GitHub catalog install 모두 `config/mod_list.json` package metadata에 저장한다.
- Mod Manager 목록과 상세 Dialog는 package `version`을 표시한다.
- 온라인 catalog는 `mods/index.json`의 `mods[].version`을 최신 버전으로 보고, 설치된 package `version`과 비교해 update 가능 여부를 계산한다.

## Online Mod Upload Test

1. Mod Packing에서 ZIP을 만들고 version을 입력한다.
2. repo에 `mods/packages/{modId}/{version}/{modId}.zip` 경로로 ZIP을 추가한다.
3. `mods/index.json`에 catalog item을 추가하거나 version/downloadPath를 갱신한다.
4. `downloadPath`는 raw base URL 기준 상대 경로를 쓴다. 예: `mods/packages/sample-mod/1.0.0/sample-mod.zip`.
5. push 후 앱의 온라인 탭은 `https://raw.githubusercontent.com/EvanHexX/HexX_Forge_Unity/main/mods/index.json`을 읽는다.
