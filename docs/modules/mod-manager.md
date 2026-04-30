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
## 🚀 향후 확장
### 패키지 기반 모드
```json
{
"files": [
{
"source": "...",
"target": "..."
}
]
}
```
---
## 🔥 중요 포인트
- DLL 단위가 아닌 "모드 패키지 단위"로 전환 필요
- 충돌 검사 필요

---
