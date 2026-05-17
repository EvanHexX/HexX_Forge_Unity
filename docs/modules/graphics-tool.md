# Graphics Tool

## 2026-05-11 Preview Filter Policy

- Video Tool preview는 FFmpeg/frei0r를 실시간 실행하지 않고 visible canvas 크기의 renderer canvas pass로 근사한다.
- canvas pass 실행 조건에는 `Chroma Key: Advanced`, `Key Spill: Advanced`, `Alpha Channel: Adjust`, `Color Grading`, Image Tool `Background alpha`가 모두 포함되어야 한다.
- Image Tool `Background alpha`는 preview와 export가 같은 key color/tolerance/softness 기준을 사용한다.
- `config/graphics_presets.json`의 filter/color preset labels는 UI에 직접 노출되므로 `en`, `ko`, `zh-CN` 문자열을 UTF-8로 유지한다.

## 2026-05-16 Chroma Key Export / Preview Policy

- Video Tool export의 portrait 합성 base는 `nullsrc`가 아니라 `color=c=black@0,format=rgba` 투명 source를 사용한다.
- Chroma Key: Advanced preview는 Shotcut `select0r`의 `shape`, `edge`, `operation`, `invert` 값을 alpha 조합에 반영한다. export는 bundled frei0r `select0r`가 source of truth이며 preview는 interactive 근사다.
- `Slope` slider는 Shotcut UI와 동일하게 `Edge` 종류와 상관없이 항상 표시한다. 다만 preview에서 edge mode별 영향은 Shotcut/frei0r 의미에 맞춰 다르게 근사한다.
- brush mask preview는 `1200 x 1500` portrait mask를 현재 media transform/source aspect ratio에 맞춰 잘라 source-local preview canvas로 매핑한다. 단순 전체 scale로 되돌리면 transform이 들어간 소스에서 마스크 위치가 어긋난다.
- Alpha Channel: Adjust preview는 chroma/key spill 이후 alpha buffer에 mode별 approximation을 적용한다. shrink/grow/blur 계열은 주변 alpha sampling으로 근사하고, export는 main process의 native FFmpeg alpha `lut` approximation을 따른다.
- Video/Image Tool layout은 content 최대 폭을 두고, 넓은 창에서는 preview/editor 영역 왼쪽과 filter/settings 영역 오른쪽의 2-column 구성을 유지한다. 화면 폭이 충분히 넓으면 `Object Transform`과 `Canvas Overlay Settings`를 오른쪽 컬럼 안에서 나란히 배치하고, filter section은 전체 오른쪽 컬럼 폭을 사용해 내부 filter cards를 2-column으로 재배치한다.

## 2026-05-11 Seek-Then-Play Policy

- `VideoPreviewController.seek(seconds)`는 `Promise<void>`를 반환한다.
- `seek()`는 `currentTime`을 설정한 뒤 `seeked` 이벤트 또는 짧은 timeout fallback으로 commit되었다고 판단될 때 resolve한다.
- `play()`는 마지막 seek 목표 시간이 남아 있고 현재 video 위치와 다르면 먼저 `await seek(lastCommandedTime)`을 수행한 뒤 `video.play()`를 호출한다.
- 이 순서는 paused 상태에서 timeline seek 후 Play가 0초부터 시작되는 Electron/Chromium race condition을 막기 위한 Graphics Tool preview 정책이다.
- Stop만 `currentTime = 0` reset을 수행하며, Pause/Play/Seek는 reset state를 공유하지 않는다.
- `hexx-resource://selected-media` video preview는 Chromium media seek를 위해 byte range response가 필요하다. Main process custom protocol은 `Range` 요청을 `206 Partial Content`로 처리하고 `Accept-Ranges`, `Content-Range`, `Content-Length`를 반환한다.

## 2026-05-11 Video Preview Controller Update

- Video Tool preview video의 소유권은 `CanvasFilteredMedia`가 가진다.
- Parent인 `VideoTool`은 `HTMLVideoElement`를 직접 조작하지 않고 `VideoPreviewController`의 `play()`, `pause()`, `stop()`, `seek()`만 호출한다.
- `playing`, `seekRequest`, `stopRequest` prop으로 media command를 전달하지 않는다. 이 방식은 React state update와 native media event가 서로 끊어먹는 race condition을 만들 수 있다.
- `onPlaybackState`는 ref로 보관하고 event listener effect dependency에 넣지 않는다. callback identity 변화로 listener를 재등록하고 즉시 `setCurrentTime`을 호출하면 `Maximum update depth exceeded`가 재발할 수 있다.
- `play()` promise의 `AbortError`는 normal interruption으로 처리한다. 빠른 Pause, source 교체, component unmount 중 발생할 수 있으므로 사용자 console error로 남기지 않는다.
- Draw loop는 재생 중 `requestVideoFrameCallback`을 우선 사용하고, pause/seek 상태에서는 필요한 프레임만 redraw한다.

## 목적

Graphics Tool은 게임 초상화 교체에 필요한 비디오, 이미지, 리깅 준비 작업을 한 화면에서 처리하는 도구다. 현재 기준 게임은 `LongYinLiZhiZhuan`이며, 이후 다른 게임을 추가할 수 있도록 출력 규격, 오버레이 자산, 필터 프리셋을 `config/graphics_presets.json`으로 분리한다.

## Portrait 좌표계

- 기본 좌표계는 `1200 x 1500`이다.
- 고화질 출력은 `1200 x 1500`, 표준 출력은 `560 x 700`이다.
- UI의 `X`, `Y`, `Scale` 값은 기본 좌표계를 기준으로 저장하고, 표준 출력 시 같은 비율로 축소한다.
- 캔버스는 항상 `4:5` 비율을 유지한다.
- 입력 이미지나 영상이 캔버스 밖으로 넘치면 preview와 export 모두 같은 좌표계로 crop한다.

## 리소스 규칙

기본 그래픽 자산은 `resources/graphics`에 둔다.

- `silhouette.png`: 초상화 위치 기준 실루엣 오버레이.
- `guide_lines.png`: 인게임 작은 초상화 영역을 보여주는 가이드 오버레이.
- `rigging_mockup.png`: 과거 목업 참고 이미지. 현재 Rigging Tool 화면은 MUI UI로 직접 구성한다.

Renderer는 직접 파일 경로를 읽지 않고 `hexx-resource://graphics/...` 프로토콜을 사용한다. 이 프로토콜은 Electron main process에서 `resources/graphics` 아래 파일만 안전하게 해석한다.

## 공통 Canvas Overlay

Video Tool과 Image Tool은 같은 portrait canvas와 overlay 상태를 공유한다.

- `S`: silhouette overlay on/off.
- `G`: guide overlay on/off.
- `A`: alpha channel view on/off.
- 입력 필드에 포커스가 있을 때는 단축키를 무시한다.
- silhouette opacity와 guide color는 Graphics Tool 내부의 `Canvas Overlay Settings` 패널에서 조정한다.
- overlay opacity와 color는 preview 보조 표시 전용이며 export 결과에는 반영하지 않는다.

이 설정은 전역 Settings가 아니라 Graphics Tool 안에 둔다. 작업 중 source마다 확인용으로 자주 바뀌는 값이며, 앱 전체 동작을 바꾸는 preference가 아니기 때문이다. 나중에 저장이 필요하면 `config/graphics_presets.json` 또는 별도 user settings 파일로 persistence를 추가한다.

## Video Tool

Video Tool은 다음 기능을 제공한다.

- 영상 파일 선택과 preview.
- portrait canvas 안에서 위치와 크기 조정.
- Play, Pause, Stop 재생 제어.
- loop 만들기.
- VP8 alpha WebM export.
- 오디오 포함 또는 제거.
- Shotcut 기반 필터 목록과 접히는 상세 설정.
- key color 입력 옆 color picker.
- color preset, saturation, contrast, alpha channel, chroma key, key spill 변경의 실시간 preview 근사.

Loop 만들기는 중요한 선택이므로 MUI Dialog로 확인한다. 이미 자연 루프인 영상은 처리할 필요가 없다는 문구를 보여준 뒤, 사용자가 계속하면 원본 영상과 역재생 영상을 이어 붙인다. 완료 결과는 임시/선택 출력 파일로 저장한 뒤 현재 Video Tool source로 다시 로딩한다.

FFmpeg는 앱에 포함 배포한다. 예상 위치는 `resources/tools/ffmpeg/ffmpeg.exe`, `resources/tools/ffmpeg/ffprobe.exe`이다. `ffplay.exe`는 HTML video preview를 사용하므로 필요하지 않다. Graphics Tool 진입 시 실행 가능 여부와 frei0r 지원 여부를 검사하고, 누락 또는 실행 실패는 `NotificationContext`로 알린다. Settings의 런타임 파일 점검도 같은 FFmpeg/frei0r 검증 결과를 사용해 업데이트 후 누락 상태를 미리 확인한다.

기본 export 정책:

- codec: `libvpx`
- alpha pixel format: `yuva420p`
- GOP: `-g 30`
- B-frame/lag: `-lag-in-frames 0`
- progressive/deinterlace: `bwdif`
- resize/crop quality: `lanczos`
- optional interpolation: `minterpolate`

Loop export는 원본 해상도를 보존하는 loop-only export로 처리한다. loop 생성 시에는 portrait crop/resize를 적용하지 않고, 재압축 품질 저하를 줄이기 위해 `-deadline best`, `-cpu-used 0`, `-b:v 8M`, `-maxrate 12M`, `-bufsize 16M`, audio 포함 시 `libvorbis -q:a 6`을 사용한다.

FFmpeg 작업은 `-progress pipe:1`을 사용해 renderer로 `graphics:progress` 이벤트를 보낸다. renderer는 진행 중 indeterminate 또는 percentage progress bar를 표시하고, 완료/실패는 `NotificationContext`로 알린다.

Shotcut 기반 필터 registry와 parameter mapping은 `docs/modules/graphics-filters.md`를 기준으로 관리한다.

Color preset은 `config/graphics_presets.json`의 `videoFilters.colorPresets` 배열로 전달한다.

```json
[
  {
    "id": "soft_warm",
    "labels": {
      "en": "Soft Warm",
      "ko": "부드러운 웜톤",
      "zh-CN": "柔和暖色"
    },
    "preview": {
      "brightness": 1.02,
      "contrast": 1.04,
      "saturation": 1.08,
      "sepia": 0.08,
      "hueRotate": 0
    },
    "ffmpeg": {
      "eq": {
        "brightness": 0.01,
        "contrast": 1.04,
        "saturation": 1.08,
        "gamma_r": 1.03
      }
    }
  }
]
```

`preview`는 viewport의 CSS/canvas 근사값이고, `ffmpeg.eq`는 최종 export filter 값이다.

## Image Tool

Image Tool은 Video Tool과 같은 portrait canvas, overlay, guide, alpha view, transform UI를 공유한다.

비투명 배경 제거는 v1에서 컬러키 방식으로 처리한다.

- key color
- tolerance
- edge softness
- key color 입력 옆 color picker

export는 투명 PNG로 저장한다. 배경 제거 적용, export 성공, export 실패, 파일 선택 실패는 모두 `NotificationContext`로 표시한다.

## Rigging Tool

Rigging Tool의 최종 목표는 Unity 2D animation preset에 맞춰 사용자 이미지를 분할하고, atlas PNG와 ingame 교체 정보 파일을 생성하는 것이다.

v1에서는 실제 atlas 생성 기능을 구현하지 않는다. 현재는 스크린샷 1개 구성을 기준으로 MUI 컴포넌트 기반 mockup UI를 제공한다.

현재 mockup UI:

- 상단 toolbar icon buttons.
- 좌측 캐릭터 preview placeholder.
- 수평 guide lines, 수직 중심선, colored anchor points.
- 우측 기준점 설정 rows.
- 가이드 표시와 캐릭터 선택 checkbox.
- part preview grid.
- 내보내기 설정과 TODO notification.

후속 구현 범위:

- preset별 분할 기준점 표시.
- 사용자 사진 위에 분할 위치 표시.
- part별 crop.
- atlas packing.
- Unity/ingame 교체용 정보 파일 생성.

## 알림과 확인창 원칙

- 중요한 선택은 `window.confirm`이 아니라 MUI Dialog를 사용한다.
- 성공, 실패, 누락, 주의 상태는 기존 `NotificationContext`의 `showNotification`을 사용한다.
- 예: FFmpeg 누락, 파일 로드 실패, loop 생성 완료/실패, export 성공/실패, 배경 제거 적용, rigging TODO action.

## 확장 설정

`config/graphics_presets.json`은 다음 역할을 가진다.

- 기준 게임 ID.
- portrait 기준 좌표계.
- output preset 크기.
- overlay asset 파일명.
- color correction preset 목록.
- Shotcut 기반 filter registry.
- rigging mockup 상태.

다른 게임을 추가할 때는 UI 상수와 로직을 직접 늘리기보다 이 설정 구조를 확장하는 방향을 우선한다.

## 2026-05-11 Timeline / Drag-and-drop Notes

- Video Tool timeline seek는 React state request만 신뢰하지 않고, renderer가 실제 hidden `HTMLVideoElement` ref를 잡아 `currentTime`, `play()`, `pause()`를 직접 제어한다.
- `Stop`만 0초 reset을 수행한다. 일반 seek/play 경로는 stop/reset state와 공유하지 않는다.
- hidden video native event가 seek 직후 0초를 publish할 수 있으므로, parent state는 마지막 user seek guard를 유지하고 stale `0` publish를 무시한다.
- timeline ruler 위에는 MUI `Tooltip`을 두지 않는다. ruler 클릭/드래그가 pointer event를 직접 받아야 하기 때문이다.
- Video Tool과 Image Tool은 native dialog 외에 drag-and-drop 입력을 지원한다.
- Drop된 `File`은 preload에서 Electron `webUtils.getPathForFile()`로 OS path를 얻은 뒤 main process `graphics:resolve-dropped-file`에서 확장자와 존재 여부를 검증한다.
- 검증된 파일만 기존 `hexx-resource://selected-media/?path=...` URL로 renderer에 반환한다.
- 지원 확장자는 Video `mp4/mov/webm/mkv/avi`, Image `png/jpg/jpeg/webp/bmp`이다.
