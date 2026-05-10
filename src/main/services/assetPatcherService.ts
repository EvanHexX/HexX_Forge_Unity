// src/main/services/assetPatcherService.ts
// AssetManager_UnityPy CLI/exe 실행용 서비스입니다.
// React/Electron은 Python 내부 함수를 직접 호출하지 않고, plan JSON을 생성한 뒤 CLI/exe를 실행합니다.

import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { app } from 'electron';
import { getAppSettings } from './configService';
import { importAssetPack } from './assetPackService';
import { getResourcePath, getStoragePath } from './runtimePaths';

export { importAssetPack };

type SizeTuple = [number, number];

type TexturePatchTargetParam = {
    catalogId?: string;
    packId?: string;
    targetId?: string;
    category?: string;
    option1?: string;
    gender?: string;
    option2?: string;
    textureName?: string;
    texture_name?: string;
    pathID?: number;
    pathId?: number;
    size?: SizeTuple;
    pngPath?: string;
    pngFile?: string;
};

type RunTexturePatchParams = {
    mode?: 'single' | 'pack_all';
    gameId?: string;
    gamePath?: string;
    dryRun?: boolean;
    dry_run?: boolean;
    stopOnError?: boolean;
    stop_on_error?: boolean;
    targets?: TexturePatchTargetParam[];

    // 이전 UI payload 호환용 필드입니다.
    category?: string;
    gender?: string;
    option1?: string;
    option2?: string;
    textureName?: string;
    pathId?: number;
    pathID?: number;
    size?: SizeTuple;
    pngPath?: string;
};

type TexturePatchJob = {
    request: {
        game_id: string;
        category: string;
        option1: string;
        option2: string;
        texture_name: string;
        pathID: number;
        size: SizeTuple;
    };
    assets_file: string;
    png_file: string;
    atlas_file: null;
    output_assets_file: null;
    originals_dir: string;
    flip_y: boolean;
};

type TexturePatchPlan = {
    kind: 'texture';
    dry_run: boolean;
    stop_on_error: boolean;
    texture_metadata_path: string;
    jobs: TexturePatchJob[];
};

type FontJobParam = {
    pathId?: number;
    path_id?: number;
    replacementFontFile?: string;
    replacement_font_file?: string;
};

type RunFontPatchParams = {
    gameId?: string;
    gamePath?: string;
    dryRun?: boolean;
    dry_run?: boolean;
    stopOnError?: boolean;
    stop_on_error?: boolean;
    jobs: FontJobParam[];
};

type RunFontExtractParams = {
    gameId?: string;
    gamePath?: string;
    overwrite?: boolean;
};

type RunFontListParams = {
    gameId?: string;
    gamePath?: string;
};

type FontExtractPlan = {
    kind: 'font_extract';
    game_id: string;
    font_metadata_path: string;
    originals_dir: string;
    assets_file: string;
    overwrite: boolean;
};

type FontPatchPlan = {
    kind: 'font';
    game_id: string;
    dry_run: boolean;
    stop_on_error: boolean;
    font_metadata_path: string;
    originals_dir: string;
    assets_file: string;
    jobs: Array<{
        path_id: number;
        replacement_font_file: string;
    }>;
};

type FontRestorePlan = {
    kind: 'font_restore';
    game_id: string;
    dry_run: boolean;
    stop_on_error: boolean;
    font_metadata_path: string;
    originals_dir: string;
    assets_file: string;
    jobs: Array<{
        path_id: number;
    }>;
};

type FontListPlan = {
    kind: 'font_list';
    assets_file: string;
};

type PatcherPaths = {
    patcherRoot: string;
    executablePath: string;
    metadataDir: string;
    originalsDir: string;
    workDir: string;
    plansDir: string;
    reportsDir: string;
};

function ensureDir(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

function timestamp(): string {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return [
        d.getFullYear(),
        pad(d.getMonth() + 1),
        pad(d.getDate()),
        '_',
        pad(d.getHours()),
        pad(d.getMinutes()),
        pad(d.getSeconds()),
        '_',
        String(d.getMilliseconds()).padStart(3, '0')
    ].join('');
}

function getRootCandidates(): string[] {
    const seeds = [
        process.cwd(),
        app.getAppPath(),
        path.dirname(process.execPath),
        process.resourcesPath
    ].filter(Boolean);

    const candidates = new Set<string>();

    for (const seed of seeds) {
        let current = path.resolve(seed);

        while (true) {
            candidates.add(current);
            const parent = path.dirname(current);
            if (parent === current) break;
            current = parent;
        }
    }

    return [...candidates];
}

function findPatcherRoot(): string {
    for (const root of getRootCandidates()) {
        const candidates = [
            path.join(root, 'resources', 'tools', 'AssetManager'),
            path.join(root, 'resources', 'AssetManager'),
            getResourcePath('tools', 'AssetManager')
        ];

        for (const candidate of candidates) {
            if (fs.existsSync(candidate)) return candidate;
        }
    }

    // 개발 초기에는 폴더가 아직 없을 수 있으므로 process.cwd() 기준으로 생성 가능하게 둡니다.
    return getResourcePath('tools', 'AssetManager');
}

function getPatcherPaths(): PatcherPaths {
    const patcherRoot = findPatcherRoot();
    const executableCandidates = [
        path.join(patcherRoot, 'AssetManager_UnityPy.exe'),
        path.join(path.dirname(patcherRoot), 'AssetManager_UnityPy.exe')
    ];
    const executablePath = executableCandidates.find((candidate) => fs.existsSync(candidate)) || executableCandidates[0];

    const paths: PatcherPaths = {
        patcherRoot,
        executablePath,
        metadataDir: path.join(patcherRoot, 'metadata'),
        originalsDir: path.join(patcherRoot, 'originals'),
        workDir: getStoragePath('asset-manager-work'),
        plansDir: getStoragePath('asset-manager-work', 'plans'),
        reportsDir: getStoragePath('asset-manager-work', 'reports')
    };

    ensureDir(paths.metadataDir);
    ensureDir(paths.originalsDir);
    ensureDir(paths.workDir);
    ensureDir(paths.plansDir);
    ensureDir(paths.reportsDir);

    return paths;
}

function getSharedAssetsFile(gamePath: string): string {
    return path.join(gamePath, 'LongYinLiZhiZhuan_Data', 'sharedassets1.assets');
}

function getResourcesAssetsFile(gamePath: string): string {
    return path.join(gamePath, 'LongYinLiZhiZhuan_Data', 'resources.assets');
}

function readPngSize(filePath: string): SizeTuple {
    const buffer = fs.readFileSync(filePath);

    // PNG signature: 89 50 4E 47 0D 0A 1A 0A
    const isPng =
        buffer.length >= 24 &&
        buffer[0] === 0x89 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x4e &&
        buffer[3] === 0x47 &&
        buffer[4] === 0x0d &&
        buffer[5] === 0x0a &&
        buffer[6] === 0x1a &&
        buffer[7] === 0x0a;

    if (!isPng) {
        throw new Error(`PNG 파일이 아닙니다: ${filePath}`);
    }

    return [buffer.readUInt32BE(16), buffer.readUInt32BE(20)];
}

function toLegacySingleTarget(params: RunTexturePatchParams): TexturePatchTargetParam {
    return {
        category: params.category,
        option1: params.option1,
        gender: params.gender,
        option2: params.option2,
        textureName: params.textureName,
        pathId: params.pathId,
        pathID: params.pathID,
        size: params.size,
        pngPath: params.pngPath
    };
}

function normalizeTargets(params: RunTexturePatchParams): TexturePatchTargetParam[] {
    if (Array.isArray(params.targets) && params.targets.length > 0) {
        return params.targets;
    }

    return [toLegacySingleTarget(params)];
}

function requireString(value: unknown, fieldName: string): string {
    if (typeof value !== 'string' || value.trim() === '') {
        throw new Error(`${fieldName} 값이 없습니다.`);
    }

    return value;
}

function requireNumber(value: unknown, fieldName: string): number {
    const numberValue = Number(value);

    if (!Number.isFinite(numberValue)) {
        throw new Error(`${fieldName} 값이 올바르지 않습니다.`);
    }

    return numberValue;
}

function buildJob(target: TexturePatchTargetParam, gameId: string, assetsFile: string, paths: PatcherPaths): TexturePatchJob {
    const pngFile = requireString(target.pngFile || target.pngPath, 'png_file');
    const size = target.size || readPngSize(pngFile);

    return {
        request: {
            game_id: gameId,
            category: requireString(target.category, 'request.category'),
            option1: requireString(target.option1 || target.gender, 'request.option1'),
            option2: requireString(target.option2, 'request.option2'),
            texture_name: requireString(target.texture_name || target.textureName, 'request.texture_name'),
            pathID: requireNumber(target.pathID ?? target.pathId, 'request.pathID'),
            size
        },
        assets_file: assetsFile,
        png_file: pngFile,
        atlas_file: null,
        output_assets_file: null,
        originals_dir: paths.originalsDir,
        flip_y: true
    };
}

function buildPlan(params: RunTexturePatchParams, assetsFile: string, paths: PatcherPaths): TexturePatchPlan {
    const gameId = params.gameId || 'LongYinLiZhiZhuan';
    const targets = normalizeTargets(params);

    return {
        kind: 'texture',
        dry_run: params.dryRun ?? params.dry_run ?? false,
        stop_on_error: params.stopOnError ?? params.stop_on_error ?? true,
        texture_metadata_path: path.join(paths.metadataDir, 'data.tsv'),
        jobs: targets.map((target) => buildJob(target, gameId, assetsFile, paths))
    };
}

function getFontCommonParams(params: RunFontPatchParams | RunFontExtractParams | RunFontListParams) {
    const settings = getAppSettings();
    const gamePath = params.gamePath || settings.gamePath;

    if (!gamePath) {
        throw new Error('게임 경로가 설정되지 않았습니다.');
    }

    const assetsFile = getResourcesAssetsFile(gamePath);

    if (!fs.existsSync(assetsFile)) {
        throw new Error(`resources.assets 파일을 찾지 못했습니다: ${assetsFile}`);
    }

    return {
        gameId: params.gameId || 'LongYinLiZhiZhuan',
        assetsFile
    };
}

function normalizeFontPathId(job: FontJobParam): number {
    return requireNumber(job.path_id ?? job.pathId, 'path_id');
}

function buildFontExtractPlan(params: RunFontExtractParams, assetsFile: string, paths: PatcherPaths): FontExtractPlan {
    return {
        kind: 'font_extract',
        game_id: params.gameId || 'LongYinLiZhiZhuan',
        font_metadata_path: path.join(paths.metadataDir, 'fonts_data.tsv'),
        originals_dir: paths.originalsDir,
        assets_file: assetsFile,
        overwrite: params.overwrite ?? false
    };
}

function buildFontPatchPlan(params: RunFontPatchParams, assetsFile: string, paths: PatcherPaths): FontPatchPlan {
    return {
        kind: 'font',
        game_id: params.gameId || 'LongYinLiZhiZhuan',
        dry_run: params.dryRun ?? params.dry_run ?? false,
        stop_on_error: params.stopOnError ?? params.stop_on_error ?? true,
        font_metadata_path: path.join(paths.metadataDir, 'fonts_data.tsv'),
        originals_dir: paths.originalsDir,
        assets_file: assetsFile,
        jobs: params.jobs.map((job) => ({
            path_id: normalizeFontPathId(job),
            replacement_font_file: requireString(
                job.replacement_font_file || job.replacementFontFile,
                'replacement_font_file'
            )
        }))
    };
}

function buildFontRestorePlan(params: RunFontPatchParams, assetsFile: string, paths: PatcherPaths): FontRestorePlan {
    return {
        kind: 'font_restore',
        game_id: params.gameId || 'LongYinLiZhiZhuan',
        dry_run: params.dryRun ?? params.dry_run ?? false,
        stop_on_error: params.stopOnError ?? params.stop_on_error ?? true,
        font_metadata_path: path.join(paths.metadataDir, 'fonts_data.tsv'),
        originals_dir: paths.originalsDir,
        assets_file: assetsFile,
        jobs: params.jobs.map((job) => ({
            path_id: normalizeFontPathId(job)
        }))
    };
}

function buildFontListPlan(assetsFile: string): FontListPlan {
    return {
        kind: 'font_list',
        assets_file: assetsFile
    };
}

function runProcess(command: string, args: string[], cwd: string): Promise<{ exitCode: number; stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, {
            cwd,
            env: {
                ...process.env,
                PYTHONIOENCODING: 'utf-8',
                PYTHONUTF8: '1'
            },
            windowsHide: true,
            shell: false
        });

        let stdout = '';
        let stderr = '';

        child.stdout.on('data', (chunk) => {
            stdout += chunk.toString();
        });

        child.stderr.on('data', (chunk) => {
            stderr += chunk.toString();
        });

        child.on('error', reject);
        child.on('close', (code) => {
            resolve({ exitCode: code ?? 1, stdout, stderr });
        });
    });
}

async function executePatcher(paths: PatcherPaths, planPath: string, reportPath: string) {
    if (fs.existsSync(paths.executablePath)) {
        return runProcess(paths.executablePath, ['--plan', planPath, '--report', reportPath], paths.patcherRoot);
    }

    throw new Error(`AssetManager_UnityPy.exe를 찾지 못했습니다: ${paths.executablePath}`);
}

export async function runClothesPatch(params: RunTexturePatchParams) {
    const paths = getPatcherPaths();
    const settings = getAppSettings();
    const gamePath = params.gamePath || settings.gamePath;

    if (!gamePath) {
        throw new Error('게임 경로가 설정되지 않았습니다.');
    }

    const assetsFile = getSharedAssetsFile(gamePath);

    if (!fs.existsSync(assetsFile)) {
        throw new Error(`sharedassets1.assets 파일을 찾지 못했습니다: ${assetsFile}`);
    }

    const plan = buildPlan(params, assetsFile, paths);
    const name = `texture_patch_${timestamp()}`;
    const planPath = path.join(paths.plansDir, `${name}.json`);
    const reportPath = path.join(paths.reportsDir, `${name}.report.json`);

    fs.writeFileSync(planPath, JSON.stringify(plan, null, 2), 'utf-8');

    const processResult = await executePatcher(paths, planPath, reportPath);
    const reportExists = fs.existsSync(reportPath);
    const report = reportExists
        ? JSON.parse(fs.readFileSync(reportPath, 'utf-8'))
        : null;

    if (processResult.exitCode !== 0 || !report || report.status !== 'success') {
        throw new Error([
            'AssetManager_UnityPy 실행 실패',
            `exitCode=${processResult.exitCode}`,
            report ? `report.status=${report.status}` : 'report 없음',
            processResult.stderr.trim() ? `stderr=${processResult.stderr.trim()}` : ''
        ].filter(Boolean).join('\n'));
    }

    return {
        ok: true,
        mode: params.mode || 'single',
        planPath,
        reportPath,
        stdout: processResult.stdout,
        stderr: processResult.stderr,
        report
    };
}

async function runFontPlan(
    kind: 'font_extract' | 'font_patch' | 'font_restore' | 'font_list',
    plan: FontExtractPlan | FontPatchPlan | FontRestorePlan | FontListPlan
) {
    const paths = getPatcherPaths();
    const name = `${kind}_${timestamp()}`;
    const planPath = path.join(paths.plansDir, `${name}.json`);
    const reportPath = path.join(paths.reportsDir, `${name}.report.json`);

    fs.writeFileSync(planPath, JSON.stringify(plan, null, 2), 'utf-8');

    const processResult = await executePatcher(paths, planPath, reportPath);
    const reportExists = fs.existsSync(reportPath);
    const report = reportExists
        ? JSON.parse(fs.readFileSync(reportPath, 'utf-8'))
        : null;

    if (processResult.exitCode !== 0 || !report || report.status !== 'success') {
        throw new Error([
            'AssetManager_UnityPy 실행 실패',
            `exitCode=${processResult.exitCode}`,
            report ? `report.status=${report.status}` : 'report 없음',
            processResult.stderr.trim() ? `stderr=${processResult.stderr.trim()}` : ''
        ].filter(Boolean).join('\n'));
    }

    return {
        ok: true,
        planPath,
        reportPath,
        stdout: processResult.stdout,
        stderr: processResult.stderr,
        report
    };
}

export async function runFontExtract(params: RunFontExtractParams = {}) {
    const { gameId, assetsFile } = getFontCommonParams(params);
    const paths = getPatcherPaths();
    return runFontPlan('font_extract', buildFontExtractPlan({ ...params, gameId }, assetsFile, paths));
}

export async function runFontPatch(params: RunFontPatchParams) {
    if (!params.jobs?.length) {
        throw new Error('폰트 교체 작업이 없습니다.');
    }

    const { gameId, assetsFile } = getFontCommonParams(params);
    const paths = getPatcherPaths();
    return runFontPlan('font_patch', buildFontPatchPlan({ ...params, gameId }, assetsFile, paths));
}

export async function runFontRestore(params: RunFontPatchParams) {
    if (!params.jobs?.length) {
        throw new Error('폰트 복원 작업이 없습니다.');
    }

    const { gameId, assetsFile } = getFontCommonParams(params);
    const paths = getPatcherPaths();
    return runFontPlan('font_restore', buildFontRestorePlan({ ...params, gameId }, assetsFile, paths));
}

export async function runFontList(params: RunFontListParams = {}) {
    const { assetsFile } = getFontCommonParams(params);
    return runFontPlan('font_list', buildFontListPlan(assetsFile));
}
