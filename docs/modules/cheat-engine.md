# Cheat Engine

## 목적

Cheat Engine 관련 작업을 HexX Forge 안에서 연결하기 위한 자리다.

현재는 메뉴와 빈 페이지를 먼저 연결한 상태이며, 실제 기능은 TODO로 남겨둔다.

---

## 메뉴 위치

- Sidebar: `Graphics Tool` 아래
- Page key: `cheat`
- Renderer: `src/renderer/pages/CheatEngine.tsx`

---

## 현재 구현

- Sidebar 메뉴 항목 추가
- 제목과 미구현 상태를 표시하는 빈 페이지 연결

---

## TODO

- Cheat Engine process selection
- table/project file management
- 게임별 cheat helper UI
- 안전한 실행/첨부 플로우 설계

---

## 변경 파일

| 파일 | 변경 내용 |
| --- | --- |
| `src/renderer/App.tsx` | `cheat` page route 추가 |
| `src/renderer/components/Sidebar.tsx` | `Cheat Engine` 메뉴 추가 |
| `src/renderer/pages/CheatEngine.tsx` | 신규 placeholder 페이지 |
| `docs/README.md` | 모듈 목록과 진행 상태 요약 갱신 |
| `docs/modules/cheat-engine.md` | 신규 모듈 문서 |
