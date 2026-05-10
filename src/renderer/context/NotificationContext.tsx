import { createContext, useCallback, useContext, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Alert, Fade, Stack } from '@mui/material';

type Severity = 'success' | 'error' | 'warning' | 'info';

type NotificationOptions = {
    autoHideMs?: number;
    copyText?: string;
};

type Notification = {
    id: number;
    message: string;
    severity: Severity;
    copyText?: string;
};

type NotificationContextType = {
    showNotification: (message: string, severity?: Severity, options?: NotificationOptions) => void;
};

const NotificationContext = createContext<NotificationContextType>({
    showNotification: () => {},
});

export function NotificationProvider({ children }: { children: ReactNode }) {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const nextIdRef = useRef(0);

    const dismiss = useCallback((id: number) => {
        setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, []);

    const showNotification = useCallback(
        (message: string, severity: Severity = 'success', options: NotificationOptions = {}) => {
            const id = nextIdRef.current++;
            setNotifications((prev) => [...prev, { id, message, severity, copyText: options.copyText }]);

            const autoHideMs = options.autoHideMs ?? (severity === 'success' || severity === 'info' ? 4000 : undefined);
            if (autoHideMs) setTimeout(() => dismiss(id), autoHideMs);
        },
        [dismiss]
    );

    const handleNotificationClick = useCallback(
        (notification: Notification) => {
            dismiss(notification.id);

            if (!notification.copyText) return;

            const copyPromise = navigator.clipboard?.writeText(notification.copyText) ?? Promise.reject(new Error('Clipboard API is unavailable.'));

            copyPromise
                .then(() => showNotification('전체 로그를 클립보드에 복사했습니다.', 'info'))
                .catch(() => showNotification('클립보드 복사에 실패했습니다.', 'warning'));
        },
        [dismiss, showNotification]
    );

    return (
        <NotificationContext.Provider value={{ showNotification }}>
            {children}
            <Stack
                spacing={1}
                sx={{
                    position: 'fixed',
                    bottom: 24,
                    right: 24,
                    zIndex: 9999,
                    maxWidth: 380,
                    pointerEvents: 'none',
                }}
            >
                {notifications.map((n) => (
                    <Fade key={n.id} in>
                        <Alert
                            severity={n.severity}
                            onClick={() => handleNotificationClick(n)}
                            sx={{
                                cursor: 'pointer',
                                pointerEvents: 'all',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                                '& .MuiAlert-message': { wordBreak: 'break-word' },
                            }}
                        >
                            {n.message}
                        </Alert>
                    </Fade>
                ))}
            </Stack>
        </NotificationContext.Provider>
    );
}

export const useNotification = () => useContext(NotificationContext);
