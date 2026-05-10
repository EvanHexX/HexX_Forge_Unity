import { app, dialog } from 'electron';
import type { WebContents } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { execFile, spawn } from 'node:child_process';
import { getConfigPath, getResourcePath } from './runtimePaths';

export type PortraitOutputPreset = 'standard' | 'high';

export type PortraitTransform = {
    x: number;
    y: number;
    scale: number;
};

export type GraphicsAssetUrls = {
    silhouetteUrl: string;
    guideUrl: string;
    riggingMockupUrl: string;
};

type GraphicsFileSelection = {
    path: string;
    url: string;
    name: string;
};

type VideoFilters = {
    chromaEnabled: boolean;
    keyColor: string;
    similarity: number;
    blend: number;
    alpha: number;
    colorPreset: string;
    saturation: number;
    shotcutFilters?: ShotcutVideoFilters;
};

type ColorPresetPreview = {
    brightness?: number;
    contrast?: number;
    saturation?: number;
    sepia?: number;
    hueRotate?: number;
};

type ColorPresetFfmpeg = {
    eq?: Record<string, number>;
};

export type ColorPresetConfig = {
    id: string;
    label: string;
    preview?: ColorPresetPreview;
    ffmpeg?: ColorPresetFfmpeg;
};

type GraphicsConfig = {
    schemaVersion: number;
    gameId: string;
    videoFilters?: {
        filters?: GraphicsFilterRegistryItem[];
        colorPresets?: ColorPresetConfig[];
    };
};

type GraphicsFilterRegistryItem = {
    id: string;
    labels: Record<string, string>;
    shotcut?: {
        sourcePath: string;
        mltService: string;
    };
    engine: 'frei0r' | 'ffmpeg-native';
    pluginFile?: string;
    enabled: boolean;
    defaults?: Record<string, unknown>;
};

type ShotcutVideoFilters = {
    chromaKeyAdvanced?: {
        enabled: boolean;
        keyColor: string;
        invert: boolean;
        deltaR: number;
        deltaG: number;
        deltaB: number;
        slope: number;
        colorSpace: number;
        shape: number;
        edge: number;
        operation: number;
    };
    keySpillAdvanced?: {
        enabled: boolean;
        keyColor: string;
        targetColor: string;
        maskType: number;
        tolerance: number;
        slope: number;
        hueGate: number;
        saturationThreshold: number;
        operation1: number;
        amount1: number;
        operation2: number;
        amount2: number;
        showMask?: boolean;
        maskAlpha?: boolean;
    };
    alphaChannelAdjust?: {
        enabled: boolean;
        operation: number;
        threshold: number;
        amount: number;
        invert: boolean;
    };
    saturation?: {
        enabled: boolean;
        level: number;
    };
    contrast?: {
        enabled: boolean;
        level: number;
    };
    colorGrading?: {
        enabled: boolean;
        lift: { r: number; g: number; b: number };
        gamma: { r: number; g: number; b: number };
        gain: { r: number; g: number; b: number };
    };
};

type VideoExportOptions = {
    sourcePath: string;
    transform: PortraitTransform;
    preset: PortraitOutputPreset;
    includeAudio: boolean;
    interpolation: 'none' | 'motion';
    filters: VideoFilters;
    operationId?: string;
    chromaMaskDataUrl?: string;
};

type ImageExportOptions = {
    dataUrl: string;
    defaultName: string;
};

type LoopOptions = {
    sourcePath: string;
    includeAudio: boolean;
    operationId?: string;
};

type ProgressPayload = {
    operationId?: string;
    type: 'export-video' | 'create-loop';
    state: 'running' | 'completed' | 'error';
    percent?: number;
    message: string;
};

const GRAPHICS_DIR = getResourcePath('graphics');
const GRAPHICS_CONFIG_PATH = getConfigPath('graphics_presets.json');

const PRESET_SIZE: Record<PortraitOutputPreset, { width: number; height: number }> = {
    standard: { width: 560, height: 700 },
    high: { width: 1200, height: 1500 },
};

function toGraphicsProtocolUrl(fileName: string): string {
    return `hexx-resource://graphics/${encodeURIComponent(fileName)}`;
}

function toSelectedMediaProtocolUrl(filePath: string): string {
    return `hexx-resource://selected-media/?path=${encodeURIComponent(filePath)}`;
}

export function getGraphicsAssets(): GraphicsAssetUrls {
    return {
        silhouetteUrl: toGraphicsProtocolUrl('silhouette.png'),
        guideUrl: toGraphicsProtocolUrl('guide_lines.png'),
        riggingMockupUrl: toGraphicsProtocolUrl('rigging_mockup.png'),
    };
}

export function getGraphicsConfig(): GraphicsConfig {
    try {
        if (!fs.existsSync(GRAPHICS_CONFIG_PATH)) return getFallbackGraphicsConfig();
        const parsed = JSON.parse(fs.readFileSync(GRAPHICS_CONFIG_PATH, 'utf-8')) as GraphicsConfig;
        return {
            ...getFallbackGraphicsConfig(),
            ...parsed,
            videoFilters: {
                ...getFallbackGraphicsConfig().videoFilters,
                ...parsed.videoFilters,
            },
        };
    } catch {
        return getFallbackGraphicsConfig();
    }
}

function getFallbackGraphicsConfig(): GraphicsConfig {
    return {
        schemaVersion: 1,
        gameId: 'LongYinLiZhiZhuan',
        videoFilters: {
            filters: [],
            colorPresets: [
                {
                    id: 'neutral',
                    label: 'Neutral',
                    preview: { brightness: 1, contrast: 1, saturation: 1, sepia: 0, hueRotate: 0 },
                    ffmpeg: { eq: {} },
                },
                {
                    id: 'warm',
                    label: 'Warm',
                    preview: { brightness: 1.01, contrast: 1.04, saturation: 1.08, sepia: 0.06, hueRotate: 0 },
                    ffmpeg: { eq: { contrast: 1.04, brightness: 0.01, saturation: 1.08, gamma_r: 1.03 } },
                },
                {
                    id: 'cool',
                    label: 'Cool',
                    preview: { brightness: 1, contrast: 1.03, saturation: 0.96, sepia: 0, hueRotate: -6 },
                    ffmpeg: { eq: { contrast: 1.03, brightness: 0, saturation: 0.96, gamma_b: 1.04 } },
                },
                {
                    id: 'dramatic',
                    label: 'Dramatic',
                    preview: { brightness: 0.99, contrast: 1.12, saturation: 1.16, sepia: 0, hueRotate: 0 },
                    ffmpeg: { eq: { contrast: 1.12, brightness: -0.01, saturation: 1.16 } },
                },
            ],
        },
    };
}

export function resolveGraphicsFile(rawPath: string): string {
    const normalized = path.normalize(rawPath.replaceAll('\\', '/'));

    if (!normalized || normalized.startsWith('..') || path.isAbsolute(normalized)) {
        return '';
    }

    const candidate = path.join(GRAPHICS_DIR, normalized);
    return fs.existsSync(candidate) ? candidate : '';
}

export function resolveSelectedMediaFile(url: URL): string {
    const encodedPath = url.searchParams.get('path') || '';
    if (!encodedPath) return '';

    const filePath = decodeURIComponent(encodedPath);
    return fs.existsSync(filePath) ? filePath : '';
}

export async function selectGraphicsVideo(): Promise<GraphicsFileSelection | null> {
    const result = await dialog.showOpenDialog({
        title: 'Select portrait video',
        properties: ['openFile'],
        filters: [
            { name: 'Video', extensions: ['mp4', 'mov', 'webm', 'mkv', 'avi'] },
            { name: 'All Files', extensions: ['*'] },
        ],
    });

    if (result.canceled || result.filePaths.length === 0) return null;

    const filePath = result.filePaths[0];
    return {
        path: filePath,
        url: toSelectedMediaProtocolUrl(filePath),
        name: path.basename(filePath),
    };
}

export async function selectGraphicsImage(): Promise<GraphicsFileSelection | null> {
    const result = await dialog.showOpenDialog({
        title: 'Select portrait image',
        properties: ['openFile'],
        filters: [
            { name: 'Image', extensions: ['png', 'jpg', 'jpeg', 'webp', 'bmp'] },
            { name: 'All Files', extensions: ['*'] },
        ],
    });

    if (result.canceled || result.filePaths.length === 0) return null;

    const filePath = result.filePaths[0];
    return {
        path: filePath,
        url: toSelectedMediaProtocolUrl(filePath),
        name: path.basename(filePath),
    };
}

function getFfmpegDir(): string {
    return getResourcePath('tools', 'ffmpeg');
}

function getFrei0rFilterDir(): string {
    return getResourcePath('tools', 'frei0r', 'filter');
}

function getFfmpegPath(binary: 'ffmpeg' | 'ffprobe'): string {
    const executable = process.platform === 'win32' ? `${binary}.exe` : binary;
    return path.join(getFfmpegDir(), executable);
}

function runBinary(binaryPath: string, args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
        execFile(binaryPath, args, { windowsHide: true }, (error, stdout, stderr) => {
            if (error) {
                reject(new Error(stderr.trim() || error.message));
                return;
            }

            resolve(stdout.trim() || stderr.trim());
        });
    });
}

export async function checkFfmpeg() {
    const ffmpegPath = getFfmpegPath('ffmpeg');
    const ffprobePath = getFfmpegPath('ffprobe');
    const exists = fs.existsSync(ffmpegPath) && fs.existsSync(ffprobePath);

    if (!exists) {
        return {
            ok: false,
            ffmpegPath,
            ffprobePath,
            version: '',
            message: 'Bundled FFmpeg was not found in resources/tools/ffmpeg.',
        };
    }

    try {
        const versionOutput = await runBinary(ffmpegPath, ['-version']);
        const filterOutput = await runBinary(ffmpegPath, ['-hide_banner', '-filters']);
        const supportsFrei0r = /\bfrei0r\b/.test(filterOutput);
        const requiredPlugins = ['select0r.dll', 'keyspillm0pup.dll', 'alpha0ps_alpha0ps.dll', 'saturat0r.dll'];
        const missingFrei0rPlugins = requiredPlugins.filter((fileName) => !fs.existsSync(path.join(getFrei0rFilterDir(), fileName)));

        return {
            ok: true,
            ffmpegPath,
            ffprobePath,
            version: versionOutput.split(/\r?\n/)[0] || '',
            message: 'Bundled FFmpeg is ready.',
            supportsFrei0r,
            frei0rPath: getFrei0rFilterDir(),
            missingFrei0rPlugins,
        };
    } catch (error) {
        return {
            ok: false,
            ffmpegPath,
            ffprobePath,
            version: '',
            message: error instanceof Error ? error.message : 'FFmpeg could not be executed.',
        };
    }
}

function normalizeHexColor(value: string): string {
    const trimmed = value.trim().replace(/^#/, '');
    return /^[0-9a-fA-F]{6}$/.test(trimmed) ? `0x${trimmed}` : '0x00ff00';
}

function normalizeFrei0rColor(value: string): string {
    const trimmed = value.trim();
    return /^#[0-9a-fA-F]{6}$/.test(trimmed) ? trimmed : '#00cc00';
}

function boolToFrei0r(value: boolean): string {
    return value ? 'y' : 'n';
}

function numberParam(value: number, fallback: number): string {
    return Number.isFinite(value) ? String(value) : String(fallback);
}

function buildFrei0rFilter(name: string, params: string[]): string {
    return `frei0r=${name}:${params.join('|')}`;
}

function buildShotcutFilterSegments(filters?: ShotcutVideoFilters): string[] {
    const result: string[] = [];

    if (!filters) return result;

    const chroma = filters.chromaKeyAdvanced;
    if (chroma?.enabled) {
        result.push(buildFrei0rFilter('select0r', [
            normalizeFrei0rColor(chroma.keyColor),
            boolToFrei0r(!chroma.invert),
            numberParam(chroma.deltaR, 0.2),
            numberParam(chroma.deltaG, 0.2),
            numberParam(chroma.deltaB, 0.2),
            numberParam(chroma.slope, 0),
            numberParam(chroma.colorSpace, 0),
            numberParam(chroma.shape, 0.5),
            numberParam(chroma.edge, 0.9),
            numberParam(chroma.operation, 0.5),
        ]));
    }

    const spill = filters.keySpillAdvanced;
    if (spill?.enabled) {
        result.push(buildFrei0rFilter('keyspillm0pup', [
            normalizeFrei0rColor(spill.keyColor),
            normalizeFrei0rColor(spill.targetColor),
            numberParam(spill.maskType, 0),
            numberParam(spill.tolerance, 0.24),
            numberParam(spill.slope, 0.4),
            numberParam(spill.hueGate, 0.25),
            numberParam(spill.saturationThreshold, 0.15),
            numberParam(spill.operation1, 1),
            numberParam(spill.amount1, 0.5),
            numberParam(spill.operation2, 0),
            numberParam(spill.amount2, 0.5),
        ]));
    }

    const alpha = filters.alphaChannelAdjust;
    if (alpha?.enabled) {
        result.push(buildFrei0rFilter('alpha0ps', [
            '0',
            '0',
            numberParam(alpha.operation, 0),
            numberParam(alpha.threshold, 0.5),
            numberParam(alpha.amount, 0.5),
            boolToFrei0r(alpha.invert),
        ]));
    }

    const saturation = filters.saturation;
    if (saturation?.enabled) {
        result.push(buildFrei0rFilter('saturat0r', [
            numberParam(saturation.level / 800, 0.125),
        ]));
    }

    const contrast = filters.contrast;
    if (contrast?.enabled && contrast.level !== 50) {
        const normalized = contrast.level / 50;
        result.push(`eq=contrast=${normalized.toFixed(2)}:gamma=${Math.max(0.1, 2 - normalized).toFixed(2)}`);
    }

    const grading = filters.colorGrading;
    if (grading?.enabled) {
        const liftBrightness = (grading.lift.r + grading.lift.g + grading.lift.b) / 300;
        const gammaR = wheelToScale(grading.gamma.r);
        const gammaG = wheelToScale(grading.gamma.g);
        const gammaB = wheelToScale(grading.gamma.b);
        const gainR = wheelToScale(grading.gain.r);
        const gainG = wheelToScale(grading.gain.g);
        const gainB = wheelToScale(grading.gain.b);
        result.push(`eq=brightness=${liftBrightness.toFixed(3)}:gamma_r=${gammaR.toFixed(3)}:gamma_g=${gammaG.toFixed(3)}:gamma_b=${gammaB.toFixed(3)}`);
        result.push(`colorchannelmixer=rr=${gainR.toFixed(3)}:gg=${gainG.toFixed(3)}:bb=${gainB.toFixed(3)}`);
    }

    return result;
}

function wheelToScale(value: number): number {
    const wheel = (value / 100 + 1) / 2;
    if (wheel < 0.5) return Math.max(0.1, 0.5 + wheel);
    if (wheel === 0.5) return 1;
    return Math.min(2, wheel * 2);
}

function buildColorPresetFilter(preset: string): string {
    const eq = getGraphicsConfig().videoFilters?.colorPresets?.find((item) => item.id === preset)?.ffmpeg?.eq;
    if (!eq || Object.keys(eq).length === 0) return '';

    const parts = Object.entries(eq)
        .filter(([, value]) => Number.isFinite(value))
        .map(([key, value]) => `${key}=${value}`);

    if (!parts.length) return '';
    return `eq=${parts.join(':')}`;
}

async function probeDurationSeconds(ffprobePath: string, sourcePath: string): Promise<number> {
    try {
        const output = await runBinary(ffprobePath, [
            '-v',
            'error',
            '-show_entries',
            'format=duration',
            '-of',
            'default=noprint_wrappers=1:nokey=1',
            sourcePath,
        ]);
        const duration = Number.parseFloat(output);
        return Number.isFinite(duration) ? duration : 0;
    } catch {
        return 0;
    }
}

async function probeHasAudioStream(ffprobePath: string, sourcePath: string): Promise<boolean> {
    try {
        const output = await runBinary(ffprobePath, [
            '-v',
            'error',
            '-select_streams',
            'a:0',
            '-show_entries',
            'stream=index',
            '-of',
            'csv=p=0',
            sourcePath,
        ]);
        return output.trim().length > 0;
    } catch {
        return false;
    }
}

function sanitizeFileName(value: string): string {
    return value.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').trim() || 'portrait';
}

function getLoopTempPath(sourcePath: string): string {
    const parsed = path.parse(sourcePath);
    const outputDir = path.join(app.getPath('temp'), 'HexX Forge', 'graphics-loops');
    fs.mkdirSync(outputDir, { recursive: true });
    return path.join(outputDir, `${sanitizeFileName(parsed.name)}_loop_${Date.now()}.webm`);
}

function writeTempPngDataUrl(dataUrl: string, prefix: string): string {
    const match = dataUrl.match(/^data:image\/png;base64,(.+)$/);
    if (!match) throw new Error('Invalid PNG data.');
    const outputDir = path.join(app.getPath('temp'), 'HexX Forge', 'graphics-masks');
    fs.mkdirSync(outputDir, { recursive: true });
    const filePath = path.join(outputDir, `${sanitizeFileName(prefix)}_${Date.now()}.png`);
    fs.writeFileSync(filePath, Buffer.from(match[1], 'base64'));
    return filePath;
}

function sendProgress(webContents: WebContents | undefined, payload: ProgressPayload): void {
    webContents?.send('graphics:progress', payload);
}

function runFfmpegWithProgress({
    ffmpegPath,
    args,
    durationSeconds,
    webContents,
    operationId,
    type,
}: {
    ffmpegPath: string;
    args: string[];
    durationSeconds: number;
    webContents?: WebContents;
    operationId?: string;
    type: ProgressPayload['type'];
}): Promise<string> {
    return new Promise((resolve, reject) => {
        const child = spawn(ffmpegPath, ['-nostats', '-progress', 'pipe:1', ...args], {
            windowsHide: true,
            env: {
                ...process.env,
                FREI0R_PATH: getFrei0rFilterDir(),
            },
        });
        let stdout = '';
        let stderr = '';
        let progressBuffer = '';

        sendProgress(webContents, {
            operationId,
            type,
            state: 'running',
            percent: 0,
            message: 'Starting FFmpeg...',
        });

        child.stdout.on('data', (chunk: Buffer) => {
            const text = chunk.toString();
            stdout += text;
            progressBuffer += text;

            const lines = progressBuffer.split(/\r?\n/);
            progressBuffer = lines.pop() || '';

            for (const line of lines) {
                const [key, value] = line.split('=');
                if ((key === 'out_time_ms' || key === 'out_time_us') && durationSeconds > 0) {
                    const outTimeSeconds = Number(value) / 1_000_000;
                    const percent = Math.max(0, Math.min(99, Math.round((outTimeSeconds / durationSeconds) * 100)));
                    sendProgress(webContents, {
                        operationId,
                        type,
                        state: 'running',
                        percent,
                        message: `Processing... ${percent}%`,
                    });
                }

                if (key === 'progress' && value === 'end') {
                    sendProgress(webContents, {
                        operationId,
                        type,
                        state: 'completed',
                        percent: 100,
                        message: 'Completed.',
                    });
                }
            }
        });

        child.stderr.on('data', (chunk: Buffer) => {
            stderr += chunk.toString();
        });

        child.on('error', (error) => {
            sendProgress(webContents, {
                operationId,
                type,
                state: 'error',
                message: error.message,
            });
            reject(error);
        });

        child.on('close', (code) => {
            if (code === 0) {
                sendProgress(webContents, {
                    operationId,
                    type,
                    state: 'completed',
                    percent: 100,
                    message: 'Completed.',
                });
                resolve(stdout.trim() || stderr.trim());
                return;
            }

            const message = stderr.trim() || `FFmpeg exited with code ${code}.`;
            sendProgress(webContents, {
                operationId,
                type,
                state: 'error',
                message,
            });
            reject(new Error(message));
        });
    });
}

function buildVideoBranchFilters(options: VideoExportOptions, includeShotcut: boolean): string[] {
    const { width } = PRESET_SIZE[options.preset];
    const sourceWidth = Math.max(2, Math.round((width * options.transform.scale) / 100));
    const filters: string[] = [
        'setpts=PTS-STARTPTS',
        'bwdif=mode=send_frame:parity=auto:deint=all',
    ];

    if (includeShotcut) filters.push(...buildShotcutFilterSegments(options.filters.shotcutFilters));

    if (options.interpolation === 'motion') {
        filters.push('minterpolate=fps=60:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1');
    }

    filters.push(`scale=${sourceWidth}:-2:flags=lanczos`);

    if (includeShotcut && options.filters.chromaEnabled) {
        filters.push(
            `chromakey=${normalizeHexColor(options.filters.keyColor)}:${options.filters.similarity.toFixed(2)}:${options.filters.blend.toFixed(2)}`
        );
    }

    const colorPreset = buildColorPresetFilter(options.filters.colorPreset);
    if (colorPreset) filters.push(colorPreset);

    if (options.filters.saturation !== 100) {
        filters.push(`eq=saturation=${(options.filters.saturation / 100).toFixed(2)}`);
    }

    if (options.filters.alpha !== 100) {
        filters.push(`colorchannelmixer=aa=${(options.filters.alpha / 100).toFixed(2)}`);
    }

    return filters;
}

function buildVideoFilter(options: VideoExportOptions, hasChromaMask: boolean): string {
    const { width, height } = PRESET_SIZE[options.preset];
    const scaleFactor = options.preset === 'high' ? 1 : width / PRESET_SIZE.high.width;
    const x = Math.round(options.transform.x * scaleFactor);
    const y = Math.round(options.transform.y * scaleFactor);
    const overlayX = `(W-w)/2+${x}`;
    const overlayY = `(H-h)/2+${y}`;
    const filters = buildVideoBranchFilters(options, true);

    if (hasChromaMask) {
        const originalFilters = buildVideoBranchFilters(options, false);
        return [
            `nullsrc=s=${width}x${height}:r=30,format=rgba[base_original]`,
            `nullsrc=s=${width}x${height}:r=30,format=rgba[base_keyed]`,
            `[0:v]${originalFilters.join(',')}[fg_original]`,
            `[base_original][fg_original]overlay=${overlayX}:${overlayY}:format=auto:shortest=1,format=rgba[original]`,
            `[0:v]${filters.join(',')}[fg_keyed]`,
            `[base_keyed][fg_keyed]overlay=${overlayX}:${overlayY}:format=auto:shortest=1,format=rgba[keyed]`,
            `[1:v]scale=${width}:${height}:flags=lanczos,format=gray[mask]`,
            '[original][keyed][mask]maskedmerge,format=yuva420p',
        ].join(';');
    }

    return `nullsrc=s=${width}x${height}:r=30,format=rgba[base];[0:v]${filters.join(',')}[fg];[base][fg]overlay=${overlayX}:${overlayY}:format=auto:shortest=1,format=yuva420p`;
}

async function selectExportPath(defaultName: string, extension: 'png' | 'webm') {
    const result = await dialog.showSaveDialog({
        title: 'Select export path',
        defaultPath: defaultName.endsWith(`.${extension}`) ? defaultName : `${defaultName}.${extension}`,
        filters: [{ name: extension.toUpperCase(), extensions: [extension] }],
    });

    if (result.canceled || !result.filePath) return null;
    return result.filePath;
}

export async function exportPortraitImage(options: ImageExportOptions) {
    const filePath = await selectExportPath(options.defaultName || 'portrait', 'png');
    if (!filePath) return null;

    const match = options.dataUrl.match(/^data:image\/png;base64,(.+)$/);
    if (!match) throw new Error('Invalid PNG data.');

    fs.writeFileSync(filePath, Buffer.from(match[1], 'base64'));
    return { path: filePath };
}

export async function exportPortraitVideo(options: VideoExportOptions, webContents?: WebContents) {
    const status = await checkFfmpeg();
    if (!status.ok) throw new Error(status.message);

    const filePath = await selectExportPath('portrait_video', 'webm');
    if (!filePath) return null;

    const chromaMaskPath = options.chromaMaskDataUrl ? writeTempPngDataUrl(options.chromaMaskDataUrl, 'chroma_mask') : '';
    const filter = buildVideoFilter(options, Boolean(chromaMaskPath));
    const commandArgs = [
        '-y',
        '-i',
        options.sourcePath,
        ...(chromaMaskPath ? ['-loop', '1', '-i', chromaMaskPath] : []),
        '-filter_complex',
        `${filter}[vout]`,
        '-map',
        '[vout]',
    ];

    if (options.includeAudio) {
        commandArgs.push('-map', '0:a?', '-c:a', 'libvorbis');
    } else {
        commandArgs.push('-an');
    }

    commandArgs.push(
        '-c:v',
        'libvpx',
        '-pix_fmt',
        'yuva420p',
        '-auto-alt-ref',
        '0',
        '-g',
        '30',
        '-lag-in-frames',
        '0',
        '-deadline',
        'best',
        '-cpu-used',
        '0',
        '-b:v',
        options.preset === 'high' ? '8M' : '4M',
        '-minrate',
        '0',
        '-maxrate',
        options.preset === 'high' ? '12M' : '6M',
        '-bufsize',
        options.preset === 'high' ? '16M' : '8M',
        filePath
    );

    const durationSeconds = await probeDurationSeconds(status.ffprobePath, options.sourcePath);
    await runFfmpegWithProgress({
        ffmpegPath: status.ffmpegPath,
        args: commandArgs,
        durationSeconds,
        webContents,
        operationId: options.operationId,
        type: 'export-video',
    });
    return { path: filePath };
}

export async function createPortraitLoop(options: LoopOptions, webContents?: WebContents) {
    const status = await checkFfmpeg();
    if (!status.ok) throw new Error(status.message);

    const filePath = getLoopTempPath(options.sourcePath);
    const hasAudio = await probeHasAudioStream(status.ffprobePath, options.sourcePath);
    const includeAudio = options.includeAudio && hasAudio;

    const filter = includeAudio
        ? '[0:v]setpts=PTS-STARTPTS[v0];[0:v]reverse,setpts=PTS-STARTPTS[v1];[0:a]asetpts=PTS-STARTPTS[a0];[0:a]areverse,asetpts=PTS-STARTPTS[a1];[v0][a0][v1][a1]concat=n=2:v=1:a=1[v][a]'
        : '[0:v]setpts=PTS-STARTPTS[v0];[0:v]reverse,setpts=PTS-STARTPTS[v1];[v0][v1]concat=n=2:v=1:a=0[v]';

    const args = ['-y', '-i', options.sourcePath, '-filter_complex', filter, '-map', '[v]'];

    if (includeAudio) {
        args.push('-map', '[a]', '-c:a', 'libvorbis', '-q:a', '6');
    } else {
        args.push('-an');
    }

    args.push(
        '-c:v',
        'libvpx',
        '-pix_fmt',
        'yuva420p',
        '-auto-alt-ref',
        '0',
        '-g',
        '30',
        '-lag-in-frames',
        '0',
        '-deadline',
        'best',
        '-cpu-used',
        '0',
        '-b:v',
        '8M',
        '-minrate',
        '0',
        '-maxrate',
        '12M',
        '-bufsize',
        '16M',
        filePath
    );

    const durationSeconds = (await probeDurationSeconds(status.ffprobePath, options.sourcePath)) * 2;
    await runFfmpegWithProgress({
        ffmpegPath: status.ffmpegPath,
        args,
        durationSeconds,
        webContents,
        operationId: options.operationId,
        type: 'create-loop',
    });
    return { path: filePath, url: toSelectedMediaProtocolUrl(filePath), name: path.basename(filePath), audioIncluded: includeAudio };
}
