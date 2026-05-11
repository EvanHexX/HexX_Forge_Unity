# HexX Forge 문서

HexX Forge는 Unity 기반 게임의 모드, 폰트, 어셋 패치를 관리하는 Electron + React 기반 데스크톱 도구입니다.

## 기술 스택

- Electron
- React
- TypeScript
- Vite
- Material UI
- Node.js File System API

## 모듈 문서

- Mod Manager: `docs/modules/mod-manager.md`
- Asset Manager: `docs/modules/asset-manager.md`
- Graphics Tool: `docs/modules/graphics-tool.md`
- Cheat Engine: `docs/modules/cheat-engine.md`
- Update Manager: `docs/modules/update-manager.md`
- Build Policy: `docs/modules/build-policy.md`
- Font Manager: `docs/modules/font-manager.md`
- Backup Manager: `docs/modules/backup-manager.md`
- Optimizer Launcher: `docs/modules/optimizer.md`
- Game Launch: `docs/modules/game-launch.md`
- Settings: `docs/modules/settings.md`

## 현재 상태

- Electron + React 기반 UI
- Sidebar 구조
- 표시 이름과 CSS variables를 포함하는 Theme 시스템
- 테마와 분리된 폰트 선택 설정
- Home 상태판, 업데이트 배지, GitHub Releases 뉴스 피드
- Settings 지원 게임별 설치 경로 설정
- Mod Manager 1차 구현
- Asset Manager 백업, 텍스처 교체, 어셋팩 적용, 폰트 추출/교체/복원 일부 구현
- Graphics Tool / Cheat Engine placeholder 연결

## Asset Manager 진행 상태

- 최신 상세 문서: `docs/modules/asset-manager.md`
- 구현 완료:
  - 백업 상태/실행 UI
  - MUI 백업 확인창 및 기존 백업 안내
  - 타입별 마지막 백업 1개 유지
  - 백업 파일 덮어쓰기 방식 복원
  - 백업 완료 Notification 연결
  - 원본 catalog 선택
  - custom protocol preview
  - Asset Pack import
  - pack target 선택
  - 직접 PNG 선택
  - 단일 적용
  - 팩 전체 적용 및 완료 Notification 연결
  - 텍스처/폰트 교체 작업 탭 분리
  - 폰트 추출
  - 폰트 추가
  - `storage/fonts` 기반 교체폰트 드롭다운
  - 13개 path id 폰트 교체 테이블
  - 현재폰트/교체폰트 미리보기 열
  - 선택 폰트 적용
  - 선택 폰트 적용 전 재확인 Dialog
  - 선택 폰트 적용 완료 Notification 연결
  - 실패 메시지 Notification 연결
  - `config/current_fonts.json` 기반 현재폰트 표시
  - `font_list` API 기반 현재폰트 동기화
  - 폰트 행 우클릭 복원
- 주요 TODO:
  - dry-run 버튼
  - patch 실행 로그 UI
  - report 상세 UI
  - 현재폰트 표시명 상세 정보 보강
  - `asset_catalog.json` v2 마이그레이션
  - pack.json v2 검증 강화

## 작업 규칙

공통 작업 규칙은 `docs/RULES.md`를 항상 참조합니다.
