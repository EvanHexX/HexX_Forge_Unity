import fs from 'node:fs';
import { getConfigPath } from './runtimePaths';
import { readJsonFile } from './configService';

const DEVELOPER_ACCESS_PATH = getConfigPath('developer_access.json');
const ENV_PASSWORD = 'HEXX_FORGE_DEVELOPER_PASSWORD';

type DeveloperAccessFile = {
    password: string;
    createdAt: string;
};

function readDeveloperAccessFile(): DeveloperAccessFile | null {
    return readJsonFile<DeveloperAccessFile | null>(DEVELOPER_ACCESS_PATH, null);
}

function getConfiguredPassword(): string {
    const envPassword = process.env[ENV_PASSWORD];
    if (envPassword) return envPassword;

    return readDeveloperAccessFile()?.password || '';
}

export function getDeveloperAccessStatus() {
    const configured = Boolean(getConfiguredPassword());

    return {
        configured,
        fileExists: fs.existsSync(DEVELOPER_ACCESS_PATH),
        configPath: DEVELOPER_ACCESS_PATH,
        envName: ENV_PASSWORD
    };
}

export function verifyDeveloperPassword(password: string) {
    const expected = getConfiguredPassword();

    if (!expected) {
        return {
            ok: false,
            configured: false,
            reason: 'not_configured',
            configPath: DEVELOPER_ACCESS_PATH,
            envName: ENV_PASSWORD
        };
    }

    const ok = typeof password === 'string' && password.length > 0 && password === expected;

    return {
        ok,
        configured: true,
        reason: ok ? 'ok' : 'invalid_password',
        configPath: DEVELOPER_ACCESS_PATH,
        envName: ENV_PASSWORD
    };
}
