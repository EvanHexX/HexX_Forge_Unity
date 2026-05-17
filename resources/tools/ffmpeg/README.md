# FFmpeg Runtime Files

이 폴더는 HexX Forge의 Graphics Tool이 사용하는 FFmpeg 실행 파일을 두는 위치입니다.

## 왜 파일을 커밋하지 않는가

FFmpeg Windows build는 크기가 크고 GitHub 일반 Git 파일 제한을 넘을 수 있습니다. 정식 배포 저장소에서 다시 받을 수 있으므로, repo에는 바이너리를 포함하지 않고 이 안내만 유지합니다.

## 필요한 파일

아래 파일을 이 폴더에 배치합니다.

- `ffmpeg.exe`
- `ffprobe.exe`

`ffplay.exe`는 현재 앱 preview flow에서 필수 파일이 아닙니다.

## 권장 출처

- FFmpeg 공식 사이트: https://ffmpeg.org/download.html
- Windows build 안내: https://www.gyan.dev/ffmpeg/builds/

## 배치 예시

```text
resources/tools/ffmpeg/ffmpeg.exe
resources/tools/ffmpeg/ffprobe.exe
```

release 패키징 또는 새 저장소 동기화 후에는 위 파일이 존재하는지 확인합니다.
