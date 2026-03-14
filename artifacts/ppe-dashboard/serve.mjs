import { spawn } from 'child_process';

const port = process.env.PORT || '4200';
const basePath = process.env.BASE_PATH || '/';

const args = [
  'serve',
  '--host', '0.0.0.0',
  '--port', port,
  '--base-href', basePath,
  '--disable-host-check',
  '--configuration', 'development'
];

const child = spawn('npx', ['ng', ...args], {
  stdio: 'inherit',
  env: process.env,
  cwd: import.meta.dirname
});

child.on('exit', (code) => process.exit(code || 0));
