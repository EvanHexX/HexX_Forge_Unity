// src/main/services/assetPatcherService.ts

import { app } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { spawn } from 'child_process';
import AdmZip from 'adm-zip';

function getPatcherRoot() {
    if (app.isPackaged) {
        return path.join(process.resourcesPath, 'AssetManager');
    }
    return path.join(process.cwd(), 'resources', 'AssetManager');
}

function ensureDir(p: string) {
    if (!fs.existsSync(p)) {
        fs.mkdirSync(p, { recursive: true });
    }
}

function getPaths() {
    const root = getPatcherRoot();

    return {
        root,
        exe: path.join(root, 'AssetManager_UnityPy.exe'),
        metadataDir: path.join(root, 'metadata'),
        originalsDir: path.join(root, 'originals'),
        workDir: path.join(root, 'work'),
        plansDir: path.join(root, 'work', 'plans'),
        inputDir: path.join(root, 'work', 'input'),
        outputDir: path.join(root, 'work', 'output'),
        reportsDir: path.join(root, 'reports')
    };
}

function ensureStructure(paths: ReturnType<typeof getPaths>) {
    ensureDir(paths.plansDir);
    ensureDir(paths.inputDir);
    ensureDir(paths.outputDir);
    ensureDir(paths.reportsDir);
}

function runExe(exePath: string, args: string[], cwd: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const child = spawn(exePath, args, { cwd });

        let stderr = '';

        child.stdout.on('data', (d) => {
            console.log('[patcher]', d.toString());
        });

        child.stderr.on('data', (d) => {
            stderr += d.toString();
        });

        child.on('close', (code) => {
            if (code === 0) resolve();
            else reject(new Error(stderr || `Exit code ${code}`));
        });
    });
}

// Clothes Patch 실행 함수
export async function runClothesPatch(params: {
    textureName: string;
    pathId: number;
    pngPath: string;
    gender: string;
    category: string;
    option2: string;
    gamePath: string;
}) {
    const paths = getPaths();
    ensureStructure(paths);

    const timestamp = Date.now();

    const planPath = path.join(paths.plansDir, `plan_${timestamp}.json`);
    const reportPath = path.join(paths.reportsDir, `report_${timestamp}.json`);

    const assetsFile = path.join(
        params.gamePath,
        'LongYinLiZhiZhuan_Data',
        'sharedassets1.assets'
    );

    const plan = {
        kind: 'clothes',
        dry_run: false,
        stop_on_error: true,
        texture_metadata_path: path.join(paths.metadataDir, 'data.tsv'),
        jobs: [
            {
                request: {
                    game_id: 'LongYinLiZhiZhuan',
                    category: params.category,
                    option1: params.gender,
                    option2: params.option2,
                    texture_name: params.textureName,
                    pathID: params.pathId,
                    size: [0, 0] // TODO: 나중에 catalog에서 채움
                },
                assets_file: assetsFile,
                png_file: params.pngPath,
                atlas_file: null,
                output_assets_file: null,
                originals_dir: paths.originalsDir,
                flip_y: true
            }
        ]
    };

    fs.writeFileSync(planPath, JSON.stringify(plan, null, 2), 'utf-8');

    await runExe(
        paths.exe,
        ['--plan', planPath, '--report', reportPath],
        paths.root
    );

    if (!fs.existsSync(reportPath)) {
        throw new Error('report 파일 생성되지 않음');
    }

    const report = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));

    if (report.status !== 'success') {
        throw new Error(JSON.stringify(report.errors, null, 2));
    }

    return report;
}

const ROOT_DIR = process.cwd();
const PACK_ROOT = path.join(ROOT_DIR, 'storage', 'asset_packs');

export function importAssetPack(zipPath: string) {
    const zip = new AdmZip(zipPath);

    const tempDir = path.join(PACK_ROOT, '__temp__');
    ensureDir(tempDir);

    zip.extractAllTo(tempDir, true);

    const packJsonPath = path.join(tempDir, 'pack.json');

    if (!fs.existsSync(packJsonPath)) {
        throw new Error('pack.json 없음');
    }

    const pack = JSON.parse(fs.readFileSync(packJsonPath, 'utf-8'));

    const finalDir = path.join(PACK_ROOT, pack.packId);

    if (fs.existsSync(finalDir)) {
        fs.rmSync(finalDir, { recursive: true, force: true });
    }

    fs.renameSync(tempDir, finalDir);

    return {
        ...pack,
        basePath: finalDir
    };
}