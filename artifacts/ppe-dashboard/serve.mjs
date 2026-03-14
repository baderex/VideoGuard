import { spawn } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const projectDir = dirname(fileURLToPath(import.meta.url));
const port = process.env.PORT || '4200';
const basePath = process.env.BASE_PATH || '/';

const angularJsonPath = join(projectDir, 'angular.json');
const angularJson = JSON.parse(readFileSync(angularJsonPath, 'utf-8'));
angularJson.projects['ppe-dashboard'].architect.build.options.baseHref = basePath;
writeFileSync(angularJsonPath, JSON.stringify(angularJson, null, 2) + '\n');

const args = [
  'serve',
  '--host', '0.0.0.0',
  '--port', port,
  '--serve-path', basePath,
  '--configuration', 'development'
];

const child = spawn('npx', ['ng', ...args], {
  stdio: 'inherit',
  env: { ...process.env, NG_CLI_ANALYTICS: 'false' },
  cwd: projectDir
});

child.on('exit', (code) => process.exit(code || 0));
