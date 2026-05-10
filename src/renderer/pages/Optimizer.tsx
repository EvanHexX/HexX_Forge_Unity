import { useState } from 'react';
import { Box, Button, Stack, Typography } from '@mui/material';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import SplashScreen from '../components/SplashScreen';

export default function Optimizer() {
    const [previewOpen, setPreviewOpen] = useState(false);

    return (
        <Box sx={{ color: 'var(--text-color)', maxWidth: 760 }}>
            <Stack direction="row" spacing={2} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                    <Typography variant="h5" sx={{ fontWeight: 800, color: 'var(--text-color)' }}>
                        비급 최적화 도구
                    </Typography>
                    <Typography sx={{ mt: 1, color: 'var(--text-color-light)' }}>
                        Optimizer 실행 연결은 아직 준비 중입니다.
                    </Typography>
                </Box>
            </Stack>

            <Box sx={sectionSx}>
                <Typography sx={{ color: 'var(--text-color-light)', fontSize: 13 }}>
                    Splash screen 임시 테스트 영역입니다. 앱 시작 로딩과 업데이트 진행 화면에 쓰일 오버레이를 여기서 미리 볼 수 있습니다.
                </Typography>
                <Button
                    variant="contained"
                    startIcon={<AutoFixHighIcon />}
                    onClick={() => setPreviewOpen(true)}
                    sx={{ mt: 2, background: 'var(--button-bg-color)', color: 'var(--button-text-color)' }}
                >
                    Splash Preview
                </Button>
            </Box>

            <SplashScreen
                open={previewOpen}
                mode="preview"
                message="불꽃 glow와 블루 큐브 scanline/glitch 테스트"
                onClose={() => setPreviewOpen(false)}
            />
        </Box>
    );
}

const sectionSx = {
    mt: 4,
    p: 2.5,
    border: '1px solid var(--border-color)',
    borderRadius: 2,
    background: 'color-mix(in srgb, var(--sidebar-bg-color) 70%, transparent)'
};
