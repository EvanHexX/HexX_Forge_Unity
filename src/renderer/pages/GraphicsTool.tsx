import { useCallback, useEffect, useRef, useState } from 'react';
import type { Dispatch, DragEvent, PointerEvent, ReactNode, SetStateAction } from 'react';
import {
    Alert,
    Box,
    Button,
    Checkbox,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    FormControl,
    FormControlLabel,
    IconButton,
    InputLabel,
    LinearProgress,
    MenuItem,
    Paper,
    Select,
    Slider,
    Stack,
    Tab,
    Tabs,
    TextField,
    ToggleButton,
    ToggleButtonGroup,
    Tooltip,
    Typography,
} from '@mui/material';
import AddPhotoAlternateIcon from '@mui/icons-material/AddPhotoAlternate';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import ColorizeIcon from '@mui/icons-material/Colorize';
import FileOpenIcon from '@mui/icons-material/FileOpen';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import LoopIcon from '@mui/icons-material/Loop';
import MovieCreationIcon from '@mui/icons-material/MovieCreation';
import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import SaveIcon from '@mui/icons-material/Save';
import SettingsIcon from '@mui/icons-material/Settings';
import StopIcon from '@mui/icons-material/Stop';
import TuneIcon from '@mui/icons-material/Tune';
import VisibilityIcon from '@mui/icons-material/Visibility';
import CloseIcon from '@mui/icons-material/Close';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import { useNotification } from '../context/NotificationContext';
import { DEFAULT_LANGUAGE, getSafeLanguage, t, type LanguageCode } from '../i18n';

type GraphicsTab = 'video' | 'image' | 'rigging';
type PortraitOutputPreset = 'standard' | 'high';
type OperationState = 'idle' | 'selecting-output' | 'creating-loop' | 'exporting-video' | 'exporting-image';

type PortraitTransform = {
    x: number;
    y: number;
    scale: number;
};

type OverlayState = {
    silhouette: boolean;
    guide: boolean;
    alphaView: boolean;
    maskView: boolean;
    silhouetteOpacity: number;
    guideColor: string;
};

type GraphicsAssets = {
    silhouetteUrl: string;
    guideUrl: string;
    riggingMockupUrl: string;
};

type GraphicsFile = {
    path: string;
    url: string;
    name: string;
    audioIncluded?: boolean;
};

type FfmpegStatus = {
    ok: boolean;
    ffmpegPath: string;
    ffprobePath: string;
    version: string;
    message: string;
    supportsFrei0r?: boolean;
    frei0rPath?: string;
    missingFrei0rPlugins?: string[];
    failedFrei0rPlugins?: string[];
};

type ColorPresetConfig = {
    id: string;
    label: string;
    labels?: Record<string, string>;
    preview?: {
        brightness?: number;
        contrast?: number;
        saturation?: number;
        sepia?: number;
        hueRotate?: number;
    };
};

type GraphicsConfig = {
    videoFilters?: {
        filters?: GraphicsFilterRegistryItem[];
        colorPresets?: ColorPresetConfig[];
    };
};

type GraphicsFilterRegistryItem = {
    id: keyof ShotcutVideoFilters;
    labels: Record<string, string>;
    engine: 'frei0r' | 'ffmpeg-native';
    pluginFile?: string;
    enabled: boolean;
};

type ShotcutVideoFilters = {
    chromaKeyAdvanced: {
        enabled: boolean;
        presetId?: string;
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
    keySpillAdvanced: {
        enabled: boolean;
        presetId?: string;
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
        showMask: boolean;
        maskAlpha: boolean;
    };
    alphaChannelAdjust: {
        enabled: boolean;
        operation: number;
        threshold: number;
        amount: number;
        invert: boolean;
    };
    saturation: {
        enabled: boolean;
        level: number;
    };
    contrast: {
        enabled: boolean;
        level: number;
    };
    colorGrading: {
        enabled: boolean;
        lift: { r: number; g: number; b: number };
        gamma: { r: number; g: number; b: number };
        gain: { r: number; g: number; b: number };
    };
};

type PlaybackState = {
    currentTime: number;
    duration: number;
    playing: boolean;
};

type VideoPreviewController = {
    play: () => Promise<void>;
    pause: () => void;
    stop: () => void;
    seek: (seconds: number) => Promise<void>;
    getState: () => PlaybackState;
};

type VideoFrameCallbackVideo = HTMLVideoElement & {
    requestVideoFrameCallback?: (callback: () => void) => number;
    cancelVideoFrameCallback?: (handle: number) => void;
};

type ColorGradingGroup = 'lift' | 'gamma' | 'gain';
type ColorChannel = 'r' | 'g' | 'b';

type ChromaMaskState = {
    enabled: boolean;
    dirty: boolean;
    mode: 'paint' | 'erase';
    brushSize: number;
    dataUrl?: string;
};

type GraphicsProgress = {
    operationId?: string;
    type: 'export-video' | 'create-loop';
    state: 'running' | 'completed' | 'error';
    percent?: number;
    message: string;
};

type ShotcutPreviewOptions = {
    cssFilter: string;
    filters: ShotcutVideoFilters;
    chromaMaskDataUrl?: string;
    imageBackgroundAlpha?: ImageBackgroundAlphaPreview;
};

type ImageBackgroundAlphaPreview = {
    enabled: boolean;
    keyColor: string;
    tolerance: number;
    softness: number;
};

const OUTPUT_PRESETS: Record<PortraitOutputPreset, { label: string; width: number; height: number }> = {
    high: { label: 'High 1200 x 1500', width: 1200, height: 1500 },
    standard: { label: 'Standard 560 x 700', width: 560, height: 700 },
};

const FALLBACK_COLOR_PRESETS: ColorPresetConfig[] = [
    { id: 'neutral', label: 'Neutral', labels: { en: 'Neutral', ko: '중립', 'zh-CN': '中性' }, preview: { brightness: 1, contrast: 1, saturation: 1, sepia: 0, hueRotate: 0 } },
    { id: 'warm', label: 'Warm', labels: { en: 'Warm', ko: '따뜻함', 'zh-CN': '暖色' }, preview: { brightness: 1.01, contrast: 1.04, saturation: 1.08, sepia: 0.06, hueRotate: 0 } },
    { id: 'cool', label: 'Cool', labels: { en: 'Cool', ko: '차가움', 'zh-CN': '冷色' }, preview: { brightness: 1, contrast: 1.03, saturation: 0.96, sepia: 0, hueRotate: -6 } },
    { id: 'dramatic', label: 'Dramatic', labels: { en: 'Dramatic', ko: '극적', 'zh-CN': '戏剧化' }, preview: { brightness: 0.99, contrast: 1.12, saturation: 1.16, sepia: 0, hueRotate: 0 } },
];

const SHOTCUT_FILTER_REGISTRY_FALLBACK: GraphicsFilterRegistryItem[] = [
    { id: 'chromaKeyAdvanced', labels: { ko: '크로마 키: 고급', en: 'Chroma Key: Advanced', 'zh-CN': '色鍵：進階' }, engine: 'frei0r', pluginFile: 'select0r.dll', enabled: true },
    { id: 'keySpillAdvanced', labels: { ko: '키 스필: 고급', en: 'Key Spill: Advanced', 'zh-CN': '色键溢色: 高级' }, engine: 'frei0r', pluginFile: 'keyspillm0pup.dll', enabled: true },
    { id: 'alphaChannelAdjust', labels: { ko: '알파 채널: 조정', en: 'Alpha Channel: Adjust', 'zh-CN': '透明通道: 调节' }, engine: 'frei0r', pluginFile: 'alpha0ps_alpha0ps.dll', enabled: true },
    { id: 'saturation', labels: { ko: '채도', en: 'Saturation', 'zh-CN': '饱和度' }, engine: 'frei0r', pluginFile: 'saturat0r.dll', enabled: true },
    { id: 'contrast', labels: { ko: '대비', en: 'Contrast', 'zh-CN': '對比' }, engine: 'ffmpeg-native', enabled: true },
    { id: 'colorGrading', labels: { ko: '색 보정', en: 'Color Grading', 'zh-CN': '色彩分级' }, engine: 'ffmpeg-native', enabled: true },
];

const DEFAULT_SHOTCUT_FILTERS: ShotcutVideoFilters = {
    chromaKeyAdvanced: {
        enabled: false,
        keyColor: '#00cc00',
        invert: false,
        deltaR: 0.2,
        deltaG: 0.2,
        deltaB: 0.2,
        slope: 0,
        colorSpace: 0,
        shape: 0.5,
        edge: 0.9,
        operation: 0.5,
    },
    keySpillAdvanced: {
        enabled: false,
        keyColor: '#19cc19',
        targetColor: '#c67f66',
        maskType: 0,
        tolerance: 0.24,
        slope: 0.4,
        hueGate: 0.25,
        saturationThreshold: 0.15,
        operation1: 1,
        amount1: 0.5,
        operation2: 0,
        amount2: 0.5,
        showMask: false,
        maskAlpha: false,
    },
    alphaChannelAdjust: {
        enabled: false,
        operation: 0,
        threshold: 0.5,
        amount: 0.5,
        invert: false,
    },
    saturation: {
        enabled: false,
        level: 100,
    },
    contrast: {
        enabled: false,
        level: 50,
    },
    colorGrading: {
        enabled: false,
        lift: { r: 0, g: 0, b: 0 },
        gamma: { r: 0, g: 0, b: 0 },
        gain: { r: 0, g: 0, b: 0 },
    },
};

const DEFAULT_TRANSFORM: PortraitTransform = { x: 0, y: 0, scale: 100 };
const DEFAULT_OVERLAYS: OverlayState = {
    silhouette: true,
    guide: true,
    alphaView: false,
    maskView: false,
    silhouetteOpacity: 72,
    guideColor: '#39c5ff',
};

const DEFAULT_CHROMA_MASK: ChromaMaskState = {
    enabled: false,
    dirty: false,
    mode: 'paint',
    brushSize: 42,
};

const panelSx = {
    background: 'var(--sidebar-bg-color)',
    color: 'var(--text-color)',
    border: '1px solid var(--border-color)',
    boxShadow: 'var(--shadow-small)',
};

const innerPanelSx = {
    background: 'var(--bg-color)',
    color: 'var(--text-color)',
    border: '1px solid var(--border-color)',
    boxShadow: 'none',
};

const inputSx = {
    input: { color: 'var(--text-color)' },
    label: { color: 'var(--text-color-light)' },
    '& .MuiOutlinedInput-root': {
        backgroundColor: 'var(--input-bg-color)',
        '& fieldset': { borderColor: 'var(--border-color)' },
        '&:hover fieldset': { borderColor: 'var(--primary-color)' },
    },
};

const selectSx = {
    color: 'var(--text-color)',
    background: 'var(--input-bg-color)',
    '& .MuiOutlinedInput-notchedOutline': { borderColor: 'var(--border-color)' },
    '& .MuiSvgIcon-root': { color: 'var(--text-color-light)' },
};

const dialogPaperSx = {
    background: 'var(--sidebar-bg-color)',
    color: 'var(--text-color)',
    border: '1px solid var(--border-color)',
};

const outlinedButtonSx = {
    borderColor: 'var(--border-color)',
    color: 'var(--text-color)',
    '&:hover': {
        background: 'var(--hover-bg-color)',
        borderColor: 'var(--border-color)',
    },
};

const sliderSx = {
    color: 'var(--primary-color)',
    '& .MuiSlider-rail': { color: 'var(--border-color)' },
};

const checkerboard = {
    backgroundColor: '#777',
    backgroundImage:
        'linear-gradient(45deg, #aaa 25%, transparent 25%), linear-gradient(-45deg, #aaa 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #aaa 75%), linear-gradient(-45deg, transparent 75%, #aaa 75%)',
    backgroundSize: '24px 24px',
    backgroundPosition: '0 0, 0 12px, 12px -12px, -12px 0',
};

const twoColumnSx = {
    display: 'grid',
    gridTemplateColumns: { xs: '1fr', lg: 'minmax(520px, 680px) minmax(520px, 780px)' },
    justifyContent: 'center',
    gap: 2,
    width: '100%',
    maxWidth: 1500,
    mx: 'auto',
};

const sidePanelGridSx = {
    display: 'grid',
    gridTemplateColumns: { xs: '1fr', xl: 'repeat(2, minmax(0, 1fr))' },
    gap: 2,
};

const fullWidthGridItemSx = {
    gridColumn: { xs: 'auto', xl: '1 / -1' },
};

const filterRowsGridSx = {
    display: 'grid',
    gridTemplateColumns: { xs: '1fr', xl: 'repeat(2, minmax(0, 1fr))' },
    gap: 1,
    alignItems: 'start',
};

const innerTwoColumnSx = {
    display: 'grid',
    gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 2fr) minmax(260px, 1fr)' },
    gap: 2,
};

const select0rShapeOptions = [
    { value: 0, label: 'Box' },
    { value: 0.5, label: 'Ellipsoid' },
    { value: 1, label: 'Diamond' },
];

const select0rEdgeOptions = [
    { value: 0, label: 'Hard' },
    { value: 0.35, label: 'Fat' },
    { value: 0.6, label: 'Normal' },
    { value: 0.7, label: 'Thin' },
    { value: 0.9, label: 'Slope' },
];

const select0rOperationOptions = [
    { value: 0, label: 'Overwrite' },
    { value: 0.3, label: 'Maximum' },
    { value: 0.5, label: 'Minimum' },
    { value: 0.7, label: 'Add' },
    { value: 1, label: 'Subtract' },
];

const keySpillMaskOptions = ['Color Distance', 'Transparency', 'Edge Inwards', 'Edge Outwards'];
const keySpillOperationOptions = ['None', 'De-Key', 'Desaturate', 'Adjust Luma'];
const alphaOperationOptions = [
    { value: 0, label: 'No Change' },
    { value: 0.2, label: 'Shave' },
    { value: 0.3, label: 'Shrink Hard' },
    { value: 0.4, label: 'Shrink Soft' },
    { value: 0.6, label: 'Grow Hard' },
    { value: 0.7, label: 'Grow Soft' },
    { value: 0.8, label: 'Threshold' },
    { value: 1, label: 'Blur' },
    { value: -1, label: 'Reset' },
];

function getErrorMessage(error: unknown, fallback: string): string {
    return error instanceof Error ? error.message : fallback;
}

function getErrorLog(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

function createOperationId(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeHexInput(value: string): string {
    const trimmed = value.trim();
    if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) return trimmed;
    if (/^[0-9a-fA-F]{6}$/.test(trimmed)) return `#${trimmed}`;
    return value;
}

function isValidColorInput(value: string): boolean {
    return /^#[0-9a-fA-F]{6}$/.test(value);
}

function percentValue(value: number): number {
    return Number((value * 100).toFixed(1));
}

function fromPercentValue(value: number): number {
    return Number((value / 100).toFixed(3));
}

function formatTime(seconds: number): string {
    if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';
    const minutes = Math.floor(seconds / 60);
    const rest = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${minutes}:${rest}`;
}

function formatTimelineTime(seconds: number): string {
    const safeSeconds = Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
    const hours = Math.floor(safeSeconds / 3600);
    const minutes = Math.floor((safeSeconds % 3600) / 60);
    const wholeSeconds = Math.floor(safeSeconds % 60);
    const milliseconds = Math.floor((safeSeconds % 1) * 1000);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${wholeSeconds
        .toString()
        .padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
}

function formatRulerTime(seconds: number): string {
    const safeSeconds = Math.max(0, Math.floor(seconds));
    const hours = Math.floor(safeSeconds / 3600);
    const minutes = Math.floor((safeSeconds % 3600) / 60);
    const wholeSeconds = safeSeconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${wholeSeconds
        .toString()
        .padStart(2, '0')}`;
}

function buildPreviewFilter(preset: ColorPresetConfig | undefined, saturation: number, alpha: number, contrastLevel: number): string {
    const preview = preset?.preview || FALLBACK_COLOR_PRESETS[0].preview || {};
    const brightness = preview.brightness ?? 1;
    const presetContrast = preview.contrast ?? 1;
    const presetSaturation = preview.saturation ?? 1;
    const sepia = preview.sepia ?? 0;
    const hueRotate = preview.hueRotate ?? 0;
    const nextSaturation = presetSaturation * (saturation / 100);
    const nextContrast = presetContrast * Math.max(0.1, contrastLevel / 50);
    const opacity = Math.max(0, Math.min(1, alpha / 100));

    return [
        `brightness(${brightness})`,
        `contrast(${nextContrast})`,
        `saturate(${nextSaturation})`,
        `sepia(${sepia})`,
        `hue-rotate(${hueRotate}deg)`,
        `opacity(${opacity})`,
    ].join(' ');
}

function wheelToScale(value: number): number {
    const wheel = (value / 100 + 1) / 2;
    if (wheel < 0.5) return 0.5 + wheel;
    if (wheel === 0.5) return 1;
    return wheel * 2;
}

function clampByte(value: number): number {
    return Math.max(0, Math.min(255, Math.round(value)));
}

function clampPercent(value: number): number {
    return Math.max(-100, Math.min(100, Number(value.toFixed(1))));
}

function spinnerToWheel(value: number): number {
    return (clampPercent(value) / 100 + 1) / 2;
}

function applyColorGradingChannel(channelValue: number, lift: number, gamma: number, gain: number): number {
    const normalized = Math.max(0, Math.min(1, channelValue / 255));
    const lifted = Math.max(0, Math.min(1, normalized + (lift / 100) * 0.38 * (1 - normalized)));
    const gammaScale = wheelToScale(gamma);
    const gammaAdjusted = Math.pow(lifted, 1 / Math.max(0.1, gammaScale));
    const gained = gammaAdjusted * (1 + (gain / 100) * 0.85 * gammaAdjusted);
    return clampByte(gained * 255);
}

function getGroupMasterValue(groupValue: Record<ColorChannel, number>): number {
    return Number(((groupValue.r + groupValue.g + groupValue.b) / 3).toFixed(1));
}

function hslToRgb(hue: number, saturation: number, lightness: number): Record<ColorChannel, number> {
    const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
    const huePrime = hue / 60;
    const x = chroma * (1 - Math.abs((huePrime % 2) - 1));
    let r = 0;
    let g = 0;
    let b = 0;

    if (huePrime >= 0 && huePrime < 1) [r, g, b] = [chroma, x, 0];
    else if (huePrime < 2) [r, g, b] = [x, chroma, 0];
    else if (huePrime < 3) [r, g, b] = [0, chroma, x];
    else if (huePrime < 4) [r, g, b] = [0, x, chroma];
    else if (huePrime < 5) [r, g, b] = [x, 0, chroma];
    else [r, g, b] = [chroma, 0, x];

    const m = lightness - chroma / 2;
    return {
        r: clampPercent(((r + m) * 2 - 1) * 100),
        g: clampPercent(((g + m) * 2 - 1) * 100),
        b: clampPercent(((b + m) * 2 - 1) * 100),
    };
}

function getLocalizedLabel(labels: Record<string, string> | undefined, language: LanguageCode, fallback: string): string {
    return labels?.[language] || labels?.en || fallback;
}

function getFilterLabel(filter: GraphicsFilterRegistryItem, language: LanguageCode): string {
    return getLocalizedLabel(filter.labels, language, filter.id);
}

function getColorPresetLabel(preset: ColorPresetConfig, language: LanguageCode): string {
    return getLocalizedLabel(preset.labels, language, preset.label || preset.id);
}

function hexToRgb(value: string): [number, number, number] | null {
    const match = /^#?([0-9a-fA-F]{6})$/.exec(value.trim());
    if (!match) return null;
    return [
        Number.parseInt(match[1].slice(0, 2), 16),
        Number.parseInt(match[1].slice(2, 4), 16),
        Number.parseInt(match[1].slice(4, 6), 16),
    ];
}

function rgbToHci(r: number, g: number, b: number): [number, number, number] {
    const normalizedR = r / 255;
    const normalizedG = g / 255;
    const normalizedB = b / 255;
    const max = Math.max(normalizedR, normalizedG, normalizedB);
    const min = Math.min(normalizedR, normalizedG, normalizedB);
    const chroma = max - min;
    let hue = 0;

    if (chroma > 0) {
        if (max === normalizedR) hue = ((normalizedG - normalizedB) / chroma) % 6;
        else if (max === normalizedG) hue = (normalizedB - normalizedR) / chroma + 2;
        else hue = (normalizedR - normalizedG) / chroma + 4;
        hue /= 6;
        if (hue < 0) hue += 1;
    }

    return [hue, chroma, (normalizedR + normalizedG + normalizedB) / 3];
}

function hueDistance(a: number, b: number): number {
    const diff = Math.abs(a - b);
    return Math.min(diff, 1 - diff);
}

function getShapeMetric(diffs: [number, number, number], tolerances: [number, number, number], shape: number): number {
    const scaled = diffs.map((diff, index) => diff / Math.max(0.0001, tolerances[index])) as [number, number, number];
    if (shape <= 0.1) return Math.max(...scaled);
    if (shape >= 0.9) return scaled[0] + scaled[1] + scaled[2];
    return Math.sqrt(scaled[0] * scaled[0] + scaled[1] * scaled[1] + scaled[2] * scaled[2]);
}

function getChromaKeySelection(r: number, g: number, b: number, chroma: ShotcutVideoFilters['chromaKeyAdvanced'], keyRgb: [number, number, number]): number {
    const pixelValues = chroma.colorSpace === 1 ? rgbToHci(r, g, b) : [r / 255, g / 255, b / 255] as [number, number, number];
    const keyValues = chroma.colorSpace === 1 ? rgbToHci(keyRgb[0], keyRgb[1], keyRgb[2]) : [keyRgb[0] / 255, keyRgb[1] / 255, keyRgb[2] / 255] as [number, number, number];
    const diffs: [number, number, number] = chroma.colorSpace === 1
        ? [hueDistance(pixelValues[0], keyValues[0]), Math.abs(pixelValues[1] - keyValues[1]), Math.abs(pixelValues[2] - keyValues[2])]
        : [Math.abs(pixelValues[0] - keyValues[0]), Math.abs(pixelValues[1] - keyValues[1]), Math.abs(pixelValues[2] - keyValues[2])];
    const metric = getShapeMetric(diffs, [chroma.deltaR, chroma.deltaG, chroma.deltaB], chroma.shape);

    if (chroma.edge <= 0.05) return metric <= 1 ? 1 : 0;
    if (chroma.edge >= 0.85) {
        const slope = Math.max(0, chroma.slope);
        if (metric <= 1) return 1;
        if (slope <= 0) return 0;
        return Math.max(0, Math.min(1, 1 - (metric - 1) / slope));
    }

    if (metric >= 1) return 0;
    const edgeFill = chroma.edge <= 0.4 ? 0.8 : chroma.edge <= 0.65 ? 0.5 : 0.25;
    return Math.max(0, Math.min(1, 1 - Math.max(0, metric - edgeFill) / Math.max(0.001, 1 - edgeFill)));
}

function combineAlphaBySelect0rOperation(sourceAlpha: number, selectionAlpha: number, operation: number): number {
    if (operation <= 0.15) return selectionAlpha;
    if (operation < 0.4) return Math.max(sourceAlpha, selectionAlpha);
    if (operation < 0.6) return Math.min(sourceAlpha, selectionAlpha);
    if (operation < 0.85) return Math.min(1, sourceAlpha + selectionAlpha);
    return Math.max(0, sourceAlpha - selectionAlpha);
}

function applyAlphaChannelAdjustPreview(data: ImageData, alpha: ShotcutVideoFilters['alphaChannelAdjust']) {
    if (!alpha.enabled) return;

    const amount = Math.max(0, Math.min(1, alpha.amount));
    const threshold = Math.max(0, Math.min(1, alpha.threshold));
    const sourceAlpha = new Uint8ClampedArray(data.data.length / 4);
    for (let index = 0, pixel = 0; index < data.data.length; index += 4, pixel += 1) {
        sourceAlpha[pixel] = data.data[index + 3];
    }

    const width = data.width;
    const height = data.height;
    const radius = Math.max(1, Math.round(amount * 6));

    const sampleNeighborhood = (x: number, y: number, mode: 'min' | 'max' | 'avg') => {
        let value = mode === 'min' ? 255 : 0;
        let total = 0;
        let count = 0;
        for (let yy = Math.max(0, y - radius); yy <= Math.min(height - 1, y + radius); yy += 1) {
            for (let xx = Math.max(0, x - radius); xx <= Math.min(width - 1, x + radius); xx += 1) {
                const alphaValue = sourceAlpha[yy * width + xx];
                if (mode === 'min') value = Math.min(value, alphaValue);
                else if (mode === 'max') value = Math.max(value, alphaValue);
                else {
                    total += alphaValue;
                    count += 1;
                }
            }
        }
        return mode === 'avg' ? Math.round(total / Math.max(1, count)) : value;
    };

    for (let index = 0, pixel = 0; index < data.data.length; index += 4, pixel += 1) {
        const currentAlpha = sourceAlpha[pixel];
        const x = pixel % width;
        const y = Math.floor(pixel / width);
        let nextAlpha = currentAlpha;

        if (alpha.operation === 0) {
            nextAlpha = currentAlpha;
        } else if (alpha.operation >= 0.79 && alpha.operation < 0.9) {
            nextAlpha = currentAlpha / 255 < threshold ? 0 : 255;
        } else if (alpha.operation < 0.25) {
            nextAlpha = Math.max(0, Math.round(currentAlpha - amount * 255));
        } else if (alpha.operation < 0.5) {
            const eroded = sampleNeighborhood(x, y, alpha.operation < 0.35 ? 'min' : 'avg');
            nextAlpha = alpha.operation < 0.35 && eroded < 255 ? 0 : eroded;
        } else if (alpha.operation < 0.8) {
            const dilated = sampleNeighborhood(x, y, alpha.operation < 0.65 ? 'max' : 'avg');
            nextAlpha = alpha.operation < 0.65 && dilated > 0 ? 255 : Math.max(currentAlpha, dilated);
        } else if (alpha.operation >= 1) {
            nextAlpha = sampleNeighborhood(x, y, 'avg');
        }

        data.data[index + 3] = alpha.invert ? 255 - nextAlpha : nextAlpha;
    }
}

function applyImageBackgroundAlphaPreview(data: ImageData, options: ImageBackgroundAlphaPreview) {
    if (!options.enabled) return;
    const keyRgb = hexToRgb(options.keyColor);
    if (!keyRgb) return;

    for (let i = 0; i < data.data.length; i += 4) {
        const distance = Math.hypot(data.data[i] - keyRgb[0], data.data[i + 1] - keyRgb[1], data.data[i + 2] - keyRgb[2]);
        if (distance <= options.tolerance) {
            data.data[i + 3] = 0;
        } else if (options.softness > 0 && distance <= options.tolerance + options.softness) {
            const factor = (distance - options.tolerance) / options.softness;
            data.data[i + 3] = Math.round(data.data[i + 3] * factor);
        }
    }
}

function buildCanvasPreviewOptions(
    cssFilter: string,
    filters: ShotcutVideoFilters,
    chromaMaskDataUrl?: string,
    imageBackgroundAlpha?: ImageBackgroundAlphaPreview
): ShotcutPreviewOptions {
    return { cssFilter, filters, chromaMaskDataUrl, imageBackgroundAlpha };
}

function applyApproximateShotcutPreview(data: ImageData, options: ShotcutPreviewOptions, maskData?: Uint8ClampedArray) {
    const chroma = options.filters.chromaKeyAdvanced;
    const spill = options.filters.keySpillAdvanced;
    const chromaRgb = chroma.enabled ? hexToRgb(chroma.keyColor) : null;
    const spillRgb = spill.enabled ? hexToRgb(spill.keyColor) : null;
    const targetRgb = spill.enabled ? hexToRgb(spill.targetColor) : null;
    const spillTolerance = Math.max(1, spill.tolerance * 442);
    const spillSoftness = Math.max(1, spill.slope * 255);

    for (let i = 0; i < data.data.length; i += 4) {
        const maskAllowsChroma = !maskData || maskData[i + 3] > 0 || maskData[i] > 0;
        const r = data.data[i];
        const g = data.data[i + 1];
        const b = data.data[i + 2];

        if (chromaRgb && maskAllowsChroma) {
            const selectedStrength = getChromaKeySelection(r, g, b, chroma, chromaRgb);
            const currentAlpha = data.data[i + 3] / 255;
            const selectionAlpha = chroma.invert ? selectedStrength : 1 - selectedStrength;
            data.data[i + 3] = Math.round(combineAlphaBySelect0rOperation(currentAlpha, selectionAlpha, chroma.operation) * 255);
        }

        if (spillRgb && targetRgb) {
            const distance = Math.hypot(r - spillRgb[0], g - spillRgb[1], b - spillRgb[2]);
            if (distance <= spillTolerance + spillSoftness) {
                const amount = Math.max(0, Math.min(1, 1 - distance / (spillTolerance + spillSoftness))) * spill.amount1;
                data.data[i] = Math.round(r + (targetRgb[0] - r) * amount);
                data.data[i + 1] = Math.round(g + (targetRgb[1] - g) * amount);
                data.data[i + 2] = Math.round(b + (targetRgb[2] - b) * amount);
            }
        }

        const grading = options.filters.colorGrading;
        if (grading.enabled) {
            data.data[i] = applyColorGradingChannel(data.data[i], grading.lift.r, grading.gamma.r, grading.gain.r);
            data.data[i + 1] = applyColorGradingChannel(data.data[i + 1], grading.lift.g, grading.gamma.g, grading.gain.g);
            data.data[i + 2] = applyColorGradingChannel(data.data[i + 2], grading.lift.b, grading.gamma.b, grading.gain.b);
        }
    }

    applyAlphaChannelAdjustPreview(data, options.filters.alphaChannelAdjust);
}

function useOverlayShortcuts(setOverlays: Dispatch<SetStateAction<OverlayState>>) {
    useEffect(() => {
        const listener = (event: KeyboardEvent) => {
            const target = event.target as HTMLElement | null;
            const isTyping =
                target?.tagName === 'INPUT' ||
                target?.tagName === 'TEXTAREA' ||
                target?.isContentEditable;

            if (isTyping) return;
            if (event.ctrlKey || event.metaKey || event.altKey) return;

            const key = event.key.toLowerCase();
            const overlayKeyMap: Record<string, keyof Pick<OverlayState, 'silhouette' | 'guide' | 'alphaView' | 'maskView'>> = {
                s: 'silhouette',
                g: 'guide',
                a: 'alphaView',
                b: 'maskView',
            };
            const overlayKey = overlayKeyMap[key];

            if (overlayKey) {
                event.preventDefault();
                setOverlays((prev) => ({ ...prev, [overlayKey]: !prev[overlayKey] }));
            }
        };

        window.addEventListener('keydown', listener);
        return () => window.removeEventListener('keydown', listener);
    }, [setOverlays]);
}

function useCurrentLanguage() {
    const [language, setLanguage] = useState<LanguageCode>(DEFAULT_LANGUAGE);

    useEffect(() => {
        window.electronAPI
            .getSettings()
            .then((settings: { language?: unknown }) => setLanguage(getSafeLanguage(settings?.language)))
            .catch(() => setLanguage(DEFAULT_LANGUAGE));
    }, []);

    return language;
}

function createImageElement(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.crossOrigin = 'anonymous';
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('Image could not be loaded.'));
        image.src = url;
    });
}

function createMaskCanvas(dataUrl?: string): Promise<HTMLCanvasElement | null> {
    if (!dataUrl) return Promise.resolve(null);

    return createImageElement(dataUrl).then((image) => {
        const canvas = document.createElement('canvas');
        canvas.width = 1200;
        canvas.height = 1500;
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        return canvas;
    });
}

async function invertMaskDataUrl(dataUrl?: string): Promise<string | undefined> {
    const canvas = await createMaskCanvas(dataUrl);
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < data.data.length; i += 4) {
        const next = 255 - data.data[i + 3];
        data.data[i] = 255;
        data.data[i + 1] = 255;
        data.data[i + 2] = 255;
        data.data[i + 3] = next;
    }
    ctx.putImageData(data, 0, 0);
    return canvas.toDataURL('image/png');
}

function ControlSlider({
    label,
    tooltip,
    value,
    min,
    max,
    step = 1,
    decimals = 0,
    suffix = '',
    showInput = false,
    onChange,
}: {
    label: string;
    tooltip?: string;
    value: number;
    min: number;
    max: number;
    step?: number;
    decimals?: number;
    suffix?: string;
    showInput?: boolean;
    onChange: (value: number) => void;
}) {
    const clamp = (next: number) => Math.max(min, Math.min(max, next));
    const displayValue = decimals > 0 ? value.toFixed(decimals) : String(Math.round(value));

    return (
        <Box>
            <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                <Tooltip title={tooltip || label} arrow>
                    <Typography sx={{ color: 'var(--text-color)', fontSize: 13 }}>{label}</Typography>
                </Tooltip>
                {showInput ? (
                    <TextField
                        size="small"
                        type="number"
                        value={displayValue}
                        onChange={(event) => {
                            const next = Number(event.target.value);
                            if (Number.isFinite(next)) onChange(clamp(Number(next.toFixed(decimals))));
                        }}
                        slotProps={{
                            htmlInput: {
                                min,
                                max,
                                step,
                            },
                        }}
                        sx={{ ...inputSx, width: 96 }}
                    />
                ) : (
                    <Typography sx={{ color: 'var(--text-color-light)', fontSize: 12 }}>
                        {displayValue}{suffix}
                    </Typography>
                )}
            </Stack>
            <Slider
                size="small"
                value={value}
                min={min}
                max={max}
                step={step}
                onChange={(_, next) => {
                    const raw = Array.isArray(next) ? next[0] : next;
                    onChange(clamp(Number(raw.toFixed(decimals))));
                }}
                sx={sliderSx}
            />
            {showInput && suffix && (
                <Typography sx={{ mt: -0.5, color: 'var(--text-color-light)', fontSize: 11, textAlign: 'right' }}>
                    {suffix}
                </Typography>
            )}
        </Box>
    );
}

function TooltipButton({
    title,
    children,
}: {
    title: string;
    children: ReactNode;
}) {
    return (
        <Tooltip title={title} arrow>
            <span>{children}</span>
        </Tooltip>
    );
}

function CollapsiblePanel({
    title,
    tooltip,
    defaultExpanded = false,
    icon,
    children,
}: {
    title: string;
    tooltip: string;
    defaultExpanded?: boolean;
    icon?: ReactNode;
    children: ReactNode;
}) {
    const [expanded, setExpanded] = useState(defaultExpanded);

    return (
        <Paper sx={{ ...panelSx, overflow: 'hidden' }}>
            <Stack
                direction="row"
                spacing={1}
                onClick={() => setExpanded((prev) => !prev)}
                sx={{ alignItems: 'center', px: 2, py: 1.25, cursor: 'pointer' }}
            >
                {icon}
                <Tooltip title={tooltip} arrow>
                    <Typography sx={{ flex: 1, fontWeight: 700 }}>{title}</Typography>
                </Tooltip>
                <IconButton size="small" sx={{ color: 'var(--text-color-light)' }}>
                    {expanded ? <KeyboardArrowDownIcon fontSize="small" /> : <KeyboardArrowRightIcon fontSize="small" />}
                </IconButton>
            </Stack>
            {expanded && <Box sx={{ px: 2, pb: 2 }}>{children}</Box>}
        </Paper>
    );
}

function NumberSelect({
    label,
    tooltip,
    value,
    options,
    onChange,
}: {
    label: string;
    tooltip: string;
    value: number;
    options: Array<{ value: number; label: string }>;
    onChange: (value: number) => void;
}) {
    return (
        <Tooltip title={tooltip} arrow>
            <FormControl size="small" fullWidth sx={{ mt: 1 }}>
                <InputLabel sx={{ color: 'var(--text-color-light)' }}>{label}</InputLabel>
                <Select value={value} label={label} onChange={(event) => onChange(Number(event.target.value))} sx={selectSx}>
                    {options.map((option) => (
                        <MenuItem key={`${label}-${option.value}`} value={option.value}>
                            {option.label}
                        </MenuItem>
                    ))}
                </Select>
            </FormControl>
        </Tooltip>
    );
}

function ColorPickerField({
    label,
    value,
    onChange,
}: {
    label: string;
    value: string;
    onChange: (value: string) => void;
}) {
    const colorValue = isValidColorInput(value) ? value : '#00ff00';

    return (
        <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center', mt: 1 }}>
            <TextField
                size="small"
                label={label}
                value={value}
                onChange={(event) => onChange(normalizeHexInput(event.target.value))}
                sx={inputSx}
                fullWidth
            />
            <Box
                component="input"
                type="color"
                value={colorValue}
                onChange={(event) => onChange(event.target.value)}
                sx={{
                    width: 42,
                    height: 38,
                    p: 0.25,
                    border: '1px solid var(--border-color)',
                    borderRadius: 1,
                    background: 'var(--input-bg-color)',
                }}
            />
        </Stack>
    );
}

function OperationProgressPanel({
    state,
    percent,
    message,
}: {
    state: OperationState;
    percent?: number;
    message: string;
}) {
    if (state === 'idle') return null;

    const hasProgress = typeof percent === 'number';

    return (
        <Alert severity="info" sx={{ mt: 1.5 }}>
            <Typography sx={{ fontWeight: 700, mb: 0.75 }}>{message}</Typography>
            <LinearProgress
                variant={hasProgress ? 'determinate' : 'indeterminate'}
                value={hasProgress ? Math.max(0, Math.min(100, percent)) : undefined}
            />
            {hasProgress && (
                <Typography sx={{ mt: 0.5, fontSize: 12, color: 'var(--text-color-light)' }}>
                    {Math.round(percent)}%
                </Typography>
            )}
        </Alert>
    );
}

function VideoTimeline({
    currentTime,
    duration,
    disabled,
    playing,
    busy,
    seekStatusText,
    onSeek,
    onPlay,
    onPause,
    onStop,
    onMakeLoop,
    onExport,
    language,
}: {
    currentTime: number;
    duration: number;
    disabled: boolean;
    playing: boolean;
    busy: boolean;
    seekStatusText?: string;
    onSeek: (seconds: number) => void;
    onPlay: () => void;
    onPause: () => void;
    onStop: () => void;
    onMakeLoop: () => void;
    onExport: () => void;
    language: LanguageCode;
}) {
    const rulerRef = useRef<HTMLDivElement | null>(null);
    const dragFrameRef = useRef<number | null>(null);
    const lastPointerSecondsRef = useRef<number | null>(null);
    const [dragging, setDragging] = useState(false);
    const [draftTime, setDraftTime] = useState<number | null>(null);
    const safeDuration = Math.max(0, duration);
    const displayTime = draftTime ?? currentTime;
    const safeCurrent = Math.max(0, Math.min(displayTime, safeDuration || 0));
    const majorTickCount = Math.max(1, Math.ceil(safeDuration));
    const majorTicks = Array.from({ length: majorTickCount + 1 }, (_, index) => index).filter((value) => value <= safeDuration || value === 0);
    const playheadPercent = safeDuration > 0 ? (safeCurrent / safeDuration) * 100 : 0;

    useEffect(() => {
        if (!dragging) setDraftTime(null);
    }, [currentTime, dragging]);

    const getPointerSeconds = (event: PointerEvent<HTMLDivElement>) => {
        const rect = rulerRef.current?.getBoundingClientRect();
        if (!rect || safeDuration <= 0 || disabled) return null;
        const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
        return Number((ratio * safeDuration).toFixed(3));
    };

    const commitSeek = (seconds: number) => {
        setDraftTime(seconds);
        onSeek(seconds);
    };

    const seekFromPointer = (event: PointerEvent<HTMLDivElement>, throttle = false) => {
        const seconds = getPointerSeconds(event);
        if (seconds === null) return;
        lastPointerSecondsRef.current = seconds;
        if (!throttle) {
            commitSeek(seconds);
            return;
        }
        if (dragFrameRef.current !== null) return;
        dragFrameRef.current = window.requestAnimationFrame(() => {
            dragFrameRef.current = null;
            if (lastPointerSecondsRef.current !== null) commitSeek(lastPointerSecondsRef.current);
        });
    };

    useEffect(() => {
        return () => {
            if (dragFrameRef.current !== null) window.cancelAnimationFrame(dragFrameRef.current);
        };
    }, []);

    return (
        <Paper sx={{ ...innerPanelSx, mt: 1.5, p: 1 }}>
            <Box
                ref={rulerRef}
                onPointerDown={(event) => {
                    if (disabled || safeDuration <= 0) return;
                    setDragging(true);
                    event.currentTarget.setPointerCapture(event.pointerId);
                    seekFromPointer(event, false);
                }}
                onPointerMove={(event) => {
                    if (!dragging) return;
                    seekFromPointer(event, true);
                }}
                onPointerUp={(event) => {
                    setDragging(false);
                    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                        event.currentTarget.releasePointerCapture(event.pointerId);
                    }
                    lastPointerSecondsRef.current = null;
                }}
                onPointerCancel={() => setDragging(false)}
                sx={{
                    position: 'relative',
                    height: 38,
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-color)',
                    overflow: 'hidden',
                    cursor: disabled || safeDuration <= 0 ? 'default' : 'pointer',
                    touchAction: 'none',
                }}
            >
                    {majorTicks.map((tick) => {
                        const left = safeDuration > 0 ? (tick / safeDuration) * 100 : 0;
                        return (
                            <Box key={tick} sx={{ position: 'absolute', left: `${left}%`, top: 0, bottom: 0, borderLeft: '1px solid var(--text-color-light)', opacity: 0.85 }}>
                                <Typography
                                    sx={{
                                        position: 'absolute',
                                        left: 2,
                                        top: 4,
                                        color: 'var(--text-color)',
                                        fontFamily: 'monospace',
                                        fontSize: 12,
                                        lineHeight: 1,
                                        textShadow: '0 1px 0 var(--bg-color)',
                                        whiteSpace: 'nowrap',
                                    }}
                                >
                                    {formatRulerTime(tick)}
                                </Typography>
                                <Box sx={{ position: 'absolute', left: -1, bottom: 0, width: 1, height: 12, background: 'var(--text-color-light)' }} />
                                {tick < safeDuration && (
                                    <Box sx={{ position: 'absolute', left: '50%', bottom: 0, width: 1, height: 6, background: 'var(--border-color)' }} />
                                )}
                            </Box>
                        );
                    })}
                    <Box
                        sx={{
                            position: 'absolute',
                            left: `${playheadPercent}%`,
                            top: 0,
                            bottom: 0,
                            width: 2,
                            background: 'var(--primary-color)',
                            transform: 'translateX(-1px)',
                            pointerEvents: 'none',
                            zIndex: 2,
                            '&::before': {
                                content: '""',
                                position: 'absolute',
                                left: -5,
                                top: -1,
                                width: 0,
                                height: 0,
                                borderLeft: '6px solid transparent',
                                borderRight: '6px solid transparent',
                                borderTop: '7px solid var(--primary-color)',
                            },
                        }}
                    />
            </Box>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', justifyContent: 'space-between', mt: 1, gap: 1, flexWrap: 'wrap' }}>
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center', minWidth: 230 }}>
                    <Box
                        sx={{
                            px: 0.75,
                            py: 0.35,
                            border: '1px solid var(--border-color)',
                            background: 'var(--input-bg-color)',
                            color: 'var(--text-color)',
                            borderRadius: 0.5,
                            fontFamily: 'monospace',
                            fontSize: 12,
                        }}
                    >
                        {formatTimelineTime(safeCurrent)}
                    </Box>
                    <Typography sx={{ color: 'var(--text-color-light)', fontFamily: 'monospace', fontSize: 12 }}>/ {formatTimelineTime(safeDuration)}</Typography>
                    {seekStatusText && (
                        <Typography sx={{ color: 'var(--primary-color)', fontSize: 12 }}>
                            {seekStatusText}
                        </Typography>
                    )}
                </Stack>
                <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                    <TooltipButton title={t('graphics.tooltip.play', language)}>
                        <IconButton size="small" disabled={disabled || playing} onClick={onPlay} sx={{ color: 'var(--text-color)' }}>
                            <PlayArrowIcon fontSize="small" />
                        </IconButton>
                    </TooltipButton>
                    <TooltipButton title={t('graphics.tooltip.pause', language)}>
                        <IconButton size="small" disabled={disabled || !playing} onClick={onPause} sx={{ color: 'var(--text-color)' }}>
                            <PauseIcon fontSize="small" />
                        </IconButton>
                    </TooltipButton>
                    <TooltipButton title={t('graphics.tooltip.stop', language)}>
                        <IconButton size="small" disabled={disabled} onClick={onStop} sx={{ color: 'var(--text-color)' }}>
                            <StopIcon fontSize="small" />
                        </IconButton>
                    </TooltipButton>
                    <TooltipButton title={t('graphics.tooltip.makeLoop', language)}>
                        <Button size="small" variant="outlined" startIcon={<LoopIcon />} sx={outlinedButtonSx} disabled={disabled || busy} onClick={onMakeLoop}>
                            {t('graphics.video.makeLoop', language)}
                        </Button>
                    </TooltipButton>
                    <TooltipButton title={t('graphics.tooltip.exportWebm', language)}>
                        <Button size="small" variant="contained" startIcon={<SaveIcon />} disabled={disabled || busy} onClick={onExport}>
                            {t('graphics.video.exportWebm', language)}
                        </Button>
                    </TooltipButton>
                </Stack>
            </Stack>
        </Paper>
    );
}

function ColorWheelPanel({
    title,
    value,
    expanded,
    language,
    onToggleExpanded,
    onChange,
    onReset,
}: {
    title: string;
    value: Record<ColorChannel, number>;
    expanded: boolean;
    language: LanguageCode;
    onToggleExpanded: () => void;
    onChange: (value: Record<ColorChannel, number>) => void;
    onReset: () => void;
}) {
    const wheelRef = useRef<HTMLDivElement | null>(null);
    const master = getGroupMasterValue(value);
    const pointerX = `${spinnerToWheel(value.r) * 100}%`;
    const pointerY = `${(1 - spinnerToWheel(value.b)) * 100}%`;

    const setChannel = (channel: ColorChannel, nextValue: number) => {
        onChange({ ...value, [channel]: clampPercent(nextValue) });
    };

    const setMaster = (nextMaster: number) => {
        const delta = clampPercent(nextMaster) - master;
        onChange({
            r: clampPercent(value.r + delta),
            g: clampPercent(value.g + delta),
            b: clampPercent(value.b + delta),
        });
    };

    const setFromWheelPointer = (event: PointerEvent<HTMLDivElement>) => {
        const rect = wheelRef.current?.getBoundingClientRect();
        if (!rect) return;
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const dx = event.clientX - centerX;
        const dy = event.clientY - centerY;
        const radius = Math.min(1, Math.hypot(dx, dy) / (rect.width / 2));
        const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
        const hue = (angle + 360) % 360;
        const lightness = 0.5 + (master / 100) * 0.25;
        onChange(hslToRgb(hue, radius, Math.max(0, Math.min(1, lightness))));
    };

    return (
        <Paper sx={{ ...innerPanelSx, p: 1.25 }}>
            <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 1 }}>
                <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center', minWidth: 0 }}>
                    <IconButton size="small" sx={{ color: 'var(--text-color-light)' }} onClick={onToggleExpanded}>
                        {expanded ? <KeyboardArrowDownIcon fontSize="small" /> : <KeyboardArrowRightIcon fontSize="small" />}
                    </IconButton>
                    <Typography sx={{ fontSize: 13, fontWeight: 700, minWidth: 0 }}>{title}</Typography>
                </Stack>
                {expanded && (
                    <Button size="small" variant="outlined" sx={outlinedButtonSx} onClick={onReset}>
                        {t('graphics.filters.groupReset', language)}
                    </Button>
                )}
            </Stack>
            {expanded && (
                <>
                    <Stack direction="row" spacing={1.25} sx={{ alignItems: 'stretch' }}>
                        <Box
                            ref={wheelRef}
                            onPointerDown={(event) => {
                                event.currentTarget.setPointerCapture(event.pointerId);
                                setFromWheelPointer(event);
                            }}
                            onPointerMove={(event) => {
                                if (event.buttons !== 1) return;
                                setFromWheelPointer(event);
                            }}
                            sx={{
                                position: 'relative',
                                width: 'min(100%, 180px)',
                                aspectRatio: '1 / 1',
                                borderRadius: '50%',
                                background:
                                    'radial-gradient(circle, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0) 62%), conic-gradient(red, magenta, blue, cyan, lime, yellow, red)',
                                border: '1px solid var(--border-color)',
                                boxShadow: 'inset 0 0 18px rgba(0,0,0,0.28)',
                                cursor: 'crosshair',
                                touchAction: 'none',
                            }}
                        >
                            <Box
                                sx={{
                                    position: 'absolute',
                                    left: pointerX,
                                    top: pointerY,
                                    width: 10,
                                    height: 10,
                                    borderRadius: '50%',
                                    background: 'var(--text-color)',
                                    border: '2px solid var(--bg-color)',
                                    transform: 'translate(-50%, -50%)',
                                    boxShadow: '0 0 0 1px var(--border-color)',
                                    pointerEvents: 'none',
                                }}
                            />
                        </Box>
                        <Stack spacing={0.5} sx={{ alignItems: 'center', minWidth: 44 }}>
                            <Typography sx={{ color: 'var(--text-color-light)', fontSize: 11 }}>{t('graphics.filters.master', language)}</Typography>
                            <Slider
                                orientation="vertical"
                                value={master}
                                min={-100}
                                max={100}
                                step={0.1}
                                onChange={(_, next) => setMaster(Array.isArray(next) ? next[0] : next)}
                                sx={{ ...sliderSx, height: 160 }}
                            />
                        </Stack>
                    </Stack>
                    <Stack spacing={0.25} sx={{ mt: 1 }}>
                        {(['r', 'g', 'b'] as const).map((channel) => (
                            <ControlSlider
                                key={`${title}-${channel}`}
                                label={channel.toUpperCase()}
                                value={value[channel]}
                                min={-100}
                                max={100}
                                step={0.1}
                                decimals={1}
                                suffix="%"
                                showInput
                                onChange={(nextValue) => setChannel(channel, nextValue)}
                            />
                        ))}
                    </Stack>
                </>
            )}
        </Paper>
    );
}

function ColorGradingControl({
    value,
    language,
    onChange,
}: {
    value: ShotcutVideoFilters['colorGrading'];
    language: LanguageCode;
    onChange: (value: ShotcutVideoFilters['colorGrading']) => void;
}) {
    const [expandedGroups, setExpandedGroups] = useState<Record<ColorGradingGroup, boolean>>({
        lift: true,
        gamma: true,
        gain: true,
    });

    const setGroup = (group: ColorGradingGroup, groupValue: Record<ColorChannel, number>) => {
        onChange({ ...value, [group]: groupValue });
    };

    const resetGroup = (group: ColorGradingGroup) => {
        setGroup(group, DEFAULT_SHOTCUT_FILTERS.colorGrading[group]);
    };

    return (
        <Stack spacing={1}>
            {(['lift', 'gamma', 'gain'] as const).map((group) => (
                <ColorWheelPanel
                    key={group}
                    title={t(`graphics.filters.${group}` as any, language)}
                    value={value[group]}
                    expanded={expandedGroups[group]}
                    language={language}
                    onToggleExpanded={() => setExpandedGroups((prev) => ({ ...prev, [group]: !prev[group] }))}
                    onChange={(groupValue) => setGroup(group, groupValue)}
                    onReset={() => resetGroup(group)}
                />
            ))}
            <Button size="small" variant="outlined" sx={outlinedButtonSx} onClick={() => onChange(DEFAULT_SHOTCUT_FILTERS.colorGrading)}>
                {t('graphics.filters.resetPreset', language)}
            </Button>
        </Stack>
    );
}

function ShotcutFilterRow({
    filter,
    expanded,
    disabled,
    language,
    onToggleExpanded,
    enabled,
    onToggleEnabled,
    children,
}: {
    filter: GraphicsFilterRegistryItem;
    expanded: boolean;
    disabled: boolean;
    language: LanguageCode;
    onToggleExpanded: () => void;
    enabled: boolean;
    onToggleEnabled: (checked: boolean) => void;
    children: ReactNode;
}) {
    return (
        <Paper sx={{ ...innerPanelSx, overflow: 'hidden' }}>
            <Stack
                direction="row"
                spacing={1}
                sx={{
                    alignItems: 'center',
                    px: 1.25,
                    py: 0.75,
                }}
            >
                <Checkbox
                    size="small"
                    checked={enabled}
                    disabled={disabled}
                    onChange={(event) => onToggleEnabled(event.target.checked)}
                />
                <Typography sx={{ flex: 1, fontSize: 13, fontWeight: 700, color: disabled ? 'var(--text-color-light)' : 'var(--text-color)' }}>
                    {getFilterLabel(filter, language)}
                </Typography>
                <IconButton size="small" sx={{ color: 'var(--text-color-light)' }} onClick={onToggleExpanded}>
                    {expanded ? <KeyboardArrowDownIcon fontSize="small" /> : <KeyboardArrowRightIcon fontSize="small" />}
                </IconButton>
            </Stack>
            {expanded && (
                <Box sx={{ px: 1.5, pb: 1.5 }}>
                    {disabled && (
                        <Alert severity="warning" sx={{ mb: 1 }}>
                            {t('graphics.filters.frei0rUnavailable', language)}
                        </Alert>
                    )}
                    {children}
                </Box>
            )}
        </Paper>
    );
}

function OutputPresetControl({
    preset,
    onChange,
}: {
    preset: PortraitOutputPreset;
    onChange: (value: PortraitOutputPreset) => void;
}) {
    return (
        <ToggleButtonGroup
            exclusive
            size="small"
            value={preset}
            onChange={(_, next) => next && onChange(next)}
            sx={{
                '& .MuiToggleButton-root': {
                    color: 'var(--text-color)',
                    borderColor: 'var(--border-color)',
                    textTransform: 'none',
                },
                '& .Mui-selected': {
                    background: 'var(--active-bg-color)',
                    color: 'var(--button-text-color)',
                },
            }}
        >
            <ToggleButton value="high">{OUTPUT_PRESETS.high.label}</ToggleButton>
            <ToggleButton value="standard">{OUTPUT_PRESETS.standard.label}</ToggleButton>
        </ToggleButtonGroup>
    );
}

function OverlayToggles({
    overlays,
    onChange,
    language = DEFAULT_LANGUAGE,
}: {
    overlays: OverlayState;
    onChange: (next: OverlayState) => void;
    language?: LanguageCode;
}) {
    return (
        <Stack direction="row" spacing={1.25} sx={{ flexWrap: 'wrap' }}>
            <Tooltip title={t('graphics.tooltip.silhouette', language)} arrow>
                <FormControlLabel
                    control={<Checkbox checked={overlays.silhouette} onChange={(event) => onChange({ ...overlays, silhouette: event.target.checked })} />}
                    label={<Typography sx={{ fontSize: 13 }}>{t('graphics.overlay.silhouette', language)} (S)</Typography>}
                />
            </Tooltip>
            <Tooltip title={t('graphics.tooltip.guide', language)} arrow>
                <FormControlLabel
                    control={<Checkbox checked={overlays.guide} onChange={(event) => onChange({ ...overlays, guide: event.target.checked })} />}
                    label={<Typography sx={{ fontSize: 13 }}>{t('graphics.overlay.guide', language)} (G)</Typography>}
                />
            </Tooltip>
            <Tooltip title={t('graphics.tooltip.alphaView', language)} arrow>
                <FormControlLabel
                    control={<Checkbox checked={overlays.alphaView} onChange={(event) => onChange({ ...overlays, alphaView: event.target.checked })} />}
                    label={<Typography sx={{ fontSize: 13 }}>{t('graphics.overlay.alphaView', language)} (A)</Typography>}
                />
            </Tooltip>
            <Tooltip title={t('graphics.tooltip.maskView', language)} arrow>
                <FormControlLabel
                    control={<Checkbox checked={overlays.maskView} onChange={(event) => onChange({ ...overlays, maskView: event.target.checked })} />}
                    label={<Typography sx={{ fontSize: 13 }}>{t('graphics.overlay.maskView', language)} (B)</Typography>}
                />
            </Tooltip>
        </Stack>
    );
}

function OverlaySettingsPanel({
    overlays,
    onChange,
    language = DEFAULT_LANGUAGE,
}: {
    overlays: OverlayState;
    onChange: (next: OverlayState) => void;
    language?: LanguageCode;
}) {
    return (
        <CollapsiblePanel title={t('graphics.overlay.title', language)} tooltip={t('graphics.tooltip.overlaySettings', language)}>
            <ControlSlider
                label={t('graphics.overlay.silhouetteOpacity', language)}
                tooltip={t('graphics.tooltip.silhouetteOpacity', language)}
                value={overlays.silhouetteOpacity}
                min={0}
                max={100}
                onChange={(silhouetteOpacity) => onChange({ ...overlays, silhouetteOpacity })}
            />
            <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center', mt: 1 }}>
                <TextField
                    size="small"
                    label={t('graphics.overlay.guideColor', language)}
                    value={overlays.guideColor}
                    onChange={(event) => onChange({ ...overlays, guideColor: event.target.value })}
                    sx={inputSx}
                    fullWidth
                />
                <Box
                    component="input"
                    type="color"
                    value={overlays.guideColor}
                    onChange={(event) => onChange({ ...overlays, guideColor: event.target.value })}
                    sx={{
                        width: 42,
                        height: 38,
                        p: 0.25,
                        border: '1px solid var(--border-color)',
                        borderRadius: 1,
                        background: 'var(--input-bg-color)',
                    }}
                />
            </Stack>
            <Typography sx={{ mt: 1, color: 'var(--text-color-light)', fontSize: 12 }}>
                {t('graphics.overlay.previewOnly', language)}
            </Typography>
        </CollapsiblePanel>
    );
}

function CanvasFilteredMedia({
    media,
    mediaKind,
    transform,
    onPlaybackState,
    onVideoControllerReady,
    preview,
}: {
    media: GraphicsFile;
    mediaKind: 'video' | 'image';
    transform: PortraitTransform;
    onPlaybackState?: (state: PlaybackState) => void;
    onVideoControllerReady?: (controller: VideoPreviewController | null) => void;
    preview: ShotcutPreviewOptions;
}) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const imageRef = useRef<HTMLImageElement | null>(null);
    const maskCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const onPlaybackStateRef = useRef(onPlaybackState);
    const lastPublishedStateRef = useRef<PlaybackState | null>(null);
    const pendingSeekRef = useRef<{ seconds: number; until: number } | null>(null);
    const lastCommandedTimeRef = useRef<number | null>(null);
    const pendingSeekTimeoutRef = useRef<number | null>(null);
    const pendingSeekResolveRef = useRef<(() => void) | null>(null);
    const requestDrawRef = useRef<(() => void) | null>(null);

    useEffect(() => {
        onPlaybackStateRef.current = onPlaybackState;
    }, [onPlaybackState]);

    useEffect(() => {
        let disposed = false;
        createMaskCanvas(preview.chromaMaskDataUrl).then((canvas) => {
            if (!disposed) maskCanvasRef.current = canvas;
        });
        return () => {
            disposed = true;
        };
    }, [preview.chromaMaskDataUrl]);

    useEffect(() => {
        return () => {
            if (pendingSeekTimeoutRef.current !== null) {
                window.clearTimeout(pendingSeekTimeoutRef.current);
                pendingSeekTimeoutRef.current = null;
            }
            pendingSeekResolveRef.current?.();
            pendingSeekResolveRef.current = null;
        };
    }, []);

    useEffect(() => {
        pendingSeekRef.current = null;
        if (pendingSeekTimeoutRef.current !== null) {
            window.clearTimeout(pendingSeekTimeoutRef.current);
            pendingSeekTimeoutRef.current = null;
        }
        lastCommandedTimeRef.current = null;
        lastPublishedStateRef.current = null;
        pendingSeekResolveRef.current?.();
        pendingSeekResolveRef.current = null;
    }, [media.url]);

    const getVideoState = (video: HTMLVideoElement): PlaybackState => ({
        currentTime: video.currentTime,
        duration: Number.isFinite(video.duration) ? video.duration : 0,
        playing: !video.paused && !video.ended,
    });

    const publishVideoState = (video: HTMLVideoElement, sourceEvent: string) => {
        const pendingSeek = pendingSeekRef.current;
        if (
            pendingSeek &&
            sourceEvent !== 'seeked' &&
            Date.now() < pendingSeek.until &&
            (video.currentTime <= 0.05 || Math.abs(video.currentTime - pendingSeek.seconds) > 0.75)
        ) {
            return;
        }

        const next = getVideoState(video);
        const prev = lastPublishedStateRef.current;
        if (
            prev &&
            Math.abs(prev.currentTime - next.currentTime) < 0.016 &&
            Math.abs(prev.duration - next.duration) < 0.016 &&
            prev.playing === next.playing
        ) {
            return;
        }

        lastPublishedStateRef.current = next;
        onPlaybackStateRef.current?.(next);
    };

    const safelyPlayVideo = async (video: HTMLVideoElement) => {
        try {
            await video.play();
        } catch (error) {
            if (error instanceof DOMException && error.name === 'AbortError') return;
            if (import.meta.env.DEV) console.debug('[GraphicsTool] video play interrupted', error);
        }
    };

    const settlePendingSeek = (video: HTMLVideoElement, sourceEvent: string) => {
        if (pendingSeekTimeoutRef.current !== null) {
            window.clearTimeout(pendingSeekTimeoutRef.current);
            pendingSeekTimeoutRef.current = null;
        }
        const resolve = pendingSeekResolveRef.current;
        pendingSeekResolveRef.current = null;
        pendingSeekRef.current = null;
        if (import.meta.env.DEV) {
            console.debug('[GraphicsTool] seek resolved', {
                sourceEvent,
                currentTime: video.currentTime,
                commandedTime: lastCommandedTimeRef.current,
            });
        }
        resolve?.();
        publishVideoState(video, sourceEvent);
        requestDrawRef.current?.();
    };

    const commitSeek = (video: HTMLVideoElement, seconds: number): Promise<void> => {
        if (!Number.isFinite(seconds)) return Promise.resolve();
        const duration = Number.isFinite(video.duration) ? video.duration : Number.POSITIVE_INFINITY;
        const nextTime = Math.max(0, Math.min(seconds, duration));
        lastCommandedTimeRef.current = nextTime;
        if (video.readyState < 1) {
            return new Promise((resolve) => {
                const onLoadedMetadata = () => {
                    video.removeEventListener('loadedmetadata', onLoadedMetadata);
                    void commitSeek(video, nextTime).then(resolve);
                };
                video.addEventListener('loadedmetadata', onLoadedMetadata, { once: true });
            });
        }

        pendingSeekResolveRef.current?.();
        pendingSeekResolveRef.current = null;
        if (pendingSeekTimeoutRef.current !== null) {
            window.clearTimeout(pendingSeekTimeoutRef.current);
            pendingSeekTimeoutRef.current = null;
        }
        pendingSeekRef.current = { seconds: nextTime, until: Date.now() + 1200 };
        if (import.meta.env.DEV) console.debug('[GraphicsTool] seek requested', { seconds: nextTime });

        return new Promise((resolve) => {
            pendingSeekResolveRef.current = resolve;
            pendingSeekTimeoutRef.current = window.setTimeout(() => {
                settlePendingSeek(video, 'seek-timeout');
            }, 900);
            if (Math.abs(video.currentTime - nextTime) <= 0.016) {
                settlePendingSeek(video, 'seek-already-there');
                return;
            }
            video.currentTime = nextTime;
            publishVideoState(video, 'seek-command');
            requestDrawRef.current?.();
        });
    };

    useEffect(() => {
        if (mediaKind !== 'video') {
            onVideoControllerReady?.(null);
            return undefined;
        }

        const controller: VideoPreviewController = {
            play: async () => {
                const video = videoRef.current;
                if (!video) return;
                const commandedTime = lastCommandedTimeRef.current;
                if (
                    commandedTime !== null &&
                    commandedTime > 0.05 &&
                    Math.abs(video.currentTime - commandedTime) > 0.05
                ) {
                    if (import.meta.env.DEV) console.debug('[GraphicsTool] play after seek', { seconds: commandedTime });
                    await commitSeek(video, commandedTime);
                }
                await safelyPlayVideo(video);
                publishVideoState(video, 'play-command');
                requestDrawRef.current?.();
            },
            pause: () => {
                const video = videoRef.current;
                if (!video) return;
                video.pause();
                publishVideoState(video, 'pause-command');
                requestDrawRef.current?.();
            },
            stop: () => {
                const video = videoRef.current;
                if (!video) return;
                pendingSeekRef.current = null;
                if (pendingSeekTimeoutRef.current !== null) {
                    window.clearTimeout(pendingSeekTimeoutRef.current);
                    pendingSeekTimeoutRef.current = null;
                }
                pendingSeekResolveRef.current?.();
                pendingSeekResolveRef.current = null;
                video.pause();
                video.currentTime = 0;
                lastCommandedTimeRef.current = 0;
                publishVideoState(video, 'stop-command');
                requestDrawRef.current?.();
            },
            seek: async (seconds: number) => {
                const video = videoRef.current;
                if (!video) return;
                await commitSeek(video, seconds);
            },
            getState: () => {
                const video = videoRef.current;
                return video ? getVideoState(video) : { currentTime: 0, duration: 0, playing: false };
            },
        };

        onVideoControllerReady?.(controller);
        return () => onVideoControllerReady?.(null);
    }, [media.url, mediaKind, onVideoControllerReady]);

    useEffect(() => {
        const video = videoRef.current;
        if (!video || mediaKind !== 'video') return;

        let initialFrame = 0;
        const publishMetadata = () => publishVideoState(video, 'metadata');
        const publishTime = () => {
            publishVideoState(video, 'timeupdate');
            requestDrawRef.current?.();
        };
        const publishPlay = () => publishVideoState(video, 'play');
        const publishPause = () => {
            publishVideoState(video, 'pause');
            requestDrawRef.current?.();
        };
        const publishEnded = () => {
            publishVideoState(video, 'ended');
            requestDrawRef.current?.();
        };
        const publishSeeked = () => settlePendingSeek(video, 'seeked');

        video.addEventListener('loadedmetadata', publishMetadata);
        video.addEventListener('durationchange', publishMetadata);
        video.addEventListener('timeupdate', publishTime);
        video.addEventListener('seeked', publishSeeked);
        video.addEventListener('play', publishPlay);
        video.addEventListener('pause', publishPause);
        video.addEventListener('ended', publishEnded);
        if (video.readyState >= 1) {
            initialFrame = window.requestAnimationFrame(publishMetadata);
        }

        return () => {
            if (initialFrame) window.cancelAnimationFrame(initialFrame);
            video.removeEventListener('loadedmetadata', publishMetadata);
            video.removeEventListener('durationchange', publishMetadata);
            video.removeEventListener('timeupdate', publishTime);
            video.removeEventListener('seeked', publishSeeked);
            video.removeEventListener('play', publishPlay);
            video.removeEventListener('pause', publishPause);
            video.removeEventListener('ended', publishEnded);
        };
    }, [media.url, mediaKind]);

    useEffect(() => {
        let animationFrameId = 0;
        let videoFrameId = 0;
        let disposed = false;
        let drawQueued = false;

        const draw = () => {
            drawQueued = false;
            if (disposed) return;

            const canvas = canvasRef.current;
            const ctx = canvas?.getContext('2d', { willReadFrequently: true });
            const source = mediaKind === 'video' ? videoRef.current : imageRef.current;
            if (!canvas || !ctx || !source) {
                scheduleDraw();
                return;
            }

            const naturalWidth = mediaKind === 'video'
                ? (source as HTMLVideoElement).videoWidth
                : (source as HTMLImageElement).naturalWidth;
            const naturalHeight = mediaKind === 'video'
                ? (source as HTMLVideoElement).videoHeight
                : (source as HTMLImageElement).naturalHeight;

            if (!naturalWidth || !naturalHeight) {
                scheduleDraw();
                return;
            }

            const targetWidth = Math.min(560, naturalWidth);
            const targetHeight = Math.max(1, Math.round(targetWidth * (naturalHeight / naturalWidth)));
            if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
                canvas.width = targetWidth;
                canvas.height = targetHeight;
            }

            ctx.clearRect(0, 0, targetWidth, targetHeight);
            ctx.filter = preview.cssFilter;
            ctx.drawImage(source, 0, 0, targetWidth, targetHeight);
            ctx.filter = 'none';

            if (
                preview.filters.chromaKeyAdvanced.enabled ||
                preview.filters.keySpillAdvanced.enabled ||
                preview.filters.alphaChannelAdjust.enabled ||
                preview.filters.colorGrading.enabled ||
                preview.imageBackgroundAlpha?.enabled
            ) {
                try {
                    const data = ctx.getImageData(0, 0, targetWidth, targetHeight);
                    let maskData: Uint8ClampedArray | undefined;
                    const maskCanvas = maskCanvasRef.current;
                    if (maskCanvas) {
                        const maskScratch = document.createElement('canvas');
                        maskScratch.width = targetWidth;
                        maskScratch.height = targetHeight;
                        const maskCtx = maskScratch.getContext('2d');
                        if (maskCtx) {
                            const mediaWidthOnPortrait = 1200 * (transform.scale / 100);
                            const mediaHeightOnPortrait = mediaWidthOnPortrait * (naturalHeight / naturalWidth);
                            const sourceX = (1200 - mediaWidthOnPortrait) / 2 + transform.x;
                            const sourceY = (1500 - mediaHeightOnPortrait) / 2 + transform.y;
                            const cropX = Math.max(0, sourceX);
                            const cropY = Math.max(0, sourceY);
                            const cropRight = Math.min(1200, sourceX + mediaWidthOnPortrait);
                            const cropBottom = Math.min(1500, sourceY + mediaHeightOnPortrait);
                            const cropWidth = Math.max(0, cropRight - cropX);
                            const cropHeight = Math.max(0, cropBottom - cropY);
                            const destX = ((cropX - sourceX) / mediaWidthOnPortrait) * targetWidth;
                            const destY = ((cropY - sourceY) / mediaHeightOnPortrait) * targetHeight;
                            const destWidth = (cropWidth / mediaWidthOnPortrait) * targetWidth;
                            const destHeight = (cropHeight / mediaHeightOnPortrait) * targetHeight;
                            maskCtx.clearRect(0, 0, targetWidth, targetHeight);
                            if (cropWidth > 0 && cropHeight > 0) {
                                maskCtx.drawImage(maskCanvas, cropX, cropY, cropWidth, cropHeight, destX, destY, destWidth, destHeight);
                            }
                            maskData = maskCtx.getImageData(0, 0, targetWidth, targetHeight).data;
                        }
                    }
                    applyApproximateShotcutPreview(data, preview, maskData);
                    if (preview.imageBackgroundAlpha?.enabled) {
                        applyImageBackgroundAlphaPreview(data, preview.imageBackgroundAlpha);
                    }
                    ctx.putImageData(data, 0, 0);
                } catch {
                    // If a media source cannot be sampled by canvas, keep the CSS-only preview alive.
                }
            }

            if (mediaKind === 'video') {
                const video = videoRef.current as VideoFrameCallbackVideo | null;
                if (video && !video.paused && !video.ended) scheduleDraw();
            }
        };

        const scheduleDraw = () => {
            if (disposed || drawQueued) return;
            drawQueued = true;
            const video = videoRef.current as VideoFrameCallbackVideo | null;
            if (mediaKind === 'video' && video?.requestVideoFrameCallback && !video.paused && !video.ended) {
                videoFrameId = video.requestVideoFrameCallback(draw);
                return;
            }
            animationFrameId = window.requestAnimationFrame(draw);
        };

        requestDrawRef.current = scheduleDraw;
        scheduleDraw();
        return () => {
            disposed = true;
            requestDrawRef.current = null;
            if (animationFrameId) window.cancelAnimationFrame(animationFrameId);
            const video = videoRef.current as VideoFrameCallbackVideo | null;
            if (videoFrameId && video?.cancelVideoFrameCallback) video.cancelVideoFrameCallback(videoFrameId);
        };
    }, [media.url, mediaKind, preview, transform]);

    return (
        <>
            {mediaKind === 'video' ? (
                <video
                    ref={videoRef}
                    src={media.url}
                    muted
                    loop
                    playsInline
                    controls={false}
                    style={{ position: 'absolute', opacity: 0, width: 1, height: 1, pointerEvents: 'none' }}
                />
            ) : (
                <img
                    ref={imageRef}
                    src={media.url}
                    alt=""
                    style={{ position: 'absolute', opacity: 0, width: 1, height: 1, pointerEvents: 'none' }}
                />
            )}
            <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: 'auto' }} />
        </>
    );
}

function ChromaMaskCanvasLayer({
    mask,
    visible,
    onChange,
}: {
    mask: ChromaMaskState;
    visible: boolean;
    onChange: (mask: ChromaMaskState) => void;
}) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const drawingRef = useRef(false);
    const [cursor, setCursor] = useState<{ x: number; y: number; size: number } | null>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;
        canvas.width = 1200;
        canvas.height = 1500;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (!mask.dataUrl) return;

        createImageElement(mask.dataUrl).then((image) => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        });
    }, [mask.dataUrl]);

    const commit = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        onChange({ ...mask, enabled: true, dirty: true, dataUrl: canvas.toDataURL('image/png') });
    };

    const updateCursor = (event: PointerEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const scaleX = rect.width / canvas.width;
        const scaleY = rect.height / canvas.height;
        setCursor({
            x: event.clientX - rect.left,
            y: event.clientY - rect.top,
            size: Math.max(6, mask.brushSize * ((scaleX + scaleY) / 2)),
        });
    };

    const drawAt = (event: PointerEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;

        updateCursor(event);
        const rect = canvas.getBoundingClientRect();
        const x = ((event.clientX - rect.left) / rect.width) * canvas.width;
        const y = ((event.clientY - rect.top) / rect.height) * canvas.height;

        ctx.save();
        ctx.globalCompositeOperation = mask.mode === 'erase' ? 'destination-out' : 'source-over';
        ctx.fillStyle = 'rgba(255,255,255,0.72)';
        ctx.beginPath();
        ctx.arc(x, y, mask.brushSize / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    };

    return (
        <>
            <canvas
                ref={canvasRef}
                onPointerEnter={(event) => updateCursor(event)}
                onPointerLeave={() => setCursor(null)}
                onPointerDown={(event) => {
                    drawingRef.current = true;
                    event.currentTarget.setPointerCapture(event.pointerId);
                    drawAt(event);
                    commit();
                }}
                onPointerMove={(event) => {
                    updateCursor(event);
                    if (!drawingRef.current) return;
                    drawAt(event);
                    commit();
                }}
                onPointerUp={(event) => {
                    drawingRef.current = false;
                    event.currentTarget.releasePointerCapture(event.pointerId);
                    commit();
                }}
                style={{
                    position: 'absolute',
                    inset: 0,
                    width: '100%',
                    height: '100%',
                    opacity: visible && mask.dirty ? 0.34 : 0,
                    pointerEvents: mask.enabled ? 'auto' : 'none',
                    touchAction: 'none',
                    cursor: mask.enabled ? 'none' : 'default',
                }}
            />
            {mask.enabled && cursor && (
                <Box
                    sx={{
                        position: 'absolute',
                        left: cursor.x,
                        top: cursor.y,
                        width: cursor.size,
                        height: cursor.size,
                        borderRadius: '50%',
                        border: mask.mode === 'erase' ? '2px dashed rgba(255,255,255,0.95)' : '2px solid rgba(57,197,255,0.95)',
                        background: mask.mode === 'erase' ? 'rgba(0,0,0,0.12)' : 'rgba(57,197,255,0.14)',
                        boxShadow: '0 0 0 1px rgba(0,0,0,0.6)',
                        transform: 'translate(-50%, -50%)',
                        pointerEvents: 'none',
                    }}
                />
            )}
        </>
    );
}

function PortraitCanvas({
    media,
    mediaKind,
    transform,
    overlays,
    assets,
    onPlaybackState,
    onVideoControllerReady,
    chromaMask,
    onChromaMaskChange,
    previewFilter = '',
    shotcutPreviewFilters,
    language = DEFAULT_LANGUAGE,
}: {
    media: GraphicsFile | null;
    mediaKind: 'video' | 'image';
    transform: PortraitTransform;
    overlays: OverlayState;
    assets: GraphicsAssets | null;
    onPlaybackState?: (state: PlaybackState) => void;
    onVideoControllerReady?: (controller: VideoPreviewController | null) => void;
    chromaMask?: ChromaMaskState;
    onChromaMaskChange?: (mask: ChromaMaskState) => void;
    previewFilter?: string;
    shotcutPreviewFilters?: ShotcutPreviewOptions;
    language?: LanguageCode;
}) {
    return (
        <Box
            sx={{
                position: 'relative',
                mx: 'auto',
                width: 'min(100%, 560px)',
                aspectRatio: '4 / 5',
                overflow: 'hidden',
                border: '1px solid var(--border-color)',
                borderRadius: 1,
                ...(overlays.alphaView ? checkerboard : { background: 'rgba(12,14,18,0.92)' }),
            }}
        >
            {media ? (
                <Box
                    sx={{
                        position: 'absolute',
                        left: `calc(50% + ${(transform.x / 1200) * 100}%)`,
                        top: `calc(50% + ${(transform.y / 1500) * 100}%)`,
                        width: `${transform.scale}%`,
                        transform: 'translate(-50%, -50%)',
                        filter: previewFilter || undefined,
                        pointerEvents: 'none',
                    }}
                >
                    {shotcutPreviewFilters ? (
                        <CanvasFilteredMedia
                            media={media}
                            mediaKind={mediaKind}
                            transform={transform}
                            onPlaybackState={onPlaybackState}
                            onVideoControllerReady={onVideoControllerReady}
                            preview={shotcutPreviewFilters}
                        />
                    ) : mediaKind === 'video' ? (
                        <video
                            src={media.url}
                            muted
                            loop
                            playsInline
                            controls={false}
                            style={{ display: 'block', width: '100%', height: 'auto' }}
                        />
                    ) : (
                        <img src={media.url} alt="" style={{ display: 'block', width: '100%', height: 'auto' }} />
                    )}
                </Box>
            ) : (
                <Stack sx={{ height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--text-color-light)' }}>
                    <VisibilityIcon />
                    <Typography sx={{ mt: 1, fontSize: 13 }}>{t('graphics.canvas.loadSource', language)}</Typography>
                </Stack>
            )}

            {assets && overlays.silhouette && (
                <img
                    src={assets.silhouetteUrl}
                    alt=""
                    style={{
                        position: 'absolute',
                        inset: 0,
                        width: '100%',
                        height: '100%',
                        objectFit: 'fill',
                        opacity: overlays.silhouetteOpacity / 100,
                        pointerEvents: 'none',
                    }}
                />
            )}
            {assets && overlays.guide && (
                <Box
                    sx={{
                        position: 'absolute',
                        inset: 0,
                        width: '100%',
                        height: '100%',
                        backgroundColor: overlays.guideColor,
                        maskImage: `url("${assets.guideUrl}")`,
                        maskSize: '100% 100%',
                        maskRepeat: 'no-repeat',
                        WebkitMaskImage: `url("${assets.guideUrl}")`,
                        WebkitMaskSize: '100% 100%',
                        WebkitMaskRepeat: 'no-repeat',
                        pointerEvents: 'none',
                    }}
                />
            )}
            {mediaKind === 'video' && chromaMask && onChromaMaskChange && (
                <ChromaMaskCanvasLayer mask={chromaMask} visible={overlays.maskView} onChange={onChromaMaskChange} />
            )}
        </Box>
    );
}

function TransformPanel({
    transform,
    onChange,
    language = DEFAULT_LANGUAGE,
}: {
    transform: PortraitTransform;
    onChange: (next: PortraitTransform) => void;
    language?: LanguageCode;
}) {
    return (
        <CollapsiblePanel title={t('graphics.transform.title', language)} tooltip={t('graphics.tooltip.transform', language)}>
            <ControlSlider label="X" tooltip={t('graphics.tooltip.transformX', language)} value={transform.x} min={-600} max={600} onChange={(x) => onChange({ ...transform, x })} />
            <ControlSlider label="Y" tooltip={t('graphics.tooltip.transformY', language)} value={transform.y} min={-750} max={750} onChange={(y) => onChange({ ...transform, y })} />
            <ControlSlider label={t('graphics.transform.scale', language)} tooltip={t('graphics.tooltip.transformScale', language)} value={transform.scale} min={20} max={260} onChange={(scale) => onChange({ ...transform, scale })} />
            <TooltipButton title={t('graphics.tooltip.resetTransform', language)}>
                <Button size="small" variant="outlined" sx={{ ...outlinedButtonSx, mt: 1 }} onClick={() => onChange(DEFAULT_TRANSFORM)}>
                    {t('graphics.transform.reset', language)}
                </Button>
            </TooltipButton>
        </CollapsiblePanel>
    );
}

function OutputPanel({
    preset,
    onChange,
    language = DEFAULT_LANGUAGE,
}: {
    preset: PortraitOutputPreset;
    onChange: (value: PortraitOutputPreset) => void;
    language?: LanguageCode;
}) {
    const selected = OUTPUT_PRESETS[preset];

    return (
        <Paper sx={{ ...panelSx, p: 2 }}>
            <Tooltip title={t('graphics.tooltip.output', language)} arrow>
                <Typography sx={{ fontWeight: 700, mb: 1 }}>{t('graphics.output.title', language)}</Typography>
            </Tooltip>
            <OutputPresetControl preset={preset} onChange={onChange} />
            <Typography sx={{ mt: 1.25, color: 'var(--text-color-light)', fontSize: 12 }}>
                Portrait canvas: {selected.width} x {selected.height}
            </Typography>
        </Paper>
    );
}

function VideoOptionsPanel({
    language,
    includeAudio,
    setIncludeAudio,
    interpolation,
    setInterpolation,
}: {
    language: LanguageCode;
    includeAudio: boolean;
    setIncludeAudio: (value: boolean) => void;
    interpolation: 'none' | 'motion';
    setInterpolation: (value: 'none' | 'motion') => void;
}) {
    return (
        <Paper sx={{ ...panelSx, p: 2 }}>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1 }}>
                <TuneIcon sx={{ color: 'var(--primary-color)' }} />
                <Tooltip title={t('graphics.tooltip.videoOptions', language)} arrow>
                    <Typography sx={{ fontWeight: 700 }}>{t('graphics.video.options', language)}</Typography>
                </Tooltip>
            </Stack>
            <Tooltip title={t('graphics.tooltip.includeAudio', language)} arrow>
                <FormControlLabel control={<Checkbox checked={includeAudio} onChange={(event) => setIncludeAudio(event.target.checked)} />} label={t('graphics.video.includeAudio', language)} />
            </Tooltip>
            <Tooltip title={t('graphics.tooltip.interpolation', language)} arrow>
                <FormControl fullWidth size="small" sx={{ mt: 1 }}>
                    <InputLabel sx={{ color: 'var(--text-color-light)' }}>{t('graphics.video.interpolation', language)}</InputLabel>
                    <Select value={interpolation} label={t('graphics.video.interpolation', language)} onChange={(event) => setInterpolation(event.target.value as 'none' | 'motion')} sx={selectSx}>
                        <MenuItem value="none">{t('graphics.video.lanczosOnly', language)}</MenuItem>
                        <MenuItem value="motion">{t('graphics.video.motionInterpolation', language)}</MenuItem>
                    </Select>
                </FormControl>
            </Tooltip>
        </Paper>
    );
}

function VideoTool({ assets }: { assets: GraphicsAssets | null }) {
    const { showNotification } = useNotification();
    const currentLanguage = useCurrentLanguage();
    const [source, setSource] = useState<GraphicsFile | null>(null);
    const [transform, setTransform] = useState(DEFAULT_TRANSFORM);
    const [overlays, setOverlays] = useState(DEFAULT_OVERLAYS);
    const [preset, setPreset] = useState<PortraitOutputPreset>('high');
    const [playing, setPlaying] = useState(false);
    const videoControllerRef = useRef<VideoPreviewController | null>(null);
    const lastUserSeekRef = useRef<{ seconds: number; until: number } | null>(null);
    const lastSeekSecondsRef = useRef<number | null>(null);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [seekStatusText, setSeekStatusText] = useState('');
    const [includeAudio, setIncludeAudio] = useState(true);
    const [interpolation, setInterpolation] = useState<'none' | 'motion'>('none');
    const [colorPreset, setColorPreset] = useState('neutral');
    const [colorPresets, setColorPresets] = useState<ColorPresetConfig[]>(FALLBACK_COLOR_PRESETS);
    const [filterRegistry, setFilterRegistry] = useState<GraphicsFilterRegistryItem[]>(SHOTCUT_FILTER_REGISTRY_FALLBACK);
    const [shotcutFilters, setShotcutFilters] = useState<ShotcutVideoFilters>(DEFAULT_SHOTCUT_FILTERS);
    const [expandedFilters, setExpandedFilters] = useState<Record<string, boolean>>({});
    const [ffmpegStatus, setFfmpegStatus] = useState<FfmpegStatus | null>(null);
    const [loopDialogOpen, setLoopDialogOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const [operationId, setOperationId] = useState('');
    const [operationState, setOperationState] = useState<OperationState>('idle');
    const [operationProgress, setOperationProgress] = useState<number | undefined>(undefined);
    const [operationMessage, setOperationMessage] = useState('');
    const [dragActive, setDragActive] = useState(false);

    useOverlayShortcuts(setOverlays);

    useEffect(() => {
        window.electronAPI.checkFfmpeg().then((status: FfmpegStatus) => {
            setFfmpegStatus(status);
            if (!status.ok) showNotification(status.message, 'warning');
            if (status.ok && !status.supportsFrei0r) {
                showNotification(t('graphics.notification.ffmpegNoFrei0r', currentLanguage), 'warning');
            }
            if (status.missingFrei0rPlugins?.length) {
                showNotification(`${t('graphics.notification.missingFrei0rPlugins', currentLanguage)} ${status.missingFrei0rPlugins.join(', ')}`, 'warning');
            }
            if (status.failedFrei0rPlugins?.length) {
                showNotification(`${t('graphics.notification.failedFrei0rPlugins', currentLanguage)} ${status.failedFrei0rPlugins.join(', ')}`, 'warning');
            }
        });
    }, [currentLanguage, showNotification]);

    useEffect(() => {
        window.electronAPI
            .getGraphicsConfig()
            .then((config: GraphicsConfig) => {
                const nextPresets = config.videoFilters?.colorPresets?.filter((item) => item.id && item.label);
                if (nextPresets?.length) setColorPresets(nextPresets);
                const nextFilters = config.videoFilters?.filters?.filter((item) => item.id && item.labels);
                if (nextFilters?.length) setFilterRegistry(nextFilters);
            })
            .catch(() => {
                setColorPresets(FALLBACK_COLOR_PRESETS);
                setFilterRegistry(SHOTCUT_FILTER_REGISTRY_FALLBACK);
            });
    }, []);

    useEffect(() => {
        return window.electronAPI.onGraphicsProgress((progress: GraphicsProgress) => {
            if (!progress.operationId || progress.operationId !== operationId) return;

            setOperationProgress(progress.percent);
            setOperationMessage(progress.message);

            if (progress.state === 'running') {
                setOperationState(progress.type === 'create-loop' ? 'creating-loop' : 'exporting-video');
            }

            if (progress.state === 'error' || progress.state === 'completed') {
                setOperationState('idle');
            }
        });
    }, [operationId]);

    const selectedColorPreset = colorPresets.find((item) => item.id === colorPreset) || colorPresets[0];
    const previewSaturation = shotcutFilters.saturation.enabled ? shotcutFilters.saturation.level : 100;
    const previewContrast = shotcutFilters.contrast.enabled ? shotcutFilters.contrast.level : 50;
    const previewFilter = buildPreviewFilter(selectedColorPreset, previewSaturation, 100, previewContrast);
    const [chromaMask, setChromaMask] = useState<ChromaMaskState>(DEFAULT_CHROMA_MASK);
    const shotcutPreviewFilters = buildCanvasPreviewOptions(previewFilter, shotcutFilters, chromaMask.enabled && chromaMask.dirty ? chromaMask.dataUrl : undefined);
    const toggleExpandedFilter = (id: string) => setExpandedFilters((prev) => ({ ...prev, [id]: !prev[id] }));
    const updateShotcutFilter = <K extends keyof ShotcutVideoFilters>(id: K, next: Partial<ShotcutVideoFilters[K]>) => {
        setShotcutFilters((prev) => ({
            ...prev,
            [id]: {
                ...prev[id],
                ...next,
            },
        }));
    };
    const isFrei0rFilterDisabled = (filter: GraphicsFilterRegistryItem) => {
        if (filter.engine !== 'frei0r') return false;
        if (!ffmpegStatus?.ok) return true;
        if (!ffmpegStatus.supportsFrei0r) return true;
        return Boolean(
            filter.pluginFile &&
                (ffmpegStatus.missingFrei0rPlugins?.includes(filter.pluginFile) || ffmpegStatus.failedFrei0rPlugins?.includes(filter.pluginFile))
        );
    };

    const resetVideoPreviewState = () => {
        setPlaying(false);
        videoControllerRef.current = null;
        lastUserSeekRef.current = null;
        lastSeekSecondsRef.current = null;
        setSeekStatusText('');
        setCurrentTime(0);
        setDuration(0);
    };

    const loadVideoSource = (selected: GraphicsFile, notify = true) => {
        setSource(selected);
        resetVideoPreviewState();
        if (notify) showNotification(`${t('graphics.notification.videoLoaded', currentLanguage)} ${selected.name}`, 'success');
    };

    const handleVideoControllerReady = useCallback((controller: VideoPreviewController | null) => {
        videoControllerRef.current = controller;
        if (controller) {
            const state = controller.getState();
            setCurrentTime(state.currentTime);
            setDuration(state.duration);
            setPlaying(state.playing);
        }
    }, []);

    const resolveDroppedVideo = async (event: DragEvent<HTMLElement>) => {
        event.preventDefault();
        event.stopPropagation();
        setDragActive(false);

        const file = event.dataTransfer.files.item(0);
        if (!file) {
            showNotification(t('graphics.notification.dropEmpty', currentLanguage), 'warning');
            return;
        }

        try {
            const selected = (await window.electronAPI.resolveDroppedGraphicsFile(file, 'video')) as GraphicsFile;
            loadVideoSource(selected);
        } catch (error) {
            showNotification(getErrorMessage(error, t('graphics.notification.videoDropFailed', currentLanguage)), 'error');
        }
    };

    const handleLoad = async () => {
        try {
            const selected = (await window.electronAPI.selectGraphicsVideo()) as GraphicsFile | null;
            if (!selected) return;
            loadVideoSource(selected);
        } catch (error) {
            showNotification(getErrorMessage(error, t('graphics.notification.videoLoadFailed', currentLanguage)), 'error');
        }
    };

    const handleCreateLoop = async () => {
        if (!source) {
            showNotification(t('graphics.notification.loadVideoBeforeLoop', currentLanguage), 'warning');
            return;
        }

        try {
            setBusy(true);
            const nextOperationId = createOperationId('loop');
            setOperationId(nextOperationId);
            setLoopDialogOpen(false);
            setOperationState('creating-loop');
            setOperationProgress(undefined);
            setOperationMessage('Creating loop video...');
            const result = await window.electronAPI.createPortraitLoop({
                sourcePath: source.path,
                includeAudio,
                operationId: nextOperationId,
            });
            if (result) {
                loadVideoSource(result as GraphicsFile, false);
                showNotification(t('graphics.notification.loopExported', currentLanguage), 'success');
                if (includeAudio && result.audioIncluded === false) {
                    showNotification(t('graphics.notification.loopAudioFallback', currentLanguage), 'warning');
                }
            }
        } catch (error) {
            showNotification(t('graphics.notification.loopFailedWithCopy', currentLanguage), 'error', {
                autoHideMs: 10000,
                copyText: getErrorLog(error),
            });
        } finally {
            setBusy(false);
            setOperationState('idle');
        }
    };

    const handleStop = () => {
        videoControllerRef.current?.stop();
        setPlaying(false);
        lastUserSeekRef.current = null;
        lastSeekSecondsRef.current = null;
        setSeekStatusText('');
        setCurrentTime(0);
    };

    const handleSeek = (value: number) => {
        if (!source || duration <= 0) return;
        const nextSeconds = Math.max(0, Math.min(value, duration));
        lastUserSeekRef.current = { seconds: nextSeconds, until: Date.now() + 1200 };
        lastSeekSecondsRef.current = nextSeconds;
        setSeekStatusText(`Seeking ${formatTimelineTime(nextSeconds)}`);
        window.setTimeout(() => {
            if (lastUserSeekRef.current && Date.now() >= lastUserSeekRef.current.until) {
                lastUserSeekRef.current = null;
                setSeekStatusText('');
            }
        }, 1200);
        setCurrentTime(nextSeconds);
        void videoControllerRef.current?.seek(nextSeconds).then(() => {
            if (lastSeekSecondsRef.current === nextSeconds) {
                lastUserSeekRef.current = null;
                setSeekStatusText('');
            }
        });
    };

    const handlePlay = async () => {
        const lastSeekSeconds = lastSeekSecondsRef.current;
        const controller = videoControllerRef.current;
        setPlaying(true);
        if (lastSeekSeconds !== null && duration > 0) {
            const nextSeconds = Math.max(0, Math.min(lastSeekSeconds, duration));
            const controllerState = controller?.getState();
            if (!controllerState || Math.abs(controllerState.currentTime - nextSeconds) > 0.05) {
                await controller?.seek(nextSeconds);
                setCurrentTime(nextSeconds);
            }
        }
        await controller?.play();
    };

    const handlePause = () => {
        videoControllerRef.current?.pause();
        setPlaying(false);
    };

    const handlePlaybackState = useCallback((state: PlaybackState) => {
        const guard = lastUserSeekRef.current;
        if (guard && Date.now() < guard.until) {
            if (state.currentTime <= 0.05 && guard.seconds > 0.05) {
                return;
            }
            if (Math.abs(state.currentTime - guard.seconds) <= 0.75 || state.currentTime > 0.05) {
                lastUserSeekRef.current = null;
                setSeekStatusText('');
            }
        }
        setCurrentTime(state.currentTime);
        setDuration(state.duration);
        setPlaying(state.playing);
    }, []);

    const clearChromaMask = () => setChromaMask(DEFAULT_CHROMA_MASK);

    const invertChromaMask = async () => {
        const dataUrl = await invertMaskDataUrl(chromaMask.dataUrl);
        if (dataUrl) setChromaMask({ ...chromaMask, enabled: true, dirty: true, dataUrl });
    };

    const handleExport = async () => {
        if (!source) {
            showNotification(t('graphics.notification.loadVideoBeforeExport', currentLanguage), 'warning');
            return;
        }

        try {
            const nextOperationId = createOperationId('export');
            setBusy(true);
            setOperationId(nextOperationId);
            setOperationState('selecting-output');
            setOperationProgress(undefined);
            setOperationMessage('Select an export path...');
            const result = await window.electronAPI.exportPortraitVideo({
                sourcePath: source.path,
                preset,
                transform,
                includeAudio,
                interpolation,
                operationId: nextOperationId,
                chromaMaskDataUrl: chromaMask.enabled && chromaMask.dirty ? chromaMask.dataUrl : undefined,
                filters: {
                    chromaEnabled: false,
                    keyColor: shotcutFilters.chromaKeyAdvanced.keyColor,
                    similarity: 0.12,
                    blend: 0.08,
                    alpha: 100,
                    colorPreset,
                    saturation: 100,
                    shotcutFilters,
                },
            });
            if (result) showNotification(t('graphics.notification.videoExported', currentLanguage), 'success');
        } catch (error) {
            showNotification(t('graphics.notification.videoExportFailedWithCopy', currentLanguage), 'error', {
                autoHideMs: 10000,
                copyText: getErrorLog(error),
            });
        } finally {
            setBusy(false);
            setOperationState('idle');
        }
    };

    return (
        <Box sx={twoColumnSx}>
            <Box>
                <Paper
                    onDragOver={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        setDragActive(true);
                    }}
                    onDragLeave={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragActive(false);
                    }}
                    onDrop={resolveDroppedVideo}
                    sx={{
                        ...panelSx,
                        p: 2,
                        borderColor: dragActive ? 'var(--primary-color)' : 'var(--border-color)',
                        background: dragActive ? 'color-mix(in srgb, var(--primary-color) 14%, var(--sidebar-bg-color))' : panelSx.background,
                    }}
                >
                    <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', gap: 2, mb: 1.5 }}>
                        <Stack direction="row" spacing={1}>
                            <Button variant="outlined" startIcon={<FileOpenIcon />} sx={outlinedButtonSx} onClick={handleLoad}>
                                {t('graphics.video.load', currentLanguage)}
                            </Button>
                        </Stack>
                        <OverlayToggles overlays={overlays} onChange={setOverlays} language={currentLanguage} />
                    </Stack>

                    <PortraitCanvas
                        media={source}
                        mediaKind="video"
                        transform={transform}
                        overlays={overlays}
                        assets={assets}
                        language={currentLanguage}
                        onPlaybackState={handlePlaybackState}
                        onVideoControllerReady={handleVideoControllerReady}
                        chromaMask={chromaMask}
                        onChromaMaskChange={(nextMask) => {
                            setChromaMask(nextMask);
                            if (nextMask.dirty) {
                                setOverlays((prev) => (prev.maskView ? prev : { ...prev, maskView: true }));
                            }
                        }}
                        shotcutPreviewFilters={shotcutPreviewFilters}
                    />

                    <VideoTimeline
                        currentTime={currentTime}
                        duration={duration}
                        disabled={!source}
                        playing={playing}
                        busy={busy}
                        seekStatusText={seekStatusText}
                        onSeek={handleSeek}
                        onPlay={handlePlay}
                        onPause={handlePause}
                        onStop={handleStop}
                        onMakeLoop={() => setLoopDialogOpen(true)}
                        onExport={handleExport}
                        language={currentLanguage}
                    />
                    <OperationProgressPanel state={operationState} percent={operationProgress} message={operationMessage} />
                </Paper>
                <Stack spacing={2} sx={{ mt: 2 }}>
                    <VideoOptionsPanel
                        language={currentLanguage}
                        includeAudio={includeAudio}
                        setIncludeAudio={setIncludeAudio}
                        interpolation={interpolation}
                        setInterpolation={setInterpolation}
                    />
                    <OutputPanel preset={preset} onChange={setPreset} language={currentLanguage} />
                </Stack>
            </Box>

            <Box>
                <Box sx={sidePanelGridSx}>
                    <TransformPanel transform={transform} onChange={setTransform} language={currentLanguage} />
                    <OverlaySettingsPanel overlays={overlays} onChange={setOverlays} language={currentLanguage} />

                    <Paper sx={{ ...panelSx, ...fullWidthGridItemSx, p: 2 }}>
                        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1 }}>
                            <ColorizeIcon sx={{ color: 'var(--primary-color)' }} />
                            <Typography sx={{ fontWeight: 700 }}>{t('graphics.filters.title', currentLanguage)}</Typography>
                        </Stack>
                        <Box sx={filterRowsGridSx}>
                            {filterRegistry.map((filter) => {
                                const disabled = isFrei0rFilterDisabled(filter);
                                const expanded = Boolean(expandedFilters[filter.id]);
                                const value = shotcutFilters[filter.id];

                                return (
                                    <ShotcutFilterRow
                                        key={filter.id}
                                        filter={filter}
                                        expanded={expanded}
                                        disabled={disabled}
                                        language={currentLanguage}
                                        onToggleExpanded={() => toggleExpandedFilter(filter.id)}
                                        enabled={value.enabled}
                                        onToggleEnabled={(enabled) => updateShotcutFilter(filter.id, { enabled } as Partial<typeof value>)}
                                    >
                                        {filter.id === 'chromaKeyAdvanced' && (
                                            <Stack spacing={1}>
                                                <Button size="small" variant="outlined" sx={outlinedButtonSx} onClick={() => updateShotcutFilter('chromaKeyAdvanced', DEFAULT_SHOTCUT_FILTERS.chromaKeyAdvanced)}>
                                                    {t('graphics.filters.resetPreset', currentLanguage)}
                                                </Button>
                                                <ColorPickerField
                                                    label={t('graphics.filters.keyColor', currentLanguage)}
                                                    value={shotcutFilters.chromaKeyAdvanced.keyColor}
                                                    onChange={(keyColor) => updateShotcutFilter('chromaKeyAdvanced', { keyColor })}
                                                />
                                                <NumberSelect label={t('graphics.filters.colorSpace', currentLanguage)} tooltip={t('graphics.tooltip.colorSpace', currentLanguage)} value={shotcutFilters.chromaKeyAdvanced.colorSpace} options={[{ value: 0, label: 'Red-Green-Blue' }, { value: 1, label: 'Hue-Chroma-Intensity' }]} onChange={(colorSpace) => updateShotcutFilter('chromaKeyAdvanced', { colorSpace })} />
                                                <ControlSlider label={shotcutFilters.chromaKeyAdvanced.colorSpace === 0 ? t('graphics.filters.redDelta', currentLanguage) : t('graphics.filters.hueDelta', currentLanguage)} value={percentValue(shotcutFilters.chromaKeyAdvanced.deltaR)} min={0} max={100} step={0.1} decimals={1} suffix="%" showInput onChange={(value) => updateShotcutFilter('chromaKeyAdvanced', { deltaR: fromPercentValue(value) })} />
                                                <ControlSlider label={shotcutFilters.chromaKeyAdvanced.colorSpace === 0 ? t('graphics.filters.greenDelta', currentLanguage) : t('graphics.filters.chromaDelta', currentLanguage)} value={percentValue(shotcutFilters.chromaKeyAdvanced.deltaG)} min={0} max={100} step={0.1} decimals={1} suffix="%" showInput onChange={(value) => updateShotcutFilter('chromaKeyAdvanced', { deltaG: fromPercentValue(value) })} />
                                                <ControlSlider label={shotcutFilters.chromaKeyAdvanced.colorSpace === 0 ? t('graphics.filters.blueDelta', currentLanguage) : t('graphics.filters.intensityDelta', currentLanguage)} value={percentValue(shotcutFilters.chromaKeyAdvanced.deltaB)} min={0} max={100} step={0.1} decimals={1} suffix="%" showInput onChange={(value) => updateShotcutFilter('chromaKeyAdvanced', { deltaB: fromPercentValue(value) })} />
                                                <NumberSelect label={t('graphics.filters.shape', currentLanguage)} tooltip={t('graphics.tooltip.shape', currentLanguage)} value={shotcutFilters.chromaKeyAdvanced.shape} options={select0rShapeOptions} onChange={(shape) => updateShotcutFilter('chromaKeyAdvanced', { shape })} />
                                                <NumberSelect label={t('graphics.filters.edge', currentLanguage)} tooltip={t('graphics.tooltip.edge', currentLanguage)} value={shotcutFilters.chromaKeyAdvanced.edge} options={select0rEdgeOptions} onChange={(edge) => updateShotcutFilter('chromaKeyAdvanced', { edge })} />
                                                <ControlSlider label={t('graphics.filters.slope', currentLanguage)} value={percentValue(shotcutFilters.chromaKeyAdvanced.slope)} min={0} max={100} step={0.1} decimals={1} suffix="%" showInput onChange={(value) => updateShotcutFilter('chromaKeyAdvanced', { slope: fromPercentValue(value) })} />
                                                <NumberSelect label={t('graphics.filters.operation', currentLanguage)} tooltip={t('graphics.tooltip.operation', currentLanguage)} value={shotcutFilters.chromaKeyAdvanced.operation} options={select0rOperationOptions} onChange={(operation) => updateShotcutFilter('chromaKeyAdvanced', { operation })} />
                                                <FormControlLabel control={<Checkbox checked={shotcutFilters.chromaKeyAdvanced.invert} onChange={(event) => updateShotcutFilter('chromaKeyAdvanced', { invert: event.target.checked })} />} label={t('graphics.filters.invert', currentLanguage)} />
                                                <Divider sx={{ borderColor: 'var(--border-color)' }} />
                                                <Typography sx={{ fontSize: 13, fontWeight: 700 }}>{t('graphics.filters.maskBrush', currentLanguage)}</Typography>
                                                <FormControlLabel control={<Checkbox checked={chromaMask.enabled} onChange={(event) => setChromaMask({ ...chromaMask, enabled: event.target.checked })} />} label={t('graphics.filters.maskEnabled', currentLanguage)} />
                                                <FormControl size="small" fullWidth>
                                                    <InputLabel sx={{ color: 'var(--text-color-light)' }}>{t('graphics.filters.brushMode', currentLanguage)}</InputLabel>
                                                    <Select value={chromaMask.mode} label={t('graphics.filters.brushMode', currentLanguage)} onChange={(event) => setChromaMask({ ...chromaMask, mode: event.target.value as ChromaMaskState['mode'], enabled: true })} sx={selectSx}>
                                                        <MenuItem value="paint">{t('graphics.filters.paint', currentLanguage)}</MenuItem>
                                                        <MenuItem value="erase">{t('graphics.filters.erase', currentLanguage)}</MenuItem>
                                                    </Select>
                                                </FormControl>
                                                <ControlSlider label={t('graphics.filters.brushSize', currentLanguage)} value={chromaMask.brushSize} min={8} max={220} onChange={(brushSize) => setChromaMask({ ...chromaMask, brushSize, enabled: true })} />
                                                <Stack direction="row" spacing={1}>
                                                    <Button size="small" variant="outlined" sx={outlinedButtonSx} onClick={clearChromaMask}>{t('graphics.filters.clearMask', currentLanguage)}</Button>
                                                    <Button size="small" variant="outlined" sx={outlinedButtonSx} disabled={!chromaMask.dirty} onClick={invertChromaMask}>{t('graphics.filters.invertMask', currentLanguage)}</Button>
                                                </Stack>
                                            </Stack>
                                        )}
                                        {filter.id === 'keySpillAdvanced' && (
                                            <Stack spacing={1}>
                                                <ColorPickerField
                                                    label={t('graphics.filters.keyColor', currentLanguage)}
                                                    value={shotcutFilters.keySpillAdvanced.keyColor}
                                                    onChange={(keyColor) => updateShotcutFilter('keySpillAdvanced', { keyColor })}
                                                />
                                                <ColorPickerField
                                                    label={t('graphics.filters.targetColor', currentLanguage)}
                                                    value={shotcutFilters.keySpillAdvanced.targetColor}
                                                    onChange={(targetColor) => updateShotcutFilter('keySpillAdvanced', { targetColor })}
                                                />
                                                <NumberSelect label={t('graphics.filters.maskType', currentLanguage)} tooltip={t('graphics.tooltip.maskType', currentLanguage)} value={shotcutFilters.keySpillAdvanced.maskType} options={keySpillMaskOptions.map((label, value) => ({ label, value }))} onChange={(maskType) => updateShotcutFilter('keySpillAdvanced', { maskType })} />
                                                <ControlSlider label={t('graphics.filters.tolerance', currentLanguage)} value={percentValue(shotcutFilters.keySpillAdvanced.tolerance)} min={0} max={100} step={0.1} decimals={1} suffix="%" showInput onChange={(value) => updateShotcutFilter('keySpillAdvanced', { tolerance: fromPercentValue(value) })} />
                                                <ControlSlider label={t('graphics.filters.slope', currentLanguage)} value={percentValue(shotcutFilters.keySpillAdvanced.slope)} min={0} max={100} step={0.1} decimals={1} suffix="%" showInput onChange={(value) => updateShotcutFilter('keySpillAdvanced', { slope: fromPercentValue(value) })} />
                                                <ControlSlider label={t('graphics.filters.hueGate', currentLanguage)} value={percentValue(shotcutFilters.keySpillAdvanced.hueGate)} min={0} max={100} step={0.1} decimals={1} suffix="%" showInput onChange={(value) => updateShotcutFilter('keySpillAdvanced', { hueGate: fromPercentValue(value) })} />
                                                <ControlSlider label={t('graphics.filters.saturationThreshold', currentLanguage)} value={percentValue(shotcutFilters.keySpillAdvanced.saturationThreshold)} min={0} max={100} step={0.1} decimals={1} suffix="%" showInput onChange={(value) => updateShotcutFilter('keySpillAdvanced', { saturationThreshold: fromPercentValue(value) })} />
                                                <NumberSelect label={t('graphics.filters.operation1', currentLanguage)} tooltip={t('graphics.tooltip.operation', currentLanguage)} value={shotcutFilters.keySpillAdvanced.operation1} options={keySpillOperationOptions.map((label, value) => ({ label, value }))} onChange={(operation1) => updateShotcutFilter('keySpillAdvanced', { operation1 })} />
                                                <ControlSlider label={t('graphics.filters.amount1', currentLanguage)} value={percentValue(shotcutFilters.keySpillAdvanced.amount1)} min={0} max={100} step={0.1} decimals={1} suffix="%" showInput onChange={(value) => updateShotcutFilter('keySpillAdvanced', { amount1: fromPercentValue(value) })} />
                                                <NumberSelect label={t('graphics.filters.operation2', currentLanguage)} tooltip={t('graphics.tooltip.operation', currentLanguage)} value={shotcutFilters.keySpillAdvanced.operation2} options={keySpillOperationOptions.map((label, value) => ({ label, value }))} onChange={(operation2) => updateShotcutFilter('keySpillAdvanced', { operation2 })} />
                                                <ControlSlider label={t('graphics.filters.amount2', currentLanguage)} value={percentValue(shotcutFilters.keySpillAdvanced.amount2)} min={0} max={100} step={0.1} decimals={1} suffix="%" showInput onChange={(value) => updateShotcutFilter('keySpillAdvanced', { amount2: fromPercentValue(value) })} />
                                                <FormControlLabel control={<Checkbox checked={shotcutFilters.keySpillAdvanced.showMask} onChange={(event) => updateShotcutFilter('keySpillAdvanced', { showMask: event.target.checked })} />} label={t('graphics.filters.showMask', currentLanguage)} />
                                                <FormControlLabel control={<Checkbox checked={shotcutFilters.keySpillAdvanced.maskAlpha} onChange={(event) => updateShotcutFilter('keySpillAdvanced', { maskAlpha: event.target.checked })} />} label={t('graphics.filters.maskAlpha', currentLanguage)} />
                                            </Stack>
                                        )}
                                        {filter.id === 'alphaChannelAdjust' && (
                                            <Stack spacing={1}>
                                                <FormControl size="small" fullWidth>
                                                    <InputLabel sx={{ color: 'var(--text-color-light)' }}>{t('graphics.filters.mode', currentLanguage)}</InputLabel>
                                                    <Select
                                                        value={shotcutFilters.alphaChannelAdjust.operation}
                                                        label={t('graphics.filters.mode', currentLanguage)}
                                                        onChange={(event) => {
                                                            const operation = Number(event.target.value);
                                                            updateShotcutFilter('alphaChannelAdjust', operation === -1 ? { operation: 0.8, amount: 1, threshold: 1 } : { operation });
                                                        }}
                                                        sx={selectSx}
                                                    >
                                                        {alphaOperationOptions.map((option) => (
                                                            <MenuItem key={option.label} value={option.value}>{option.label}</MenuItem>
                                                        ))}
                                                    </Select>
                                                </FormControl>
                                                <ControlSlider label={t('graphics.filters.amount', currentLanguage)} value={percentValue(shotcutFilters.alphaChannelAdjust.amount)} min={0} max={100} step={0.1} decimals={1} suffix="%" showInput onChange={(value) => updateShotcutFilter('alphaChannelAdjust', { amount: fromPercentValue(value), threshold: fromPercentValue(value) })} />
                                                <FormControlLabel control={<Checkbox checked={shotcutFilters.alphaChannelAdjust.invert} onChange={(event) => updateShotcutFilter('alphaChannelAdjust', { invert: event.target.checked })} />} label={t('graphics.filters.invert', currentLanguage)} />
                                            </Stack>
                                        )}
                                        {filter.id === 'saturation' && (
                                            <ControlSlider label={t('graphics.filters.level', currentLanguage)} value={shotcutFilters.saturation.level} min={0} max={300} onChange={(level) => updateShotcutFilter('saturation', { level })} />
                                        )}
                                        {filter.id === 'contrast' && (
                                            <ControlSlider label={t('graphics.filters.level', currentLanguage)} value={shotcutFilters.contrast.level} min={0} max={100} onChange={(level) => updateShotcutFilter('contrast', { level })} />
                                        )}
                                        {filter.id === 'colorGrading' && (
                                            <ColorGradingControl
                                                value={shotcutFilters.colorGrading}
                                                language={currentLanguage}
                                                onChange={(colorGrading) => updateShotcutFilter('colorGrading', colorGrading)}
                                            />
                                        )}
                                    </ShotcutFilterRow>
                                );
                            })}
                        </Box>
                        <FormControl fullWidth size="small" sx={{ mt: 1 }}>
                            <InputLabel sx={{ color: 'var(--text-color-light)' }}>{t('graphics.filters.colorPreset', currentLanguage)}</InputLabel>
                            <Select value={colorPreset} label={t('graphics.filters.colorPreset', currentLanguage)} onChange={(event) => setColorPreset(event.target.value)} sx={selectSx}>
                                {colorPresets.map((item) => (
                                    <MenuItem key={item.id} value={item.id}>
                                        {getColorPresetLabel(item, currentLanguage)}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                        <Typography sx={{ mt: 1, color: 'var(--text-color-light)', fontSize: 12 }}>
                            {t('graphics.filters.currentPreset', currentLanguage)} {selectedColorPreset ? getColorPresetLabel(selectedColorPreset, currentLanguage) : colorPreset}. {t('graphics.filters.previewNote', currentLanguage)}
                        </Typography>
                    </Paper>
                </Box>
            </Box>

            <Dialog open={loopDialogOpen} onClose={() => setLoopDialogOpen(false)} slotProps={{ paper: { sx: dialogPaperSx } }}>
                <DialogTitle>{t('graphics.loopDialog.title', currentLanguage)}</DialogTitle>
                <DialogContent>
                    <Typography sx={{ color: 'var(--text-color-light)' }}>
                        {t('graphics.loopDialog.body', currentLanguage)}
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button sx={outlinedButtonSx} onClick={() => setLoopDialogOpen(false)}>{t('graphics.common.cancel', currentLanguage)}</Button>
                    <Button variant="contained" disabled={busy} onClick={handleCreateLoop}>{t('graphics.common.continue', currentLanguage)}</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}

function ImageTool({ assets }: { assets: GraphicsAssets | null }) {
    const { showNotification } = useNotification();
    const currentLanguage = useCurrentLanguage();
    const [source, setSource] = useState<GraphicsFile | null>(null);
    const [transform, setTransform] = useState(DEFAULT_TRANSFORM);
    const [overlays, setOverlays] = useState(DEFAULT_OVERLAYS);
    const [preset, setPreset] = useState<PortraitOutputPreset>('high');
    const [keyColor, setKeyColor] = useState('#00ff00');
    const [tolerance, setTolerance] = useState(40);
    const [softness, setSoftness] = useState(0);
    const [removeBackground, setRemoveBackground] = useState(false);
    const [busy, setBusy] = useState(false);
    const [operationState, setOperationState] = useState<OperationState>('idle');
    const [operationMessage, setOperationMessage] = useState('');
    const [dragActive, setDragActive] = useState(false);
    const imagePreviewFilters = buildCanvasPreviewOptions('', DEFAULT_SHOTCUT_FILTERS, undefined, {
        enabled: removeBackground,
        keyColor,
        tolerance,
        softness,
    });

    useOverlayShortcuts(setOverlays);

    const loadImageSource = (selected: GraphicsFile) => {
        setSource(selected);
        showNotification(`${t('graphics.notification.imageLoaded', currentLanguage)} ${selected.name}`, 'success');
    };

    const resolveDroppedImage = async (event: DragEvent<HTMLElement>) => {
        event.preventDefault();
        event.stopPropagation();
        setDragActive(false);

        const file = event.dataTransfer.files.item(0);
        if (!file) {
            showNotification(t('graphics.notification.dropEmpty', currentLanguage), 'warning');
            return;
        }

        try {
            const selected = (await window.electronAPI.resolveDroppedGraphicsFile(file, 'image')) as GraphicsFile;
            loadImageSource(selected);
        } catch (error) {
            showNotification(getErrorMessage(error, t('graphics.notification.imageDropFailed', currentLanguage)), 'error');
        }
    };

    const handleLoad = async () => {
        try {
            const selected = (await window.electronAPI.selectGraphicsImage()) as GraphicsFile | null;
            if (!selected) return;
            loadImageSource(selected);
        } catch (error) {
            showNotification(getErrorMessage(error, t('graphics.notification.imageLoadFailed', currentLanguage)), 'error');
        }
    };

    const makeImageDataUrl = useCallback(async () => {
        if (!source) throw new Error('No source image selected.');

        const image = await createImageElement(source.url);
        const presetSize = OUTPUT_PRESETS[preset];
        const scaleFactor = presetSize.width / 1200;
        const sourceWidth = (presetSize.width * transform.scale) / 100;
        const sourceHeight = sourceWidth * (image.naturalHeight / image.naturalWidth);
        const dx = (presetSize.width - sourceWidth) / 2 + transform.x * scaleFactor;
        const dy = (presetSize.height - sourceHeight) / 2 + transform.y * scaleFactor;
        const canvas = document.createElement('canvas');
        canvas.width = presetSize.width;
        canvas.height = presetSize.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas export is unavailable.');

        ctx.clearRect(0, 0, presetSize.width, presetSize.height);
        ctx.drawImage(image, dx, dy, sourceWidth, sourceHeight);

        if (removeBackground) {
            const data = ctx.getImageData(0, 0, presetSize.width, presetSize.height);
            const hex = keyColor.trim().replace(/^#/, '');
            const r = Number.parseInt(hex.slice(0, 2), 16);
            const g = Number.parseInt(hex.slice(2, 4), 16);
            const b = Number.parseInt(hex.slice(4, 6), 16);

            if ([r, g, b].some((value) => !Number.isFinite(value))) {
                throw new Error('Invalid key color.');
            }

            for (let i = 0; i < data.data.length; i += 4) {
                const dr = data.data[i] - r;
                const dg = data.data[i + 1] - g;
                const db = data.data[i + 2] - b;
                const distance = Math.sqrt(dr * dr + dg * dg + db * db);

                if (distance <= tolerance) {
                    data.data[i + 3] = 0;
                } else if (softness > 0 && distance <= tolerance + softness) {
                    const factor = (distance - tolerance) / softness;
                    data.data[i + 3] = Math.round(data.data[i + 3] * factor);
                }
            }

            ctx.putImageData(data, 0, 0);
        }

        return canvas.toDataURL('image/png');
    }, [keyColor, preset, removeBackground, softness, source, tolerance, transform.x, transform.y, transform.scale]);

    const handleApplyBackgroundRemoval = async () => {
        if (!source) {
            showNotification(t('graphics.notification.loadImageBeforeBackground', currentLanguage), 'warning');
            return;
        }

        setRemoveBackground(true);
        showNotification(t('graphics.notification.backgroundEnabled', currentLanguage), 'info');
    };

    const handleExport = async () => {
        if (!source) {
            showNotification(t('graphics.notification.loadImageBeforeExport', currentLanguage), 'warning');
            return;
        }

        try {
            setBusy(true);
            setOperationState('exporting-image');
            setOperationMessage(t('graphics.image.exporting', currentLanguage));
            const dataUrl = await makeImageDataUrl();
            const result = await window.electronAPI.exportPortraitImage({
                dataUrl,
                defaultName: `${source.name.replace(/\.[^.]+$/, '')}_${preset}_portrait`,
            });
            if (result) showNotification(t('graphics.notification.imageExported', currentLanguage), 'success');
        } catch (error) {
            showNotification(getErrorMessage(error, t('graphics.notification.imageExportFailed', currentLanguage)), 'error');
        } finally {
            setBusy(false);
            setOperationState('idle');
        }
    };

    return (
        <Box sx={twoColumnSx}>
            <Box>
                <Paper
                    onDragOver={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        setDragActive(true);
                    }}
                    onDragLeave={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragActive(false);
                    }}
                    onDrop={resolveDroppedImage}
                    sx={{
                        ...panelSx,
                        p: 2,
                        borderColor: dragActive ? 'var(--primary-color)' : 'var(--border-color)',
                        background: dragActive ? 'color-mix(in srgb, var(--primary-color) 14%, var(--sidebar-bg-color))' : panelSx.background,
                    }}
                >
                    <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', gap: 2, mb: 1.5 }}>
                        <Button variant="outlined" startIcon={<FileOpenIcon />} sx={outlinedButtonSx} onClick={handleLoad}>
                            {t('graphics.image.load', currentLanguage)}
                        </Button>
                        <OverlayToggles overlays={overlays} onChange={setOverlays} language={currentLanguage} />
                    </Stack>

                    <PortraitCanvas
                        media={source}
                        mediaKind="image"
                        transform={transform}
                        overlays={overlays}
                        assets={assets}
                        language={currentLanguage}
                        shotcutPreviewFilters={imagePreviewFilters}
                    />

                    <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
                        <Button variant="outlined" startIcon={<AutoFixHighIcon />} sx={outlinedButtonSx} disabled={!source} onClick={handleApplyBackgroundRemoval}>
                            {t('graphics.image.applyColorKey', currentLanguage)}
                        </Button>
                        <Button variant="contained" startIcon={<SaveIcon />} disabled={!source || busy} onClick={handleExport}>
                            {t('graphics.image.exportPng', currentLanguage)}
                        </Button>
                    </Stack>
                    <OperationProgressPanel state={operationState} message={operationMessage} />
                </Paper>
            </Box>

            <Box>
                <Box sx={sidePanelGridSx}>
                    <Box sx={fullWidthGridItemSx}>
                        <OutputPanel preset={preset} onChange={setPreset} language={currentLanguage} />
                    </Box>
                    <TransformPanel transform={transform} onChange={setTransform} language={currentLanguage} />
                    <OverlaySettingsPanel overlays={overlays} onChange={setOverlays} language={currentLanguage} />
                    <Paper sx={{ ...panelSx, ...fullWidthGridItemSx, p: 2 }}>
                        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1 }}>
                            <ColorizeIcon sx={{ color: 'var(--primary-color)' }} />
                            <Typography sx={{ fontWeight: 700 }}>{t('graphics.image.backgroundAlpha', currentLanguage)}</Typography>
                        </Stack>
                        <FormControlLabel control={<Checkbox checked={removeBackground} onChange={(event) => setRemoveBackground(event.target.checked)} />} label={t('graphics.image.removeBackground', currentLanguage)} />
                        <ColorPickerField label={t('graphics.filters.keyColor', currentLanguage)} value={keyColor} onChange={setKeyColor} />
                        <ControlSlider label={t('graphics.filters.tolerance', currentLanguage)} value={tolerance} min={0} max={255} onChange={setTolerance} />
                        <ControlSlider label={t('graphics.image.edgeSoftness', currentLanguage)} value={softness} min={0} max={160} onChange={setSoftness} />
                    </Paper>
                </Box>
            </Box>
        </Box>
    );
}

type RigGuideLine = {
    id: string;
    label: string;
    color: string;
    y: number;
    value: number;
};

type RigPoint = {
    id: string;
    color: string;
    x: number;
    y: number;
};

const rigGuideLines: RigGuideLine[] = [
    { id: 'headTop', label: 'Head top', color: '#ff5364', y: 8, value: 1024 },
    { id: 'eyes', label: 'Eyes', color: '#f1ea33', y: 17, value: 890 },
    { id: 'mouth', label: 'Mouth', color: '#d985e8', y: 24, value: 808 },
    { id: 'neck', label: 'Neck', color: '#2f92ff', y: 33, value: 720 },
    { id: 'shoulder', label: 'Shoulder', color: '#4fc878', y: 41, value: 630 },
    { id: 'chest', label: 'Chest', color: '#3ca05a', y: 49, value: 560 },
    { id: 'waist', label: 'Waist', color: '#f4a11a', y: 61, value: 420 },
    { id: 'pelvis', label: 'Pelvis/Hip', color: '#f27a1a', y: 68, value: 320 },
    { id: 'foot', label: 'Floor', color: '#d8d8d8', y: 91, value: 0 },
];

const rigSideRows = [
    { id: 'leftShoulder', color: '#24d0c6', value: 630 },
    { id: 'rightShoulder', color: '#24d0c6', value: 630 },
    { id: 'leftTorso', color: '#3478f6', value: 580 },
    { id: 'rightTorso', color: '#9357e8', value: 580 },
];

const rigPoints: RigPoint[] = [
    { id: 'head', color: '#ff5364', x: 50, y: 8 },
    { id: 'eyes', color: '#f1ea33', x: 50, y: 17 },
    { id: 'mouth', color: '#d985e8', x: 50, y: 24 },
    { id: 'neck', color: '#2f92ff', x: 50, y: 33 },
    { id: 'lShoulder', color: '#4fc878', x: 38, y: 41 },
    { id: 'rShoulder', color: '#4fc878', x: 62, y: 41 },
    { id: 'chest', color: '#3ca05a', x: 50, y: 49 },
    { id: 'waist', color: '#f4a11a', x: 50, y: 61 },
    { id: 'pelvis', color: '#f27a1a', x: 50, y: 68 },
    { id: 'foot', color: '#d8d8d8', x: 50, y: 91 },
];

const partRows = [
    { id: 'head', count: 4, color: '#9a5d53' },
    { id: 'torso', count: 7, color: '#8b704e' },
    { id: 'arm', count: 7, color: '#b88c78' },
    { id: 'leg', count: 5, color: '#705436' },
];

function RiggingTool() {
    const { showNotification } = useNotification();
    const currentLanguage = useCurrentLanguage();

    const notifyTodo = () => {
        showNotification(t('graphics.rigging.todo', currentLanguage), 'info');
    };

    return (
        <Box sx={twoColumnSx}>
            <Box>
                <Paper sx={{ ...panelSx, p: 2 }}>
                    <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                        <Typography sx={{ fontWeight: 700 }}>{t('graphics.rigging.title', currentLanguage)}</Typography>
                        <Stack direction="row" spacing={0.5}>
                            <TooltipButton title={t('graphics.image.load', currentLanguage)}>
                                <IconButton size="small" sx={{ color: 'var(--text-color-light)' }} onClick={notifyTodo}>
                                    <FolderOpenIcon fontSize="small" />
                                </IconButton>
                            </TooltipButton>
                            <TooltipButton title={t('graphics.video.exportWebm', currentLanguage)}>
                                <IconButton size="small" sx={{ color: 'var(--text-color-light)' }} onClick={notifyTodo}>
                                    <SaveIcon fontSize="small" />
                                </IconButton>
                            </TooltipButton>
                            <TooltipButton title={t('graphics.rigging.exportSettings', currentLanguage)}>
                                <IconButton size="small" sx={{ color: 'var(--text-color-light)' }} onClick={notifyTodo}>
                                    <SettingsIcon fontSize="small" />
                                </IconButton>
                            </TooltipButton>
                            <IconButton size="small" sx={{ color: 'var(--text-color-light)' }} onClick={notifyTodo}>
                                <CloseIcon fontSize="small" />
                            </IconButton>
                        </Stack>
                    </Stack>
                    <Box sx={innerTwoColumnSx}>
                        <Box>
                            <Box
                                sx={{
                                    position: 'relative',
                                    height: 560,
                                    border: '1px solid var(--border-color)',
                                    borderRadius: 1,
                                    overflow: 'hidden',
                                    background: 'linear-gradient(180deg, rgba(34,37,41,0.95), rgba(21,24,28,0.95))',
                                }}
                            >
                                <Box
                                    sx={{
                                        position: 'absolute',
                                        left: '50%',
                                        top: '8%',
                                        width: '38%',
                                        height: '82%',
                                        transform: 'translateX(-50%)',
                                        border: '1px solid rgba(255,255,255,0.2)',
                                        borderRadius: '45% 45% 18% 18%',
                                        background:
                                            'linear-gradient(180deg, rgba(180,130,88,0.55), rgba(70,54,36,0.72) 45%, rgba(32,35,38,0.84))',
                                        boxShadow: '0 24px 60px rgba(0,0,0,0.42)',
                                    }}
                                />
                                <Box sx={{ position: 'absolute', left: '50%', top: '8%', bottom: '9%', width: 1, background: 'rgba(76, 166, 255, 0.8)' }} />
                                {rigGuideLines.map((line) => (
                                    <Box key={line.id}>
                                        <Typography
                                            sx={{
                                                position: 'absolute',
                                                left: 12,
                                                top: `calc(${line.y}% - 8px)`,
                                                color: line.color,
                                                fontSize: 13,
                                                fontWeight: 700,
                                            }}
                                        >
                                            {t(`graphics.rigging.line.${line.id}` as any, currentLanguage)}
                                        </Typography>
                                        <Box
                                            sx={{
                                                position: 'absolute',
                                                left: 82,
                                                right: 22,
                                                top: `${line.y}%`,
                                                height: 1,
                                                background: line.color,
                                                opacity: 0.7,
                                            }}
                                        />
                                    </Box>
                                ))}
                                {rigPoints.map((point) => (
                                    <Box
                                        key={point.id}
                                        sx={{
                                            position: 'absolute',
                                            left: `${point.x}%`,
                                            top: `${point.y}%`,
                                            width: 10,
                                            height: 10,
                                            transform: 'translate(-50%, -50%)',
                                            borderRadius: '50%',
                                            background: point.color,
                                            boxShadow: '0 0 0 2px rgba(0,0,0,0.38)',
                                        }}
                                    />
                                ))}
                            </Box>
                        </Box>
                        <Box>
                            <Paper sx={{ ...innerPanelSx, p: 1.5, height: '100%' }}>
                                <Typography sx={{ fontWeight: 700, mb: 1 }}>{t('graphics.rigging.referenceSettings', currentLanguage)}</Typography>
                                <Stack spacing={0.75}>
                                    {rigGuideLines.map((row) => (
                                        <Stack key={row.id} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                                            <Box sx={{ width: 10, height: 10, borderRadius: '50%', background: row.color }} />
                                            <Typography sx={{ flex: 1, fontSize: 12 }}>{t(`graphics.rigging.line.${row.id}` as any, currentLanguage)}</Typography>
                                            <TextField size="small" value={row.value} disabled sx={{ ...inputSx, width: 72 }} />
                                        </Stack>
                                    ))}
                                    {rigSideRows.map((row) => (
                                        <Stack key={row.id} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                                            <Box sx={{ width: 10, height: 10, borderRadius: '50%', background: row.color }} />
                                            <Typography sx={{ flex: 1, fontSize: 12 }}>{t(`graphics.rigging.side.${row.id}` as any, currentLanguage)}</Typography>
                                            <TextField size="small" value={row.value} disabled sx={{ ...inputSx, width: 72 }} />
                                        </Stack>
                                    ))}
                                </Stack>
                                <Divider sx={{ my: 1.5, borderColor: 'var(--border-color)' }} />
                                <Typography sx={{ fontWeight: 700, mb: 0.75 }}>{t('graphics.rigging.guideDisplay', currentLanguage)}</Typography>
                                <FormControlLabel control={<Checkbox defaultChecked />} label={t('graphics.rigging.horizontalGuide', currentLanguage)} />
                                <FormControlLabel control={<Checkbox defaultChecked />} label={t('graphics.rigging.verticalCenter', currentLanguage)} />
                                <Typography sx={{ fontWeight: 700, mt: 1, mb: 0.75 }}>{t('graphics.rigging.characterSelection', currentLanguage)}</Typography>
                                <FormControlLabel control={<Checkbox />} label={t('graphics.rigging.maleCharacter', currentLanguage)} />
                                <FormControlLabel control={<Checkbox defaultChecked />} label={t('graphics.rigging.femaleCenter', currentLanguage)} />
                                <FormControlLabel control={<Checkbox />} label={t('graphics.rigging.femaleRight', currentLanguage)} />
                                <Button fullWidth variant="contained" sx={{ mt: 1.5 }} onClick={notifyTodo}>
                                    {t('graphics.rigging.apply', currentLanguage)}
                                </Button>
                                <Button fullWidth variant="outlined" sx={{ ...outlinedButtonSx, mt: 1 }} onClick={notifyTodo}>
                                    {t('graphics.rigging.reset', currentLanguage)}
                                </Button>
                            </Paper>
                        </Box>
                    </Box>
                </Paper>
            </Box>
            <Box>
                <Stack spacing={2}>
                    <Paper sx={{ ...panelSx, p: 2 }}>
                        <Typography sx={{ fontWeight: 700, mb: 1 }}>{t('graphics.rigging.previewTitle', currentLanguage)}</Typography>
                        <Stack spacing={1}>
                            {partRows.map((row) => (
                                <Stack key={row.id} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                                    <Typography sx={{ width: 56, fontSize: 13 }}>{t(`graphics.rigging.part.${row.id}` as any, currentLanguage)}</Typography>
                                    <Box
                                        sx={{
                                            flex: 1,
                                            display: 'grid',
                                            gridTemplateColumns: `repeat(${row.count}, minmax(0, 1fr))`,
                                            gap: 0.75,
                                            p: 0.75,
                                            border: '1px solid var(--border-color)',
                                            borderRadius: 1,
                                            background: 'rgba(0,0,0,0.14)',
                                        }}
                                    >
                                        {Array.from({ length: row.count }, (_, index) => (
                                            <Box
                                                key={index}
                                                sx={{
                                                    height: row.id === 'torso' ? 54 : 34,
                                                    border: '1px solid rgba(255,255,255,0.12)',
                                                    borderRadius: 0.75,
                                                    background: `linear-gradient(145deg, ${row.color}, rgba(20,20,24,0.82))`,
                                                }}
                                            />
                                        ))}
                                    </Box>
                                </Stack>
                            ))}
                        </Stack>
                    </Paper>
                    <Paper sx={{ ...panelSx, p: 2 }}>
                        <Typography sx={{ fontWeight: 700, mb: 1 }}>{t('graphics.rigging.exportSettings', currentLanguage)}</Typography>
                        <FormControl fullWidth size="small" sx={{ mb: 1 }}>
                            <InputLabel sx={{ color: 'var(--text-color-light)' }}>{t('graphics.rigging.textureSize', currentLanguage)}</InputLabel>
                            <Select value="2048" label={t('graphics.rigging.textureSize', currentLanguage)} disabled sx={selectSx}>
                                <MenuItem value="2048">2048 x 2048</MenuItem>
                            </Select>
                        </FormControl>
                        <FormControl fullWidth size="small" sx={{ mb: 1 }}>
                            <InputLabel sx={{ color: 'var(--text-color-light)' }}>{t('graphics.rigging.fileFormat', currentLanguage)}</InputLabel>
                            <Select value="png" label={t('graphics.rigging.fileFormat', currentLanguage)} disabled sx={selectSx}>
                                <MenuItem value="png">PNG</MenuItem>
                            </Select>
                        </FormControl>
                        <FormControl fullWidth size="small" sx={{ mb: 1.5 }}>
                            <InputLabel sx={{ color: 'var(--text-color-light)' }}>{t('graphics.rigging.background', currentLanguage)}</InputLabel>
                            <Select value="transparent" label={t('graphics.rigging.background', currentLanguage)} disabled sx={selectSx}>
                                <MenuItem value="transparent">{t('graphics.rigging.transparent', currentLanguage)}</MenuItem>
                            </Select>
                        </FormControl>
                        <Button fullWidth variant="contained" startIcon={<SaveIcon />} onClick={notifyTodo}>
                            {t('graphics.rigging.exportTexture', currentLanguage)}
                        </Button>
                    </Paper>
                    <Alert severity="info">{t('graphics.rigging.todoAlert', currentLanguage)}</Alert>
                </Stack>
            </Box>
        </Box>
    );
}

export default function GraphicsTool() {
    const { showNotification } = useNotification();
    const currentLanguage = useCurrentLanguage();
    const [tab, setTab] = useState<GraphicsTab>('video');
    const [assets, setAssets] = useState<GraphicsAssets | null>(null);

    useEffect(() => {
        window.electronAPI
            .getGraphicsAssets()
            .then((nextAssets: GraphicsAssets) => setAssets(nextAssets))
            .catch((error: unknown) => showNotification(getErrorMessage(error, t('graphics.notification.assetsFailed', currentLanguage)), 'error'));
    }, [currentLanguage, showNotification]);

    return (
        <Box sx={{ width: '100%', maxWidth: 1480, mx: 'auto' }}>
            <Typography variant="h5" sx={{ fontWeight: 800, color: 'var(--text-color)' }}>
                {t('nav.visualForge', currentLanguage)}
            </Typography>
            <Typography sx={{ mt: 0.5, color: 'var(--text-color-light)' }}>
                {t('graphics.subtitle', currentLanguage)}
            </Typography>

            <Tabs
                value={tab}
                onChange={(_, next) => setTab(next)}
                sx={{
                    mt: 2,
                    mb: 2,
                    borderBottom: '1px solid var(--border-color)',
                    '& .MuiTab-root': { color: 'var(--text-color-light)', textTransform: 'none' },
                    '& .Mui-selected': { color: 'var(--primary-color)' },
                    '& .MuiTabs-indicator': { backgroundColor: 'var(--primary-color)' },
                }}
            >
                <Tab icon={<MovieCreationIcon />} iconPosition="start" label={t('graphics.tab.video', currentLanguage)} value="video" />
                <Tab icon={<AddPhotoAlternateIcon />} iconPosition="start" label={t('graphics.tab.image', currentLanguage)} value="image" />
                <Tab icon={<TuneIcon />} iconPosition="start" label={t('graphics.tab.rigging', currentLanguage)} value="rigging" />
            </Tabs>

            {tab === 'video' && <VideoTool assets={assets} />}
            {tab === 'image' && <ImageTool assets={assets} />}
            {tab === 'rigging' && <RiggingTool />}

            <Divider sx={{ my: 2, borderColor: 'var(--border-color)' }} />
            <Typography sx={{ color: 'var(--text-color-secondary)', fontSize: 12 }}>
                {t('graphics.shortcuts', currentLanguage)}
            </Typography>
        </Box>
    );
}
