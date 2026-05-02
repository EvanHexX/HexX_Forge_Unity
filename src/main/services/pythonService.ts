// src/main/services/pythonService.ts

import { spawn } from 'child_process';

export function runPython(script: string, args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
        const process = spawn('python', [script, ...args]);

        let stdout = '';
        let stderr = '';

        process.stdout.on('data', (data) => {
            stdout += data.toString();
        });

        process.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        process.on('close', (code) => {
            if (code === 0) {
                resolve(stdout);
            } else {
                reject(stderr || stdout);
            }
        });
    });
}