# Asset Manager

## 목적

Unity 기반 게임의 텍스처, 의상, 폰트, 어셋 파일을 안전하게 백업하고 교체한다.

현재 1차 대상 게임은 용윤입지전이다.

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
resources/AssetManager/
storage/backups/
storage/asset_packs/
````

## 현재 구현됨

### 백업

* 폰트 백업 상태 표시
* 어셋 백업 상태 표시
* 폰트/어셋 체크박스 선택
* 백업 실행 버튼
* 전체복원 버튼 UI만 존재

### 원본 카탈로그

* `config/asset_catalog.json` 기반 원본 텍스처 목록 사용
* `gender`, `type`, `textureName`, `pathId`, `preview` 기준 관리
* 남/녀가 같은 textureName을 사용할 수 있으므로 `id` 기준으로 구분

### 미리보기 UI

* 원본 미리보기 표시
* 변경 이미지 직접 선택
* 원본/변경 이미지 좌우 비교
* preview 이미지는 사용자가 직접 제공하는 파일을 사용
* Python으로 원본 이미지를 실시간 추출하지 않음

### Python 연동 방향

Electron은 Python 내부 함수를 직접 호출하지 않는다.

반드시 다음 방식으로 실행한다.

```text
AssetManager_UnityPy.exe --plan patch_plan.json --report patch_report.json
```

개발 중에는 Python 모듈 실행을 사용할 수 있지만, 배포 기준은 exe 실행이다.

## Python API 계약

Python 쪽 실행 파일은 `resources/AssetManager/` 아래에 둔다.

권장 구조:

```text
resources/
  AssetManager/
    AssetManager_UnityPy.exe
    metadata/
      data.tsv
      fonts_data.tsv
    originals/
    work/
      plans/
      input/
      output/
    reports/
```

Electron 쪽은 다음을 담당한다.

```text
1. patcher root 계산
2. 필요한 폴더 생성
3. plan JSON 생성
4. exe 실행
5. report JSON 읽기
6. exit code와 report.status 확인
```

## Clothes Patch Plan 핵심 구조

```json
{
  "kind": "clothes",
  "dry_run": false,
  "stop_on_error": true,
  "texture_metadata_path": "metadata/data.tsv",
  "jobs": [
    {
      "request": {
        "game_id": "LongYinLiZhiZhuan",
        "category": "clothes",
        "option1": "female",
        "option2": "천산파",
        "texture_name": "skeleton_17",
        "pathID": 156,
        "size": [
          940,
          2061
        ]
      },
      "assets_file": "D:/Games/.../sharedassets1.assets",
      "png_file": "D:/Temp/skeleton_17.png",
      "atlas_file": null,
      "output_assets_file": null,
      "originals_dir": "originals",
      "flip_y": true
    }
  ]
}
```

## 중요한 설계 결정

* atlas 파일 경로는 React에서 직접 넘기지 않는다.
* atlas 처리는 Python 쪽 metadata/data.tsv 기준으로 처리한다.
* 동일한 textureName이 남/녀 모두에 존재할 수 있으므로 `catalogId` 또는 `id` 기준으로 구분한다.
* 원본 미리보기 이미지는 게임 파일에서 추출하지 않고 사용자가 제공한다.
* 변경팩 preview가 있으면 변경팩 preview를 표시한다.
* preview가 없으면 변경 PNG를 표시한다.
* 변경 PNG도 없으면 원본 preview를 fallback으로 표시한다.

## 구현 상태 추적

### 구현됨

* 백업 상태 UI
* 백업 실행 UI
* 원본/변경 이미지 비교 UI
* `useTextureCatalog()` 기반 카탈로그 로딩
* 직접 변경 이미지 선택
* Python API 방식 확인
* exe 기반 patch 실행 서비스 설계

### 진행 중

* Asset Pack zip 등록 UI
* Asset Pack manifest 구조
* Pack target 선택 UI
* Pack preview 자동 연결

### TODO

* 전체복원 실제 구현
* asset pack 목록 표시
* asset pack target 선택
* pack target 기반 patch 실행
* patch 실행 로그 UI
* 실패 시 report 표시
* 원본 백업 존재 여부 표시
* 복합 asset 교체 지원
* 폰트 관리자 분리 또는 통합 여부 결정

### 마지막 변경 내역

| 날짜         | 변경 내용                                | 관련 파일                                       |
|------------|--------------------------------------|---------------------------------------------|
| 2026-05-02 | Asset Manager 백업 UI 및 미리보기 비교 UI 정리  | `AssetManager.tsx`, `assetService.ts`       |
| 2026-05-02 | Python API 계약 기준으로 exe 실행 방식 확정      | `assetPatcherService.ts`, `API_contract.md` |
| 2026-05-02 | 원본 미리보기는 사용자 제공 preview 파일을 사용하기로 결정 | `asset_catalog.json`, `AssetManager.tsx`    |


좋습니다. 지금 단계는 꽤 중요한 전환점이라 문서 정리가 특히 중요합니다.
먼저 **docs 업데이트 내용 → 그 다음 계획** 순서로 정리하겠습니다.

---
## 이미지 로딩 방식

기존에는 `file://` 또는 data URL 방식으로 이미지를 로드하려 했으나,
Electron Renderer에서 `Not allowed to load local resource` 문제가 발생하고,
data URL 방식은 이미지 수 증가 시 메모리 사용량 문제가 있기 때문에 변경하였다.

현재는 Electron custom protocol을 사용한다.

### Protocol

```text
hexx-resource://preview/{path}
hexx-resource://asset-pack/{packId}/{path}
````

### 동작 방식

* Renderer는 `hexx-resource://` URL을 사용하여 이미지를 요청한다.
* Main Process에서 `protocol.handle()`을 통해 실제 파일을 읽어 반환한다.
* 필요할 때만 로드되므로 메모리 효율적이다.

### 장점

* file:// 보안 문제 해결
* data URL 대비 메모리 사용량 감소
* 이미지 수 증가에도 안정적
---

## Asset Pack 구조 (최종)

```text
{packId}.zip
├─ pack.json
├─ files/
├─ previews/
```

### preview 표시 우선순위

1. target.preview (완성형 이미지)
2. target.png (fallback)
3. 원본 catalog preview

## UI 구조 (최종 방향)

### 1. 원본 선택

- 종류
- 성별
- 원본 텍스처
- 원본 미리보기

### 2. 변경 방식 선택

#### A. 의상팩
- 의상팩 선택
- 해당 원본에 적용 가능한 target 목록
- 변경 미리보기

#### B. 직접 이미지
- PNG 선택
- 변경 미리보기

### 3. 적용
---
## 설계 결정 (추가)

- UI 기준은 "원본 텍스처"
- 의상팩은 "변경 후보" 역할
- 동일 원본에 여러 의상팩 적용 가능
- 의상팩 선택 시 원본 자동 동기화
- 직접 이미지 방식과 의상팩 방식은 동일 슬롯 공유
---

# 🚀 다음 단계 계획

지금 상태:

```text
✔ Asset Pack import
✔ pack.json 파싱
✔ preview 로딩 (protocol)
✔ 기본 UI 표시
```

---
