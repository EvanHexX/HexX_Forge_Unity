# Rigging Tool

## 목적

Rigging Tool은 사전 제작된 Unity 2D animation asset preset을 기준으로 사용자의 캐릭터 이미지를 분할하고, atlas PNG와 ingame 교체 정보 파일을 만드는 것을 목표로 한다.

## 현재 상태

현재 구현은 mockup 단계다.

- screenshot 예시 1개 구성을 기준으로 MUI 컴포넌트 UI를 직접 구성한다.
- preview placeholder, guide lines, anchor points, 기준점 설정 rows, part preview grid, export 설정 영역을 보여준다.
- toolbar/apply/reset/export action은 실제 파일을 만들지 않고 `NotificationContext`로 TODO 상태를 안내한다.
- 실제 slicing, atlas packing, 정보 파일 생성은 마지막 TODO 단계로 남긴다.

## 향후 구현 방향

- preset별 guide data를 설정 파일로 분리한다.
- 사용자가 사진 위에 기준선을 조정할 수 있게 한다.
- 기준선과 part mapping을 기반으로 이미지를 crop한다.
- crop된 part를 atlas로 pack한다.
- atlas rect, pivot, bone/joint metadata를 ingame 교체용 정보 파일로 저장한다.

## 확장 원칙

현재 HexX Forge는 `LongYinLiZhiZhuan` 기준으로 제작 중이다. 이후 다른 게임이나 다른 animation preset을 포함할 수 있으므로, preset ID, guide line, part mapping, atlas size 같은 값은 UI 코드에 고정하지 않고 설정 파일 또는 타입화된 preset registry로 분리한다.

## 알림과 확인창

Rigging Tool에서 실제 생성 기능이 추가되면 다음 작업은 중요한 선택으로 취급한다.

- atlas overwrite.
- preset 변경으로 기존 marking이 사라지는 경우.
- export 경로 선택 후 실제 파일 생성.

이런 선택은 MUI Dialog로 확인하고, 성공/실패/주의 알림은 `NotificationContext`를 사용한다.
