const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

function toWindowsVersion(version) {
    const [core, prerelease = ''] = String(version).split('-');
    const parts = core.split('.').map((part) => Number.parseInt(part, 10));
    const prereleaseBuild = Number.parseInt(prerelease.split('.').at(-1) || '0', 10);
    const numbers = [
        parts[0] || 0,
        parts[1] || 0,
        parts[2] || 0,
        Number.isFinite(prereleaseBuild) ? prereleaseBuild : 0,
    ];

    return numbers.join('.');
}

exports.default = async function afterPack(context) {
    if (context.electronPlatformName !== 'win32') return;

    const productFilename = context.packager.appInfo.productFilename;
    const productName = context.packager.appInfo.productName;
    const version = context.packager.appInfo.version;
    const exePath = path.join(context.appOutDir, `${productFilename}.exe`);
    const iconPath = path.resolve(context.packager.projectDir, 'build', 'icon.ico');
    const rceditPath = path.resolve(context.packager.projectDir, 'node_modules', 'electron-winstaller', 'vendor', 'rcedit.exe');

    for (const requiredPath of [exePath, iconPath, rceditPath]) {
        if (!fs.existsSync(requiredPath)) {
            throw new Error(`afterPack icon edit dependency was not found: ${requiredPath}`);
        }
    }

    const windowsVersion = toWindowsVersion(version);

    execFileSync(rceditPath, [
        exePath,
        '--set-icon',
        iconPath,
        '--set-version-string',
        'FileDescription',
        productName,
        '--set-version-string',
        'ProductName',
        productName,
        '--set-version-string',
        'InternalName',
        productFilename,
        '--set-version-string',
        'OriginalFilename',
        `${productFilename}.exe`,
        '--set-file-version',
        windowsVersion,
        '--set-product-version',
        windowsVersion,
    ], {
        stdio: 'inherit',
        windowsHide: true,
    });
};
