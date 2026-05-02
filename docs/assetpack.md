좋습니다. 이제 **asset pack(zip) 규격 + 등록 UI**를 확정합니다.
앞서 만든 **Python Plan 계약**을 깨지 않으면서, 모더가 만들기 쉽고, 앱이 처리하기 쉬운 형태로 잡습니다.

---

# 🎯 설계 목표

```text
✔ 모더는 zip 하나만 배포
✔ Electron은 zip → unpack → manifest 읽기
✔ Python은 plan.json만 받는다
✔ atlas는 Python이 metadata로 처리 (zip에서 직접 안 넘김)
```

---

# 📦 1. Asset Pack 최종 구조 (권장)

```text
my_clothes_pack_v1.zip
├─ pack.json                ← 필수
├─ files/
│  ├─ female/
│  │  └─ skeleton_17.png
│  └─ male/
│     └─ skeleton_17.png
├─ previews/                ← 선택
│  ├─ female/
│  │  └─ skeleton_17_preview.png
│  └─ male/
│     └─ skeleton_17_preview.png
└─ README.txt               ← 선택
```

---

# 📄 2. `pack.json` (핵심)

```json
{
  "schemaVersion": 1,
  "packId": "hexx_clothes_upscale_v1",
  "packName": "HexX 의상 업스케일 v1",
  "author": "HexX",
  "description": "용윤입지전 의상 업스케일 패키지",
  "targets": [
    {
      "catalogId": "female_clothing_skeleton_17_0",
      "textureName": "skeleton_17",
      "pathId": 156,
      "gender": "female",
      "category": "clothes",
      "option2": "천산파",
      "png": "files/female/skeleton_17.png",
      "preview": "previews/female/skeleton_17_preview.png"
    }
  ]
}
```

---

# ⚠️ 중요한 규칙

```text
✔ atlas_file 없음 (Python이 처리)
✔ pathId 반드시 포함 (핵심)
✔ catalogId는 UI 매칭용
✔ png 경로는 zip 내부 상대경로
```

---

# 🧠 3. Electron 처리 흐름

```text
1. zip 선택
2. storage/asset_packs/{packId}/로 압축 해제
3. pack.json 읽기
4. targets 목록 UI 표시
5. 유저 선택
6. plan.json 생성
7. python exe 실행
```

---
