# 모드 패킹 설명서

## 기준 폴더

모드 패킹은 게임 폴더의 `BepInEx` 폴더를 기준으로 합니다.

예시:

- DLL: `plugins/MyMod.dll`
- config: `config/MyMod.cfg`
- patcher: `patchers/MyPatcher.dll`
- asset/resource: 일반적으로 `plugins/MyMod/...`

`plugins/MyMod.dll`로 패킹된 파일은 설치 시 `{gamePath}/BepInEx/plugins/MyMod.dll` 위치에 배치됩니다.

## 기본 정보

패키지 이름, 제작자, 설명은 필수입니다.

이 세 항목을 입력해야 파일 추가 단계와 설정 Script 단계로 이동할 수 있습니다.

## DLL 파일 추가

단일 DLL 파일을 추가하면 경로 앞에 자동으로 `plugins/`가 붙습니다.

예시:

- 선택 파일: `CoolMod.dll`
- 패킹 경로: `plugins/CoolMod.dll`
- 설치 위치: `{gamePath}/BepInEx/plugins/CoolMod.dll`

여러 DLL 파일을 추가하거나 ZIP을 여러 개 추가하면 패키지 타입은 자동으로 `collection`이 됩니다. 이 경우 다시 `single`로 변경할 수 없습니다.

### 단일 DLL mod-info 예시

```json
{
  "name": "Cool Mod",
  "author": "Mod Author",
  "description": "단일 DLL 모드 예시입니다.",
  "packageType": "single",
  "files": [
    {
      "path": "plugins/CoolMod.dll",
      "name": "Cool Mod",
      "author": "Mod Author",
      "type": "dll"
    }
  ]
}
```

## ZIP 파일 추가

ZIP 파일 안에 `mod-info.json` 또는 `hexx-mod-info.json`이 없어도 패킹용으로 추가할 수 있습니다.

패킹 시 최상위 `mod-info.json`은 새로 생성됩니다. ZIP 내부에 기존 mod-info 파일이 있더라도 그대로 복사하지 않고, 현재 패킹 UI의 입력값으로 다시 생성합니다.

ZIP 내부의 모든 파일과 폴더는 목록에 표시됩니다. mod-info에 기록되지 않은 파일은 경고로 표시될 수 있습니다.

## Root DLL 경고

ZIP 안의 DLL이 루트에 있으면 설치 시 `{gamePath}/BepInEx` 바로 아래에 놓일 수 있습니다.

이 ZIP이 `plugins` 폴더 기준으로 만들어졌다면 기준 변경을 확인하고, 목록의 경로 앞에 `plugins/`를 붙여야 합니다.

예시:

```text
변경 전 ZIP 목록:
CoolMod.dll
CoolMod/config.json

기준 변경 후 패킹 목록:
plugins/CoolMod.dll
plugins/CoolMod/config.json
```

기준 변경은 해당 ZIP source의 목록에만 적용됩니다.

## 타입 제한

- `.dll` 파일만 `DLL` 타입으로 지정할 수 있습니다.
- 실제 폴더 항목만 `Folder` 타입으로 지정할 수 있습니다.
- 이미 DLL 또는 folder로 판정된 항목은 실수 방지를 위해 타입 변경을 막습니다.

## Folder 타입 주의

Folder 타입은 삭제 시 함께 제거될 폴더를 의미합니다.

`data`, `assets`, `plugins`, `config`처럼 다른 모드도 공유할 수 있는 공통 폴더명은 Folder 타입으로 포함하지 않는 것이 안전합니다.

전용 폴더 예시:

```json
{
  "path": "plugins/CoolMod",
  "type": "folder",
  "dependsOn": "plugins/CoolMod.dll"
}
```

이 항목이 있으면 모드 비활성화 또는 삭제 시 `{gamePath}/BepInEx/plugins/CoolMod` 폴더를 함께 정리할 수 있습니다.

보호되는 공용 최상위 폴더:

- `plugins`
- `config`
- `patchers`

## 중복 방지

같은 DLL/ZIP 파일을 두 번 추가할 수 없습니다.

패킹 결과 ZIP 안에서 같은 경로의 파일이 중복되는 경우에도 패킹을 막습니다. 예를 들어 `plugins/CoolMod.dll`이 이미 목록에 있으면 같은 경로를 가진 다른 파일을 추가할 수 없습니다.
