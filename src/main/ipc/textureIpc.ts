import { ipcMain } from 'electron';
import path from 'node:path';
import { runPython } from '../services/pythonService';

export function registerTextureIpc() {
    ipcMain.handle(
        'texture:patch',
        async (
            _,
            {
                assets,
                texture,
                png,
                out,
                pathId
            }: {
                assets: string;
                texture: string;
                png: string;
                out: string;
                pathId?: number;
            }
        ) => {
            const scriptPath = path.join(process.cwd(), 'tools', 'patch_texture_ress.py');

            const args = [
                '--assets',
                assets,
                '--texture',
                texture,
                '--png',
                png,
                '--out',
                out
            ];

            if (pathId !== undefined) {
                args.push('--path-id', String(pathId));
            }

            return await runPython(scriptPath, args);
        }
    );
}