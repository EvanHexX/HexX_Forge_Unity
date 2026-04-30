# HexX Forge 프로젝트 구조

HexX Forge는 Unity 기반 게임의 모드, 폰트, 어셋 패치를 관리하는 Electron + React 기반 데스크톱 도구이다.

현재 대상 게임은 용윤입지전이며, 기존 PySide6 기반 외부 exe 실행 방식으로 연결할 예정이며, 다른기능이 완전히 완성된 후 비급 최적화 도구는 Electron 내부로 포팅할 예정이다.

---
## 기술 스택

- Electron
- React
- TypeScript
- Vite
- Material UI
- Node.js File System API
---

## 📌 핵심 목적

- BepInEx 기반 모드 관리
- Unity Asset 패치 자동화
- 폰트 교체 및 관리
- 비급 최적화 도구 통합
- 향후 OCR / 번역 / 데이터 처리 확장

---
## 🧠 전체 구조

```text
HexX_Forge_Unity/
├─ src/                # 앱 코드
├─ config/             # 설정 및 메타데이터
├─ storage/            # 사용자 데이터 / 백업 / 모드 보관
├─ docs/               # 문서 (이 폴더)
```

---
## 📦 모듈 목록
- Mod Manager → ./modules/mod-manager.md
- Asset Manager → ./modules/asset-manager.md
- Font Manager → ./modules/font-manager.md
- Backup Manager → ./modules/backup-manager.md
- Optimizer Launcher → ./modules/optimizer.md

---
## 📐 설계 문서
- Architecture → ./architecture.md

---
## 📊 현재 상태
### 완료
- Electron + React 기반 UI
- Sidebar 구조
- Theme 시스템
- Mod Manager 1차 구현
- 설정 (게임 경로)
### 진행 예정
- Optimizer exe 연결
- Asset Manager
- Backup Manager
- Font Manager

---
## ⚠️ 규칙
- 모든 UI는 Material UI + sx 기반으로 작성
- 색상은 반드시 CSS 변수(theme) 사용
- 파일 이동은 삭제 대신 이동(move) 우선
- 어떤 기능을 구현하기 전에는 반드시 관련 문서를 지금 이 파일의 모듈 목록란에서 확인 후, 해당 기능의 기존 구현 여부와 TODO 상태를 먼저 확인한다.
- 기능을 구현한 후에는 해당 모듈 문서에 구현 상태, 변경 파일, 남은 TODO를 기록한다.
- CLI/AI 도구가 작업할 때도 위 문서 확인 → 구현 → 문서 갱신 순서를 따른다.

---