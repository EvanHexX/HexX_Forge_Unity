# Synthesis Lab 사용설명서

## 개요

Synthesis Lab은 전략 분석과 최적화 도구 연결을 준비하는 화면입니다. 현재는 기존 PySide6 기반 optimizer 실행 연동이 구현되지 않았고, placeholder 화면과 splash preview만 제공합니다.

이 문서는 현재 사용할 수 있는 부분과 앞으로 구현될 예정 기능을 구분해 설명합니다.

## 시작하기 전 준비

현재 Synthesis Lab은 optimizer 실행 파일을 선택하거나 실행하는 기능을 제공하지 않습니다. 따라서 화면 확인 외에 별도 준비는 필요하지 않습니다.

향후 optimizer 연동이 구현되면 다음 준비가 필요할 수 있습니다.

- optimizer 실행 파일 위치 확인
- 분석에 사용할 게임 데이터 또는 설정 파일 준비
- 결과를 저장할 폴더 권한 확인

[스크린샷: 어떤내용의 스크린샷을 넣어주세요 - Synthesis Lab placeholder 화면 전체]

## 화면 구성

- 제목 영역: Synthesis Lab 기능 영역을 표시합니다.
- 안내 문구: 현재 준비 중인 기능을 설명합니다.
- 예정 기능 목록: learning, decision, resource, simulation, custom skill 관련 항목을 보여줍니다.
- Splash Preview: 공용 splash overlay를 확인하기 위한 임시 preview입니다.

## 현재 사용할 수 있는 기능

### 예정 기능 목록 확인

1. Sidebar에서 Synthesis Lab을 선택합니다.
2. 화면의 안내 문구를 읽습니다.
3. 표시된 예정 기능 목록을 확인합니다.

현재 목록은 실제 optimizer 실행 기능이 아니라 개발 예정 범위를 보여주는 안내입니다.

### Splash Preview 닫기

1. Synthesis Lab 진입 시 preview overlay가 열릴 수 있습니다.
2. 닫기 동작으로 overlay를 종료합니다.
3. 안내 화면을 확인합니다.

## 예정 기능

다음 기능은 현재 사용자 기능으로 제공되지 않습니다.

- optimizer 실행 파일 경로 설정
- Electron에서 optimizer 실행
- 분석 결과 확인
- simulation 또는 decision helper UI
- 리소스 추천 또는 전략 분석 workflow

구현 전까지 Synthesis Lab에서 별도 최적화 계산을 실행할 수 없습니다.

## 주의사항

- 현재 Synthesis Lab은 placeholder이므로 게임 파일이나 분석 데이터를 변경하지 않습니다.
- Splash Preview는 최종 optimizer UI가 아닙니다.
- 외부 optimizer를 수동으로 실행하는 경우 HexX Forge가 그 실행 상태를 추적하지 않습니다.
- 실제 연동 기능이 추가되면 실행 파일 경로와 권한 설정이 필요할 수 있습니다.

## 자주 겪는 상황

### optimizer 실행 버튼이 없습니다

정상입니다. 현재 버전에서는 optimizer 실행 기능이 구현되어 있지 않습니다.

### Splash Preview가 계속 보입니다

현재 화면에 포함된 임시 preview입니다. 닫은 뒤 안내 내용을 확인하면 됩니다.

### 분석 결과를 저장할 수 있나요

현재 Synthesis Lab에서는 분석 실행과 결과 저장 기능을 제공하지 않습니다.

## 스크린샷 삽입 위치

- [스크린샷: 어떤내용의 스크린샷을 넣어주세요 - Synthesis Lab의 안내 문구와 예정 기능 목록이 보이는 화면]
- [스크린샷: 어떤내용의 스크린샷을 넣어주세요 - Synthesis Lab 진입 시 표시되는 Splash Preview 화면]
