
# 📅 개발 로드맵: Dynamic 2D Character Localization


## 1단계: 데이터 규격 정의 (JSON Schema)
가장 먼저 모드 매니저와 게임 플러그인이 주고받을 데이터 형식을 확정합니다.

*   [ ] **기본 정보:** 캐릭터 ID, 이름, 텍스처 파일 경로.
*   [ ] **영역 설정(Rect):** Body, Head, Eyes, Mouth 등 부위별 픽셀 좌표(`x`, `y`, `width`, `height`).
*   [ ] **관절 설정(Pivot):** 목(Neck), 어깨(Shoulder) 등 애니메이션의 중심축이 될 픽셀 좌표.
*   [ ] **레이어 순서:** 각 부위의 출력 우선순위(Sorting Order) 정의.

## 2단계: 마스터 어셋 번들 제작 (Unity)
플러그인이 런타임에 덮어씌울 "뼈대" 역할을 할 프리팹을 제작합니다.

*   [ ] **표준 스켈레톤 설계:** `Spine`이나 `Unity 2D Animation`을 이용해 기본 숨쉬기(Idle) 애니메이션 제작.
*   [ ] **슬롯 구조화:** `Head_Slot`, `Body_Slot` 등 부위별로 `SpriteRenderer`를 미리 배치.
*   [ ] **스크립트 태깅:** 플러그인이 특정 부위를 쉽게 찾을 수 있도록 각 오브젝트에 고유 이름 또는 Tag 부여.
*   [ ] **어셋 번들 빌드:** `Character_Base.assetbundle` 생성.

## 3단계: 모드 매니저(C# / Desktop App) 기능 구현
사용자가 좌표를 입력하고 데이터를 생성하는 도구를 만듭니다.

*   [ ] **이미지 로더:** 통 PNG를 불러와 화면에 표시.
*   [ ] **좌표 추출 UI:**
    *   이미지 위 클릭/드래그를 통해 부위별 Rect 영역 지정 기능.
    *   중심축(Pivot) 포인트 지정 기능 (예: 목 위치 찍기).
*   [ ] **JSON 익스포터:** 설정한 좌표를 규격화된 `metadata.json`으로 저장.
*   [ ] **프리뷰(선택 사항):** 입력한 좌표를 바탕으로 간단한 움직임 미리보기.

## 4단계: BepInEx 플러그인(Unity Plugin) 개발
게임 런타임에서 실제 이미지를 교체하고 애니메이션을 연결합니다.

*   [ ] **파일 감지:** 특정 폴더의 PNG 및 JSON 파일 로드.
*   [ ] **런타임 스프라이트 생성:** `Sprite.Create()`를 사용하여 JSON의 `Rect`와 `Pivot`을 적용한 부위별 Sprite 생성.
*   [ ] **어셋 주입(Injection):**
    *   어셋 번들에서 마스터 프리팹 인스턴스화.
    *   각 부위의 `SpriteRenderer`에 생성한 Sprite 할당.
*   [ ] **본 리타게팅(Bone Re-targeting):** 사용자가 지정한 Pivot 좌표에 맞춰 실제 Bone의 `localPosition` 조정.

## 5단계: 최적화 및 테스트
*   [ ] **메모리 관리:** 캐릭터 교체 시 이전 `Texture2D` 및 `Sprite` 객체 적절히 파괴(Destroy).
*   [ ] **예외 처리:** JSON 파일 누락이나 잘못된 좌표값 입력 시 기본 이미지 출력 처리.
*   [ ] **성능 테스트:** 여러 명의 캐릭터가 동시에 화면에 나타날 때 프레임 드랍 확인.

---

### 🛠️ 주요 기술 스택
*   **Language:** C#
*   **Engine:** Unity 2022+ (2D Animation Package)
*   **Platform:** BepInEx 6 (IL2CPP)
*   **Data:** JSON (Newtonsoft.Json)
