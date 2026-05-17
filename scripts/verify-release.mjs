import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const asar = require('@electron/asar');

const releaseRoot = path.resolve('release', 'win-unpacked', 'resources');
const appAsarPath = path.join(releaseRoot, 'app.asar');
const bundledConfigDir = path.join(releaseRoot, 'config');
const bundledResourcesDir = path.join(releaseRoot, 'resources');
const bundledFfmpegPath = path.join(bundledResourcesDir, 'tools', 'ffmpeg', 'ffmpeg.exe');
const bundledFrei0rDir = path.join(bundledResourcesDir, 'tools', 'frei0r', 'filter');
const checks = [
    {
        ok: fs.existsSync(appAsarPath),
        message: 'Missing ASAR bundle at release/win-unpacked/resources/app.asar',
    },
    {
        ok: !fs.existsSync(path.join(releaseRoot, 'app', 'dist')),
        message: 'App dist files must be packaged into app.asar for ASAR release builds',
    },
    {
        ok: fs.existsSync(path.join(releaseRoot, 'build', 'icon.ico')),
        message: 'Missing bundled runtime icon at release/win-unpacked/resources/build/icon.ico',
    },
    {
        ok: fs.existsSync(path.join(bundledResourcesDir, 'tools', 'AssetManager', 'AssetManager_UnityPy.exe')),
        message: 'Missing bundled AssetManager executable',
    },
    {
        ok: fs.existsSync(bundledFfmpegPath),
        message: 'Missing bundled ffmpeg.exe',
    },
    {
        ok: fs.existsSync(path.join(bundledResourcesDir, 'tools', 'ffmpeg', 'ffprobe.exe')),
        message: 'Missing bundled ffprobe.exe',
    },
    {
        ok: fs.existsSync(path.join(bundledResourcesDir, 'tools', 'frei0r', 'filter', 'select0r.dll')),
        message: 'Missing bundled frei0r select0r.dll',
    },
    {
        ok: fs.existsSync(path.join(bundledResourcesDir, 'tools', 'frei0r', 'filter', 'keyspillm0pup.dll')),
        message: 'Missing bundled frei0r keyspillm0pup.dll',
    },
    {
        ok: fs.existsSync(path.join(bundledResourcesDir, 'tools', 'frei0r', 'filter', 'alpha0ps_alpha0ps.dll')),
        message: 'Missing bundled frei0r alpha0ps_alpha0ps.dll',
    },
    {
        ok: fs.existsSync(path.join(bundledResourcesDir, 'tools', 'frei0r', 'filter', 'saturat0r.dll')),
        message: 'Missing bundled frei0r saturat0r.dll',
    },
    {
        ok: fs.existsSync(path.join(bundledResourcesDir, 'tools', 'AssetManager', 'metadata', 'ui_textures.tsv')),
        message: 'Missing bundled AssetManager UI texture metadata',
    },
    {
        ok: !fs.existsSync(path.join(bundledResourcesDir, 'tools', 'AssetManager', 'work')),
        message: 'AssetManager work directory must not be bundled',
    },
    {
        ok: !fs.existsSync(path.join(bundledResourcesDir, 'tools', 'AssetManager', 'reports')),
        message: 'AssetManager reports directory must not be bundled',
    },
    {
        ok: !fs.existsSync(path.join(bundledConfigDir, 'app_settings')),
        message: 'Local app_settings file must not be bundled',
    },
    {
        ok: !fs.existsSync(path.join(bundledConfigDir, 'app_settings.json')),
        message: 'Local app_settings.json file must not be bundled',
    },
];

function verifyFrei0rDryRun() {
    if (!fs.existsSync(bundledFfmpegPath) || !fs.existsSync(bundledFrei0rDir)) {
        return;
    }

    const pathKey = process.platform === 'win32' ? 'Path' : 'PATH';
    const currentPath = process.env[pathKey] || process.env.PATH || '';
    const result = spawnSync(
        bundledFfmpegPath,
        [
            '-hide_banner',
            '-f',
            'lavfi',
            '-i',
            'color=c=green:s=16x16:d=0.1',
            '-vf',
            'format=rgba,frei0r=select0r:#00cc00|n|0.2|0.2|0.2|0|0|0.5|0.9|0.5',
            '-frames:v',
            '1',
            '-f',
            'null',
            '-',
        ],
        {
            encoding: 'utf-8',
            env: {
                ...process.env,
                FREI0R_PATH: bundledFrei0rDir,
                [pathKey]: process.platform === 'win32'
                    ? `${bundledFrei0rDir};${currentPath}`
                    : `${bundledFrei0rDir}:${currentPath}`,
            },
        }
    );

    checks.push({
        ok: result.status === 0,
        message: `Packaged FFmpeg failed to load frei0r select0r.dll: ${(result.stderr || result.stdout || '').trim()}`,
    });
}

const leakedPatterns = [
    /[A-Z]:\\Games\\/i,
    /SteamLibrary\\steamapps\\common/i,
];

if (fs.existsSync(bundledConfigDir)) {
    for (const entry of fs.readdirSync(bundledConfigDir, { withFileTypes: true })) {
        if (!entry.isFile()) continue;

        const filePath = path.join(bundledConfigDir, entry.name);
        const content = fs.readFileSync(filePath, 'utf-8');

        checks.push({
            ok: !leakedPatterns.some((pattern) => pattern.test(content)),
            message: `Possible local game path leaked into bundled config: ${path.relative(process.cwd(), filePath)}`,
        });
    }
}

if (fs.existsSync(appAsarPath)) {
    const asarFiles = asar.listPackage(appAsarPath).map((entry) => entry.replaceAll('\\', '/'));
    const forbiddenAsarPrefixes = [
        '/resources/tools/',
        '/config/app_settings',
        '/config/app_settings.json',
        '/storage/',
    ];

    for (const prefix of forbiddenAsarPrefixes) {
        checks.push({
            ok: !asarFiles.some((entry) => entry === prefix.slice(0, -1) || entry.startsWith(prefix)),
            message: `ASAR bundle must not contain runtime resource path: ${prefix}`,
        });
    }
}

verifyFrei0rDryRun();

const failures = checks.filter((check) => !check.ok);

if (failures.length > 0) {
    for (const failure of failures) {
        console.error(`Release verification failed: ${failure.message}`);
    }

    process.exit(1);
}

console.log('Release verification passed.');
