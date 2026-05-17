import fs from 'node:fs';
import path from 'node:path';
import packageJson from '../package.json' with { type: 'json' };

const releaseDir = path.resolve('release');
const version = packageJson.version;

const artifactNames = [
    `HexX-Forge-${version}-win-x64.exe`,
    `HexX-Forge-${version}-win-x64.exe.blockmap`,
    `HexX-Forge-${version}-win-x64.__uninstaller.exe`,
    `hexx-forge-unity-${version}-x64.nsis.7z`,
    'latest.yml',
];

if (fs.existsSync(releaseDir)) {
    for (const artifactName of artifactNames) {
        const targetPath = path.join(releaseDir, artifactName);
        const resolvedTarget = path.resolve(targetPath);

        if (!resolvedTarget.startsWith(`${releaseDir}${path.sep}`)) {
            throw new Error(`Refusing to clean outside release directory: ${resolvedTarget}`);
        }

        if (fs.existsSync(resolvedTarget)) {
            fs.rmSync(resolvedTarget, { force: true });
            console.log(`Removed ${path.relative(process.cwd(), resolvedTarget)}`);
        }
    }
}
