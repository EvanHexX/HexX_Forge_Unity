import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { Box, type SxProps, type Theme } from '@mui/material';

type Props = {
    text: string;
    disabled?: boolean;
    speed?: number;
    delay?: number;
    color?: string;
    shineColor?: string;
    spread?: number;
    direction?: 'left' | 'right';
    yoyo?: boolean;
    pauseOnHover?: boolean;
    className?: string;
    sx?: SxProps<Theme>;
};

export default function ShinyText({
    text,
    disabled = false,
    speed = 2,
    delay = 0,
    color = 'var(--text-color-light)',
    shineColor = 'var(--text-color)',
    spread = 120,
    direction = 'left',
    yoyo = false,
    pauseOnHover = false,
    className = '',
    sx
}: Props) {
    const [isPaused, setIsPaused] = useState(false);
    const textRef = useRef<HTMLSpanElement | null>(null);
    const elapsedRef = useRef(0);
    const lastTimeRef = useRef<number | null>(null);
    const directionRef = useRef(direction === 'left' ? 1 : -1);

    const animationDuration = Math.max(speed, 0.1) * 1000;
    const delayDuration = Math.max(delay, 0) * 1000;

    useEffect(() => {
        directionRef.current = direction === 'left' ? 1 : -1;
        elapsedRef.current = 0;
        lastTimeRef.current = null;
        if (textRef.current) {
            textRef.current.style.backgroundPosition = direction === 'left' ? '150% center' : '-50% center';
        }
    }, [direction]);

    useEffect(() => {
        let frameId = 0;

        const update = (time: number) => {
            frameId = window.requestAnimationFrame(update);

            if (disabled || isPaused) {
                lastTimeRef.current = null;
                return;
            }

            if (lastTimeRef.current === null) {
                lastTimeRef.current = time;
                return;
            }

            const deltaTime = time - lastTimeRef.current;
            lastTimeRef.current = time;
            elapsedRef.current += deltaTime;

            const cycleDuration = animationDuration + delayDuration;
            const fullCycle = cycleDuration * 2;
            const cycleTime = elapsedRef.current % (yoyo ? fullCycle : cycleDuration);
            let progress = directionRef.current === 1 ? 100 : 0;

            if (yoyo) {
                if (cycleTime < animationDuration) {
                    const p = (cycleTime / animationDuration) * 100;
                    progress = directionRef.current === 1 ? p : 100 - p;
                } else if (cycleTime < cycleDuration) {
                    progress = directionRef.current === 1 ? 100 : 0;
                } else if (cycleTime < cycleDuration + animationDuration) {
                    const reverseTime = cycleTime - cycleDuration;
                    const p = 100 - (reverseTime / animationDuration) * 100;
                    progress = directionRef.current === 1 ? p : 100 - p;
                } else {
                    progress = directionRef.current === 1 ? 0 : 100;
                }
            } else if (cycleTime < animationDuration) {
                const p = (cycleTime / animationDuration) * 100;
                progress = directionRef.current === 1 ? p : 100 - p;
            }

            if (textRef.current) {
                textRef.current.style.backgroundPosition = `${150 - progress * 2}% center`;
            }
        };

        frameId = window.requestAnimationFrame(update);
        return () => window.cancelAnimationFrame(frameId);
    }, [animationDuration, delayDuration, disabled, isPaused, yoyo]);

    const handleMouseEnter = useCallback(() => {
        if (pauseOnHover) setIsPaused(true);
    }, [pauseOnHover]);

    const handleMouseLeave = useCallback(() => {
        if (pauseOnHover) setIsPaused(false);
    }, [pauseOnHover]);

    const gradientStyle = {
        backgroundImage: `linear-gradient(${spread}deg, ${color} 0%, ${color} 35%, ${shineColor} 50%, ${color} 65%, ${color} 100%)`,
        backgroundSize: '200% auto',
        backgroundPosition: direction === 'left' ? '150% center' : '-50% center',
        WebkitBackgroundClip: 'text',
        backgroundClip: 'text',
        WebkitTextFillColor: 'transparent'
    } as CSSProperties;

    return (
        <Box
            ref={textRef}
            component="span"
            className={`shiny-text${disabled ? ' shiny-text--disabled' : ''}${className ? ` ${className}` : ''}`}
            sx={sx}
            style={gradientStyle}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            {text}
        </Box>
    );
}
