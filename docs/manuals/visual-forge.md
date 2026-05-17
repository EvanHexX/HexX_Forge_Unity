# Visual Forge 사용설명서

## 개요

Visual Forge는 게임 초상화 작업에 필요한 영상, 이미지, 리깅 준비 기능을 모아 둔 화면입니다. 영상 또는 이미지를 portrait canvas에 맞추고, 배경 제거, 필터 preview, WebM 또는 PNG export 작업을 진행할 수 있습니다.

현재 기능은 portrait 작업을 중심으로 확장 중입니다. Rigging Tool은 실제 atlas 생성 전 단계의 mockup UI이며, 일부 기능은 TODO 상태입니다.

## 시작하기 전 준비

1. 작업할 영상 또는 이미지 파일을 준비합니다.
2. 투명 배경이 필요한 경우 key color가 분명한 소스를 준비하면 작업이 쉽습니다.
3. WebM export가 필요한 경우 앱에 포함된 FFmpeg 리소스가 정상인지 확인합니다.
4. 출력물을 게임에 적용하려면 Asset Forge의 백업 상태도 함께 확인합니다.

[스크린샷: 어떤내용의 스크린샷을 넣어주세요 - Visual Forge 첫 화면에서 Video Tool, Image Tool, Rigging Tool 탭이 보이는 화면]

## 화면 구성

- Video Tool: 영상 파일을 불러와 위치, 크기, 재생 구간, 필터, export를 조정합니다.
- Image Tool: 이미지 파일을 불러와 위치, 크기, 배경 제거, PNG export를 조정합니다.
- Rigging Tool: 향후 리깅 작업을 위한 기준점과 part preview를 확인하는 mockup 영역입니다.
- Canvas Overlay Settings: silhouette, guide, alpha view 같은 확인용 overlay를 조정합니다.
- Preview Canvas: 실제 portrait 비율에 맞춘 작업 결과를 확인합니다.

## 주요 기능 사용 방법

### 영상 파일 불러오기

1. Video Tool을 엽니다.
2. 파일 선택 버튼을 누르거나 지원 파일을 화면에 끌어다 놓습니다.
3. preview canvas에 영상이 표시되는지 확인합니다.
4. Play, Pause, Stop 버튼으로 재생 상태를 확인합니다.

지원 확장자는 `mp4`, `mov`, `webm`, `mkv`, `avi`입니다.

### 영상 위치와 크기 조정

1. X, Y, Scale 값을 조정합니다.
2. preview canvas에서 portrait 영역 안에 주요 피사체가 들어오는지 확인합니다.
3. silhouette 또는 guide overlay를 켜서 인게임 위치를 맞춥니다.
4. 필요한 경우 alpha view를 켜서 투명도 상태를 확인합니다.

[스크린샷: 어떤내용의 스크린샷을 넣어주세요 - Video Tool에서 silhouette와 guide overlay를 켠 preview 화면]

### Loop 만들기

1. Video Tool에서 원본 영상을 불러옵니다.
2. Loop 만들기 버튼을 누릅니다.
3. 확인창에서 안내를 읽고 진행합니다.
4. 완료되면 생성된 loop 영상이 현재 source로 다시 로드됩니다.

이미 자연스럽게 반복되는 영상은 Loop 만들기를 다시 실행하지 않아도 됩니다.

### 필터와 배경 처리

1. Chroma Key, Key Spill, Alpha Channel, Color Grading 같은 필터 영역을 엽니다.
2. key color와 tolerance를 조정합니다.
3. preview에서 가장자리와 투명도를 확인합니다.
4. 최종 export 전에 짧은 구간으로 결과를 확인합니다.

preview는 빠른 확인을 위한 근사값입니다. 최종 export 결과와 완전히 같지 않을 수 있으므로 중요한 작업은 export 결과를 다시 확인하세요.

### WebM export

1. 영상 위치, 크기, 필터, audio 포함 여부를 확인합니다.
2. export 버튼을 누릅니다.
3. 저장 위치를 선택합니다.
4. 진행 상태가 끝날 때까지 기다립니다.
5. 완료 알림이 표시되면 출력 파일을 확인합니다.

### 이미지 배경 제거와 PNG export

1. Image Tool을 엽니다.
2. 이미지 파일을 선택하거나 끌어다 놓습니다.
3. key color, tolerance, edge softness를 조정합니다.
4. preview에서 배경 제거 상태를 확인합니다.
5. PNG export를 실행합니다.

지원 확장자는 `png`, `jpg`, `jpeg`, `webp`, `bmp`입니다.

### Rigging Tool 확인

Rigging Tool은 현재 기준점과 part preview를 보여주는 준비 화면입니다. 실제 atlas 생성과 인게임 교체 정보 생성은 아직 구현 범위 밖입니다.

1. Rigging Tool 탭을 엽니다.
2. 기준선, anchor point, part preview 배치를 확인합니다.
3. TODO 알림이 표시되는 동작은 아직 실제 출력 파일을 만들지 않습니다.

## 주의사항

- export 중에는 원본 파일을 이동하거나 삭제하지 마세요.
- FFmpeg 리소스가 누락되면 영상 export가 실패할 수 있습니다.
- preview canvas는 작업 확인용이며, 최종 결과는 export 파일을 기준으로 확인하세요.
- Stop만 0초로 돌아가는 동작입니다. Pause나 seek 후 Play는 선택한 위치를 유지하는 것이 정상입니다.
- Rigging Tool의 미구현 기능은 실제 게임 파일을 만들지 않습니다.

## 자주 겪는 상황

### Play를 눌렀는데 영상이 바로 움직이지 않습니다

seek 직후에는 위치 적용이 끝날 때까지 짧게 기다릴 수 있습니다. 계속 멈춰 있으면 파일 형식과 경로를 확인한 뒤 다시 불러오세요.

### 배경 가장자리가 지저분합니다

key color, tolerance, edge softness를 조금씩 조정하세요. 원본 배경색이 균일할수록 결과가 좋습니다.

### export가 실패합니다

출력 경로 권한, 파일명, FFmpeg 리소스 상태, 원본 파일 접근 여부를 확인하세요. 실패 알림에 복사 가능한 진단 정보가 있으면 함께 확인합니다.

## 스크린샷 삽입 위치

- [스크린샷: 어떤내용의 스크린샷을 넣어주세요 - Video Tool에서 영상과 timeline이 보이는 화면]
- [스크린샷: 어떤내용의 스크린샷을 넣어주세요 - Image Tool에서 배경 제거 설정과 preview가 보이는 화면]
- [스크린샷: 어떤내용의 스크린샷을 넣어주세요 - Rigging Tool의 기준점과 part preview mockup 화면]
