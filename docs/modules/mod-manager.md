# Mod Manager

## 🎯 목적

BepInEx 기반 DLL 모드를 관리한다.

---

## 📂 대상 경로

```text
{gamePath}/BepInEx/plugins
```

---

## 📦 구조

```text
plugins/
storage/disabled_mods/
config/mod_list.json
```

---

## ⚙️ 기능

### 1. 스캔

- plugins 하위 폴더 포함 재귀 탐색
- *.dll 대상

### 2. 활성 / 비활성

```text
활성:
plugins/

비활성:
storage/disabled_mods/
```

### 3. EXDEV 대응

```
rename 실패 시:
copy → unlink
```

### 4. 모드 추가

### DLL

- 직접 선택
- 이름 / 제작자 입력

### ZIP

- DLL 자동 추출
- info 파일 자동 파싱

### 5. 삭제

- plugins 또는 disabled_mods에서 제거

---

## 📊 표시 컬럼

```
사용
표시 이름
제작자
파일 경로
상태
삭제
```

---

## ⚠️ 문제 / TODO

### 1. 작은 화면 UI 깨짐

- 테이블 overflow 처리 필요

### 2. 복합 모드 (DLL + Asset)

- 현재 미지원

예:
```
plugins/
config/
asset/
```
---
### 패키지 기반 모드
* mod-info.json 예시
```json
{
  "name": "test mod",
  "author": "HexX",
  "description": "테스트 모드 인포",
  "files": [
    {
      "path": "test.dll",
      "name": "테스트 최적화 도구",
      "author": "HexX"
    }
  ]
}
```
---

## 구현 및 수정 내용 
* 다음은 위의 내용에서 수정 및 추가할 사항을 표시한다.
  1. mod-info.json 내용에 추가/변동/확인 사항
     - 최상단의 name, author,description은 모드팩의 용이고, 하단 files는 실제 DLL 파일의 정보를 담는다.
     - package type 항목을 추가하고, 모드들의 모음(collection)인지 1가지 모드(single)인지 타입을 구분한다.  
     - files는 최소 1개 이상의 DLL 파일을 포함해야 한다.
     - files 내의 path는 DLL 파일의 경로를 나타내며, name은 DLL 파일의 표시 이름을 나타낸다.
     - author는 DLL 파일의 제작자를 나타낸다.
     - files 내에 항목에 type을 추가하여 DLL, Asset, mod-info, script, config, folder인지 구분한다.
     - asset, config, folder 인경우, 종속된 모드가 무엇인지 표시하는 항목을 추가하고, 그것이 최상단의 모드팩인경우, 모드팩에 포함된 어떤 dll의 종속인 경우를 구분하여 표시한다. 모드팩인경우의 입력값은 "modpack" 또는 "" 이고 나머지는 path를 입력하여 표시한다.
     - folder의 경우, 삭제에 대응하기위한 입력값이므로, 해당모드 또는 패키지 삭제 시 폴더도 삭제한다. 그러므로 모드패키지 작성 시 data, assets 과 같이 공통적으로 포함될 가능성이 있는 이름은 폴더를 입력하지 않도록 권고해야한다.
     - mod-info인경우, 해당모드팩에 포함된 files 정보를 입력한 json파일이고, 그 경우 path에있는 해당 json파일의 내용을 files에 입력된 것과 같이 대응한다. 해당 json의 package type은 collection일 수 없다.
     - script는 해당 모드의 설정 기능이 복잡할경우 UI와 기능 구현용 json 파일이다. 
      
  2. 페이지 내의 테이블 레이아웃변경사항
      - 모드관리자 내의 각 항목(행) 마우스 오버시 하이라이트한다.
      - 표시할 내용: 사용, "", 모드 이름, 제작자, 상태, 설정, 삭제
      - 사용 해제 시, 해당 행 비활성화 표시 (mui 또는 config/themes.json 이용)
      - "" 열은 모드타입이 collection인 경우에 > 형태의 아이콘 표시하여 접고 펼 수 있고 펼친경우 하위 모드들을 보여준다.기본표시 접힘.
      - 모드타입이 collection 인 경우 사용 체크 해제시 모음 내의 모드들 전부 같이 해제. 모음내의 모드들의 사용체크상태가 복합적일때 체크표시 변경하여 표시  
      - 설정은 각 행에 설정아이콘을 @mui/icons-material에서 가져와서 넣고, 설정항목이 없는 행은 greyed out.
      - 설정 클릭 시, 해당 asset의 json파일의 asset type이 script, config인 것들을 이용하여 팝업창에 표시한다. 팝업창 UI 순서는 모드이름, script grid, config 목록, 적용, 닫기버튼
      - script를 먼저 표시하고, 아래에 config의 목록을 표시한다. config목록의 파일을 클릭 시 해당 txt파일을 로드하여 표시하고 직접 변경 후 적용버튼 누르면 수정됨
      - script파일은, 아래의 예제와 같은 방식으로 해서, 미리 구현해둔 기능을 이용하고 UI표시는 grid로 예쁘게 표시할 수 있도록한다.
      - ```json
        {
        "type": "configurator",
        "sections": [
        {
        "title": "1. 기본 설정",
        "fields": [
        {
        "id": "enable_high_func",
        "label": "문파 건물 고급 기능 해금",
        "ui_type": "switch",
        "target": {
        "type": "cfg",
        "path": "config.cfg",
        "section": "1. 기본 설정",
        "key": "Enable"
        },
        "default": true
        }
        ]
        },
        {
        "title": "2. 리소스 설정",
        "fields": [
        {
        "id": "mod_icon_replace",
        "label": "아이콘 이미지 교체",
        "ui_type": "image_picker",
        "action": "replace_resource",
        "accept": ".png",
        "preview": true,
        "target_path": "assets/icon.png"
        }
        ]
        }
        ]
        }
        ```
     - script에 현재 구현할 기능은 위의 json의 예제를 참고하고, 탐색기열어 파일선택기능, 적용시 선택한 파일 지정경로로 복사, 선택한 파일이 이미지/webm이면 미리보기, 
  3. 최상단 버튼 "모드 추가" 시 현재 바로 파일 탐색기로 넘어가는데, 모드추가용 팝업창을 띄운다.
     - 팝업창에는 파일추가 버튼을 제공하고, 현재의 "모드 추가" 버튼의 기능을 연결한다.
     - 아래는 정보가 있다면 자동입력되는 입력 필드를 깔끔하게 정렬하여넣는다. 내용은 표시이름, 제작자, 파일경로, 추가파일목록, 파일타입 등 위의 내용 참고하여 빠진것 없도록 한다.
2. 모드관리자 내의 각 항목(행) 마우스 오버시 하이라이트
- 각 행의 마우스 우클릭 시 모드관리, 상세정보, 모드설정, 삭제
- /docs/README.md 의 규칙을 따른다.
