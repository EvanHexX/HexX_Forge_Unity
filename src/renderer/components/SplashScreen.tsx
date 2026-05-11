import { useEffect } from 'react';
import { Box, Button, Fade, LinearProgress, Stack, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import splashLogo from '../assets/splash/Logo_without_title.png';

export type SplashMode = 'startup' | 'update' | 'preview';

type Props = {
    open: boolean;
    mode: SplashMode;
    progress?: number;
    message?: string;
    onClose?: () => void;
};

const modeCopy: Record<SplashMode, { title: string; fallbackMessage: string }> = {
    startup: {
        title: 'HexX Forge',
        fallbackMessage: 'Loading forge systems...'
    },
    update: {
        title: 'Updating HexX Forge',
        fallbackMessage: 'Preparing update channel...'
    },
    preview: {
        title: 'Feature in Preparation',
        fallbackMessage: 'This workspace is being prepared for a future beta.'
    }
};

export default function SplashScreen({ open, mode, progress, message, onClose }: Props) {
    const copy = modeCopy[mode];
    const normalizedProgress = typeof progress === 'number' ? Math.max(0, Math.min(100, progress)) : undefined;
    const showProgress = mode === 'update' && typeof normalizedProgress === 'number';

    useEffect(() => {
        if (!open || !onClose) return;

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                onClose();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose, open]);

    return (
        <Fade in={open} timeout={{ enter: 260, exit: 220 }} unmountOnExit>
            <Box sx={overlaySx}>
                <Box sx={scanlineSx} />
                <Box sx={noiseSx} />

                {onClose && (
                    <Button
                        aria-label="Close preparation screen"
                        onClick={onClose}
                        sx={closeButtonSx}
                    >
                        <CloseIcon fontSize="small" />
                    </Button>
                )}

                <Stack spacing={2.25} sx={{ ...contentSx, alignItems: 'center' }}>
                    <Box sx={logoStageSx}>
                        <Box sx={hexArcSx} />
                        <Box sx={fireGlowSx} />
                        <Box sx={blueGlitchSx} />
                        <Box component="img" src={splashLogo} alt="HexX Forge" sx={logoSx} />
                    </Box>

                    <Box sx={{ textAlign: 'center', width: 'min(520px, 84vw)' }}>
                        <Typography variant="h4" sx={titleSx}>
                            {copy.title}
                        </Typography>
                        <Typography sx={messageSx}>
                            {message || copy.fallbackMessage}
                        </Typography>

                        {showProgress && (
                            <Box sx={{ mt: 2 }}>
                                <LinearProgress
                                    variant="determinate"
                                    value={normalizedProgress}
                                    sx={progressSx}
                                />
                                <Typography sx={progressTextSx}>
                                    {Math.round(normalizedProgress)}%
                                </Typography>
                            </Box>
                        )}
                    </Box>
                </Stack>
            </Box>
        </Fade>
    );
}

const overlaySx = {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100vw',
    height: '100vh',
    zIndex: 2000,
    display: 'grid',
    placeItems: 'center',
    overflow: 'hidden',
    color: 'var(--text-color)',
    background:
        'radial-gradient(circle at 50% 46%, rgba(255, 117, 24, 0.18), transparent 30%), radial-gradient(circle at 42% 68%, rgba(0, 210, 255, 0.14), transparent 26%), color-mix(in srgb, var(--bg-color) 94%, #050508)',
    '&::before': {
        content: '""',
        position: 'absolute',
        inset: '-18%',
        background:
            'linear-gradient(115deg, transparent 0 38%, rgba(255,255,255,0.08) 45%, transparent 52% 100%)',
        animation: 'splashSweep 4200ms ease-in-out infinite'
    },
    '@keyframes splashSweep': {
        '0%, 100%': { transform: 'translateX(-18%) rotate(0deg)', opacity: 0.22 },
        '48%': { transform: 'translateX(18%) rotate(4deg)', opacity: 0.45 }
    },
    '@keyframes firePulse': {
        '0%': { transform: 'translate(-50%, -50%) scale(0.78)', opacity: 0.42, filter: 'blur(14px)' },
        '17%': { transform: 'translate(-51%, -52%) scale(1.08)', opacity: 0.72, filter: 'blur(18px)' },
        '43%': { transform: 'translate(-48%, -49%) scale(0.92)', opacity: 0.52, filter: 'blur(16px)' },
        '67%': { transform: 'translate(-52%, -50%) scale(1.22)', opacity: 0.8, filter: 'blur(20px)' },
        '100%': { transform: 'translate(-50%, -50%) scale(0.78)', opacity: 0.42, filter: 'blur(14px)' }
    },
    '@keyframes glitchShift': {
        '0%, 100%': { transform: 'translateX(0)', opacity: 0 },
        '8%': { transform: 'translateX(-17px)', opacity: 0.58 },
        '10%': { transform: 'translateX(15px)', opacity: 0.16 },
        '20%': { transform: 'translateX(-14px)', opacity: 0.23 },
        '28%': { transform: 'translateX(0)', opacity: 0.0 },
        '54%': { transform: 'translateX(18px)', opacity: 0.52 },
        '57%': { transform: 'translateX(-14px)', opacity: 0.3 },
        '68%': { transform: 'translateX(-14px)', opacity: 0 }
    },
    '@keyframes arcRotate': {
        to: { transform: 'rotate(360deg)' }
    },
    '@keyframes scanDrift': {
        to: { transform: 'translateY(18px)' }
    },
    '@keyframes noiseFlicker': {
        '0%, 100%': { opacity: 0.08 },
        '50%': { opacity: 0.16 }
    }
};

const contentSx = {
    position: 'relative',
    zIndex: 1,
    width: 'min(720px, 92vw)',
    px: 2
};

const logoStageSx = {
    position: 'relative',
    width: 'min(420px, 62vw)',
    aspectRatio: '1 / 1',
    display: 'grid',
    placeItems: 'center'
};

const logoSx = {
    position: 'relative',
    zIndex: 3,
    width: '100%',
    height: '100%',
    objectFit: 'contain',
    filter: 'drop-shadow(0 22px 50px rgba(0,0,0,0.62))'
};

const fireGlowSx = {
    position: 'absolute',
    zIndex: 2,
    left: '51%',
    top: '49%',
    width: '37%',
    height: '28%',
    borderRadius: '999px',
    transform: 'translate(-50%, -50%)',
    background:
        'radial-gradient(circle, rgba(255, 245, 159, 0.95) 0%, rgba(255, 143, 23, 0.72) 34%, rgba(255, 66, 0, 0.2) 62%, transparent 74%)',
    mixBlendMode: 'screen',
    animation: 'firePulse 1850ms ease-in-out infinite'
};

const blueGlitchSx = {
    position: 'absolute',
    zIndex: 4,
    left: '17%',
    top: '32%',
    width: '31%',
    height: '47%',
    pointerEvents: 'none',
    background:
        'repeating-linear-gradient(180deg, transparent 0 2px, rgba(0, 224, 255, 0.38) 2px 3px, transparent 3px 5px), repeating-linear-gradient(90deg, transparent 0 11px, rgba(255, 255, 255, 0.14) 11px 12px, transparent 12px 18px)',
    clipPath: 'polygon(10% 8%, 58% 0, 82% 30%, 72% 96%, 6% 88%)',
    mixBlendMode: 'screen',
    opacity: 0.72,
    animation: 'glitchShift 1800ms steps(2, end) infinite'
};

const hexArcSx = {
    position: 'absolute',
    zIndex: 1,
    width: '86%',
    height: '86%',
    borderRadius: '28%',
    background:
        'conic-gradient(from 20deg, rgba(0, 214, 255, 0.0), rgba(0, 214, 255, 0.44), rgba(255, 146, 28, 0.0), rgba(255, 146, 28, 0.48), rgba(0, 214, 255, 0.0))',
    filter: 'blur(10px)',
    opacity: 0.58,
    animation: 'arcRotate 6200ms linear infinite'
};

const scanlineSx = {
    position: 'absolute',
    inset: 0,
    pointerEvents: 'none',
    background:
        'repeating-linear-gradient(180deg, rgba(255,255,255,0.03) 0 1px, transparent 1px 5px)',
    opacity: 0.28,
    animation: 'scanDrift 900ms linear infinite'
};

const noiseSx = {
    position: 'absolute',
    inset: 0,
    pointerEvents: 'none',
    background:
        'repeating-radial-gradient(circle at 20% 30%, rgba(255,255,255,0.08) 0 1px, transparent 1px 6px)',
    mixBlendMode: 'overlay',
    animation: 'noiseFlicker 1600ms steps(2, end) infinite'
};

const titleSx = {
    fontWeight: 900,
    letterSpacing: 0,
    color: 'var(--text-color)',
    textShadow: '0 0 28px rgba(255, 137, 27, 0.26)'
};

const messageSx = {
    mt: 0.75,
    color: 'var(--text-color-light)',
    fontSize: 14,
    fontWeight: 700
};

const progressSx = {
    height: 7,
    borderRadius: 1,
    backgroundColor: 'color-mix(in srgb, var(--border-color) 62%, transparent)',
    '& .MuiLinearProgress-bar': {
        borderRadius: 1,
        background:
            'linear-gradient(90deg, rgba(0, 218, 255, 0.95), rgba(255, 143, 26, 0.95))'
    }
};

const progressTextSx = {
    mt: 0.75,
    color: 'var(--text-color-secondary)',
    fontSize: 12,
    fontWeight: 800
};

const closeButtonSx = {
    position: 'absolute',
    zIndex: 2,
    top: 18,
    right: 18,
    minWidth: 0,
    width: 38,
    height: 38,
    borderRadius: 1,
    color: 'var(--text-color)',
    border: '1px solid var(--border-color)',
    background: 'color-mix(in srgb, var(--sidebar-bg-color) 82%, transparent)',
    '&:hover': {
        background: 'color-mix(in srgb, var(--primary-color) 18%, var(--sidebar-bg-color))'
    }
};
