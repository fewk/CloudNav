import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const packageJsonPath = path.join(rootDir, 'package.json');
const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

const type = process.argv[2] || 'patch';
const currentVersion = pkg.version || '2.0.0';
const parts = currentVersion.split('.').map(Number);

let newVersion = '';

if (type === 'major') {
  newVersion = `${parts[0] + 1}.0.0`;
} else if (type === 'minor') {
  newVersion = `${parts[0]}.${parts[1] + 1}.0`;
} else if (type === 'patch') {
  newVersion = `${parts[0]}.${parts[1]}.${(parts[2] || 0) + 1}`;
} else if (/^\d+\.\d+\.\d+$/.test(type)) {
  newVersion = type;
} else {
  console.error(`未知版本升级类型: ${type}。请使用 patch, minor, major 或明确的版本号如 2.1.0`);
  process.exit(1);
}

pkg.version = newVersion;
fs.writeFileSync(packageJsonPath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');

console.log(`✅ 版本升级成功: v${currentVersion} -> v${newVersion}`);
