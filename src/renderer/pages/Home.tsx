// src/renderer/pages/Home.tsx
// HexX Forge 홈 화면입니다.

import {Box, Card, CardContent, Typography} from '@mui/material';

export default function Home() {
    return (
        <Box>
            <Typography variant="h4" sx={{fontWeight:800, color:"var(--text-color)"}}>
                HexX Forge
            </Typography>

            <Typography sx={{mt:1, color:"var(--text-color-light)"}}>
                용윤입지전 모드 · 폰트 · 어셋 패치 통합 관리 도구
            </Typography>

            <Box sx={{display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap:2, mt:4}}>
                {[
                    ['비급 최적화 도구', '기존 PySide6 exe 실행 연결 예정'],
                    ['모드 관리자', 'BepInEx plugins DLL 활성/비활성 관리'],
                    ['어셋 관리자', '백업, 폰트, 텍스처 교체 관리']
                ].map(([title, desc]) => (
                    <Card
                        key={title}
                        sx={{
                            background: 'var(--sidebar-bg-color)',
                            color: 'var(--text-color)',
                            border: '1px solid var(--border-color)',
                            boxShadow: 'var(--shadow-small)'
                        }}
                    >
                        <CardContent>
                            <Typography variant="h6" sx={{fontWeight:700}}>
                                {title}
                            </Typography>
                            <Typography sx={{mt:1, color:"var(--text-color-light)"}}>
                                {desc}
                            </Typography>
                        </CardContent>
                    </Card>
                ))}
            </Box>
        </Box>
    );
}