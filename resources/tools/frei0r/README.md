# frei0r Runtime Files

이 폴더는 FFmpeg `frei0r` filter가 로드하는 Windows plugin DLL을 두는 위치입니다.

## 왜 파일을 커밋하지 않는가

frei0r plugin DLL은 외부 배포물이며, FFmpeg runtime과 함께 다시 받을 수 있습니다. repo에는 바이너리 대신 필요한 파일 목록과 배치 규칙만 기록합니다.

## 필요한 파일

현재 Graphics Tool export flow에서 확인된 plugin 파일은 다음과 같습니다.

- `filter/alpha0ps_alpha0ps.dll`
- `filter/keyspillm0pup.dll`
- `filter/saturat0r.dll`
- `filter/select0r.dll`

## 권장 출처

- frei0r 공식 프로젝트: https://frei0r.dyne.org/
- FFmpeg Windows build 배포본에 포함된 frei0r plugin package

## 배치 예시

```text
resources/tools/frei0r/filter/alpha0ps_alpha0ps.dll
resources/tools/frei0r/filter/keyspillm0pup.dll
resources/tools/frei0r/filter/saturat0r.dll
resources/tools/frei0r/filter/select0r.dll
```

새 개발 환경이나 release 패키징 환경에서는 FFmpeg와 frei0r 파일을 같은 시점에 준비합니다.
