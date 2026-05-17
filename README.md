# HexX Forge Unity

![Electron](https://img.shields.io/badge/Electron-41.3.0-47848F?logo=electron&logoColor=white)
![React](https://img.shields.io/badge/React-19.2.5-61DAFB?logo=react&logoColor=111111)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white)
![Unity Modding](https://img.shields.io/badge/Unity-Modding-000000?logo=unity&logoColor=white)
![Beta](https://img.shields.io/badge/status-beta-F59E0B)
![Windows](https://img.shields.io/badge/platform-Windows-0078D4?logo=windows&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-22C55E)

## English

### Project overview

HexX Forge Unity is an Electron + React desktop tool for managing Unity-based game mods, fonts, and asset patches. It
focuses on practical workflows for BepInEx mod packages, Unity asset replacement, Visual Forge media preparation,
backup/restore operations, and release updates through GitHub Releases.

### Features

- **Forge Hub**: Show supported game status, update badges, GitHub Releases news, and expandable feature cards.
- **Mod Forge**: Manage BepInEx plugins and mod packages, including local packages and GitHub catalog packages.
- **Asset Forge**: Back up original resources, replace textures, apply asset packs, extract fonts, replace fonts, and
  restore backups.
- **Visual Forge**: Stabilize video/image based portrait work, preview flows, FFmpeg export, and preset preparation.
- **Core Lab**: Planned workspace for runtime analysis, save editing, cheat table/profile management, and custom skill
  experiments.
- **Synthesis Lab**: Planned workspace for LongYinLiZhiZhuan BiGeup learning optimization, route simulation, and custom
  skill planning.
- **Settings**: Configure supported game install paths, theme, typography, language, and update behavior.

### Current status

- The current release is a Windows x64 beta prerelease: `v1.16.0-beta.0`.
- The current primary supported game is `LongYinLiZhiZhuan`.
- This beta focuses on ASAR-packaged release validation, Asset Forge distribution updates, and Visual Forge stability checks.
- Core Lab and Synthesis Lab are visible placeholder workspaces for planned features.
- ASAR packaging is enabled for app code. External tools and runtime resources remain outside ASAR through `extraResources`.
- Code signing is not configured yet, so Windows SmartScreen may warn on first launch.
- Settings already use `selectedGameId` and `gamePaths` so additional games can be added later.
- `gamePath` is still preserved for compatibility with earlier configuration files.
- Themes use named color-scheme records with CSS variables.
- Typography is managed separately from themes through `config/typography.json`.
- Asset and font backups keep the latest backup per backup type under `storage/backups`.

### Installation / build notes

- Install dependencies with `npm install`.
- Run the development app with `npm run dev`.
- Build renderer and main process outputs with `npm run build`.
- Create local Windows package artifacts with `npm.cmd run dist`.
- Publish a GitHub beta prerelease with `npm.cmd run publish`, then mark the GitHub Release as a prerelease.
- Windows uses NSIS auto updates. macOS targets are configured, but production auto-update validation requires Developer
  ID signing and notarization.

### Contributors

| Contributor                                                                                                                                               | Contributions                       |
|-----------------------------------------------------------------------------------------------------------------------------------------------------------|-------------------------------------|
| `바나나12349ㄴ` ![Test Images](https://img.shields.io/badge/Role-Test%20Images-EC4899) ![Beta Tester](https://img.shields.io/badge/Role-Beta%20Tester-6366F1) | Test image production, beta testing |

### Documentation links

- Project documentation: [`docs/README.md`](docs/README.md)
- Project map: [`docs/PROJECT_MAP.md`](docs/PROJECT_MAP.md)
- TODO tracking: [`docs/TODO.md`](docs/TODO.md)
- Regression notes: [`docs/regression.md`](docs/regression.md)
- Update flow: [`docs/modules/update-manager.md`](docs/modules/update-manager.md)
- Release notes: [`docs/release-notes/1.16.0-beta.0.md`](docs/release-notes/1.16.0-beta.0.md)
- Asset Forge details: [`docs/modules/asset-manager.md`](docs/modules/asset-manager.md)
- Mod Forge details: [`docs/modules/mod-manager.md`](docs/modules/mod-manager.md)
- Visual Forge details: [`docs/modules/graphics-tool.md`](docs/modules/graphics-tool.md)

---

## 한국어

### 프로젝트 개요

HexX Forge Unity는 Unity 기반 게임의 모드, 폰트, 어셋 패치와 Visual Forge 미디어 작업을 관리하는 Electron + React 데스크톱 도구입니다. BepInEx 모드 패키지,
Unity asset 교체, 백업/복원, GitHub Releases 기반 업데이트 흐름을 실무적으로 다루는 데 초점을 둡니다.

### 주요 기능

- **Forge Hub**: 지원 게임 상태, 업데이트 badge, GitHub Releases 뉴스, 확장형 기능 카드를 표시합니다.
- **Mod Forge**: 로컬 패키지와 GitHub catalog 패키지를 포함한 BepInEx 플러그인 및 모드 패키지를 관리합니다.
- **Asset Forge**: 원본 리소스 백업, 텍스처 교체, 어셋팩 적용, 폰트 추출, 폰트 교체, 백업 복원을 지원합니다.
- **Visual Forge**: 영상/이미지 기반 초상화 작업, 미리보기 흐름, FFmpeg export, preset 준비를 안정화합니다.
- **Core Lab**: 실시간 분석, 세이브 데이터 편집, 치트 테이블/프로필 관리, 커스텀 무공/스킬 실험을 위한 예정 공간입니다.
- **Synthesis Lab**: 용윤입지전 비급 학습 최적화, 루트 시뮬레이션, 커스텀 무공/스킬 설계를 위한 예정 공간입니다.
- **Settings**: 지원 게임 설치 경로, theme, typography, language, update behavior를 설정합니다.

### 현재 상태

- 현재 릴리즈는 Windows x64 베타 prerelease인 `v1.16.0-beta.0`입니다.
- 현재 주 지원 게임은 `용윤입지전`입니다.
- 이번 베타는 ASAR 패키징 릴리즈 검증, Asset Forge 배포 업데이트, Visual Forge 안정성 확인에 초점을 둡니다.
- Core Lab과 Synthesis Lab은 구현 예정 기능을 보여주는 placeholder 작업 공간입니다.
- ASAR 패키징은 앱 코드에 활성화되어 있습니다. 외부 실행 도구와 runtime resources는 `extraResources`를 통해 ASAR 밖에 유지합니다.
- 코드 서명은 아직 구성되지 않아 Windows SmartScreen 경고가 표시될 수 있습니다.
- 설정은 향후 게임 확장을 위해 `selectedGameId`와 `gamePaths` 구조를 사용합니다.
- 이전 설정 파일과의 호환을 위해 `gamePath` 값도 유지합니다.
- Theme은 표시 이름과 CSS variables를 포함하는 color-scheme record를 사용합니다.
- Typography는 theme과 분리되어 `config/typography.json`에서 관리됩니다.
- Asset 및 font backup은 `storage/backups` 아래에서 타입별 최신 백업 1개를 유지합니다.

### 설치 / 빌드 참고

- 의존성은 `npm install`로 설치합니다.
- 개발 앱은 `npm run dev`로 실행합니다.
- Renderer와 main process output은 `npm run build`로 빌드합니다.
- 로컬 Windows package artifact는 `npm.cmd run dist`로 생성합니다.
- GitHub 베타 prerelease는 `npm.cmd run publish`로 업로드한 뒤 GitHub Release에서 prerelease로 표시합니다.
- Windows는 NSIS auto update를 사용합니다. macOS target은 설정되어 있지만 production auto-update 검증에는 Developer ID signing과
  notarization이 필요합니다.

### 기여자

| Contributor                                                                                                                                               | Contributions      |
|-----------------------------------------------------------------------------------------------------------------------------------------------------------|--------------------|
| `바나나12349ㄴ` ![Test Images](https://img.shields.io/badge/Role-Test%20Images-EC4899) ![Beta Tester](https://img.shields.io/badge/Role-Beta%20Tester-6366F1) | 테스트용 이미지 제작, 베타테스터 |

### 문서 링크

- 프로젝트 문서: [`docs/README.md`](docs/README.md)
- 프로젝트 맵: [`docs/PROJECT_MAP.md`](docs/PROJECT_MAP.md)
- TODO tracking: [`docs/TODO.md`](docs/TODO.md)
- Regression notes: [`docs/regression.md`](docs/regression.md)
- Update flow: [`docs/modules/update-manager.md`](docs/modules/update-manager.md)
- 릴리즈 노트: [`docs/release-notes/1.16.0-beta.0.md`](docs/release-notes/1.16.0-beta.0.md)
- Asset Forge 상세: [`docs/modules/asset-manager.md`](docs/modules/asset-manager.md)
- Mod Forge 상세: [`docs/modules/mod-manager.md`](docs/modules/mod-manager.md)
- Visual Forge 상세: [`docs/modules/graphics-tool.md`](docs/modules/graphics-tool.md)

---

## 简体中文

### 项目概览

HexX Forge Unity 是一个基于 Electron + React 的桌面工具，用于管理 Unity 游戏的 Mod、字体、资源补丁和 Visual Forge 媒体工作流。它专注于
BepInEx Mod 包、Unity asset 替换、备份/恢复操作，以及基于 GitHub Releases 的更新流程。

### 主要功能

- **Forge Hub**：显示受支持游戏状态、更新 badge、GitHub Releases 新闻和可展开的功能卡片。
- **Mod Forge**：管理 BepInEx 插件和 Mod 包，包括本地包与 GitHub catalog 包。
- **Asset Forge**：支持原始资源备份、纹理替换、资源包应用、字体提取、字体替换和备份恢复。
- **Visual Forge**：稳定视频/图像肖像工作、预览流程、FFmpeg 导出和 preset 准备。
- **Core Lab**：用于实时分析、存档数据编辑、作弊表/配置管理和自定义武功/技能实验的计划工作区。
- **Synthesis Lab**：用于龙胤立志传秘籍学习优化、路线模拟和自定义武功/技能设计的计划工作区。
- **Settings**：配置受支持游戏的安装路径、theme、typography、language 和 update behavior。

### 当前状态

- 当前版本是 Windows x64 beta prerelease：`v1.16.0-beta.0`。
- 当前主要支持的游戏是 `龙胤立志传`。
- 本次 beta 重点是 ASAR 打包发布验证、Asset Forge 分发更新和 Visual Forge 稳定性检查。
- Core Lab 和 Synthesis Lab 是用于展示计划功能的 placeholder 工作区。
- 应用代码已启用 ASAR 打包。外部工具和运行时资源会通过 `extraResources` 保留在 ASAR 外部。
- 尚未配置代码签名，因此 Windows SmartScreen 可能会在首次启动时提示警告。
- 设置已经使用 `selectedGameId` 和 `gamePaths`，方便后续扩展更多游戏。
- 为了兼容旧配置文件，仍然保留 `gamePath`。
- Theme 使用包含显示名称和 CSS variables 的 color-scheme record。
- Typography 与 theme 分离，并通过 `config/typography.json` 管理。
- Asset 和 font backup 会在 `storage/backups` 下按类型保留最新的 1 份备份。

### 安装 / 构建说明

- 使用 `npm install` 安装依赖。
- 使用 `npm run dev` 运行开发版应用。
- 使用 `npm run build` 构建 renderer 和 main process 输出。
- 使用 `npm.cmd run dist` 生成本地 Windows package artifact。
- 使用 `npm.cmd run publish` 上传 GitHub beta prerelease，然后在 GitHub Release 中标记为 prerelease。
- Windows 使用 NSIS auto update。macOS target 已配置，但生产环境 auto-update 验证需要 Developer ID signing 和
  notarization。

### 贡献者

| Contributor                                                                                                                                               | Contributions   |
|-----------------------------------------------------------------------------------------------------------------------------------------------------------|-----------------|
| `바나나12349ㄴ` ![Test Images](https://img.shields.io/badge/Role-Test%20Images-EC4899) ![Beta Tester](https://img.shields.io/badge/Role-Beta%20Tester-6366F1) | 测试用图片制作，Beta 测试 |

### 文档链接

- 项目文档：[`docs/README.md`](docs/README.md)
- 项目地图：[`docs/PROJECT_MAP.md`](docs/PROJECT_MAP.md)
- TODO tracking：[`docs/TODO.md`](docs/TODO.md)
- Regression notes：[`docs/regression.md`](docs/regression.md)
- Update flow：[`docs/modules/update-manager.md`](docs/modules/update-manager.md)
- Release notes：[`docs/release-notes/1.16.0-beta.0.md`](docs/release-notes/1.16.0-beta.0.md)
- Asset Forge 详情：[`docs/modules/asset-manager.md`](docs/modules/asset-manager.md)
- Mod Forge 详情：[`docs/modules/mod-manager.md`](docs/modules/mod-manager.md)
- Visual Forge 详情：[`docs/modules/graphics-tool.md`](docs/modules/graphics-tool.md)
