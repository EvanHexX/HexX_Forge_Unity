# Architecture

## 🧠 전체 구조

HexX Forge는 다음 3계층 구조로 동작합니다.

```text
Renderer (React UI)
↓
Preload (Bridge)
↓
Main (Node + FS + OS)
```

---
## 📦 구성
### Renderer
- React
- Material UI
- 상태 관리 (useState / hooks)
### Preload
- contextBridge
- ipcRenderer wrapper 
### Main
- 파일 시스템 처리
- IPC 핸들러
- 모듈 로직

---
## 🔌 IPC 구조
```text
Renderer → Preload → Main
```
### 예:

```TypeScript
window.electronAPI.scanMods()
→ ipcMain.handle('mods:scan')
→ modService.scanMods()
```

---
## 📁 데이터 흐름
```text
config/
  → 설정

storage/
  → 사용자 데이터
  → 백업
  → 비활성 모드

gamePath/
  → 실제 게임 파일
```

---
## ⚠️ 핵심 설계 원칙
- 하드코딩 금지 (경로, 설정)
- 파일 삭제 최소화
- 상태는 항상 config 기반
- UI는 FS 직접 접근 금지 (IPC만 사용)

---
