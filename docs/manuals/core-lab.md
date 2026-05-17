# Core Lab 사용설명서

## 개요

Core Lab은 게임 편의 기능과 분석 기능을 HexX Forge 안에서 다루기 위해 준비 중인 화면입니다. 현재는 최종 기능이 구현된 상태가 아니며, placeholder 화면과 예정 기능 안내만 제공합니다.

이 문서는 현재 화면에서 확인할 수 있는 내용과, 앞으로 추가될 예정인 기능을 구분해 설명합니다.

## 시작하기 전 준비

현재 Core Lab은 실제 Cheat Engine 연결, process attach, table 관리 기능을 제공하지 않습니다. 따라서 별도의 사전 준비 없이 화면 상태만 확인할 수 있습니다.

향후 기능이 구현되면 다음 준비가 필요할 수 있습니다.

- 지원 게임 설치 폴더 설정
- 실행 중인 게임 process 확인
- 사용할 cheat table 또는 project file 준비
- 기능 사용 전 저장 데이터 백업

[스크린샷: 어떤내용의 스크린샷을 넣어주세요 - Core Lab placeholder 화면 전체]

## 화면 구성

- 제목 영역: Core Lab이 준비 중인 기능 영역임을 표시합니다.
- 안내 문구: 현재 기능 상태를 설명합니다.
- 예정 기능 목록: memory, save data, process, table, custom skill 관련 항목을 보여줍니다.
- Splash Preview: 현재는 공용 splash overlay를 확인하기 위한 preview 동작이 포함되어 있습니다.

## 현재 사용할 수 있는 기능

### 예정 기능 목록 확인

1. Sidebar에서 Core Lab을 선택합니다.
2. 화면에 표시된 안내 문구를 읽습니다.
3. 예정 기능 목록을 확인합니다.

현재 목록은 실제 실행 가능한 기능 버튼이 아니라 개발 예정 범위를 보여주는 안내입니다.

### Splash Preview 닫기

1. Core Lab 진입 시 preview overlay가 열릴 수 있습니다.
2. 닫기 동작으로 overlay를 종료합니다.
3. 이후 Core Lab의 안내 화면을 확인합니다.

## 예정 기능

다음 기능은 현재 사용자 기능으로 제공되지 않습니다.

- 게임 process 선택
- Cheat Engine table 또는 project file 관리
- 게임별 cheat helper UI
- 안전한 실행 및 attach 흐름
- 저장 데이터 관련 편의 기능

구현 전까지 Core Lab에서 게임 메모리 값을 변경하거나 cheat table을 실행할 수 없습니다.

## 주의사항

- 현재 Core Lab은 placeholder이므로 게임 파일이나 process를 변경하지 않습니다.
- 외부 도구를 별도로 사용할 경우 HexX Forge가 그 동작을 관리하지 않습니다.
- 향후 process attach 기능은 게임과 보안 도구의 정책에 영향을 받을 수 있습니다.
- 저장 데이터 관련 기능이 추가되기 전까지 save data 백업은 사용자가 직접 관리해야 합니다.

## 자주 겪는 상황

### Core Lab에서 실행 버튼을 찾을 수 없습니다

정상입니다. 현재 버전에서는 실제 실행 기능이 구현되어 있지 않습니다.

### Splash Preview가 왜 표시되나요

공용 splash overlay를 확인하기 위한 임시 preview입니다. Core Lab의 최종 기능이 아닙니다.

### Cheat Engine table을 불러올 수 있나요

현재는 불러올 수 없습니다. table 관리 기능은 예정 항목입니다.

## 스크린샷 삽입 위치

- [스크린샷: 어떤내용의 스크린샷을 넣어주세요 - Core Lab의 안내 문구와 예정 기능 목록이 보이는 화면]
- [스크린샷: 어떤내용의 스크린샷을 넣어주세요 - Core Lab 진입 시 표시되는 Splash Preview 화면]
