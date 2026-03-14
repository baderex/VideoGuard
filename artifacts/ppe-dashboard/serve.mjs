import { spawn } from 'child_process';

const port = process.env.PORT || '4200';

const args = [
  'serve',
  '--host', '0.0.0.0',
  '--port', port,
  '--configuration', 'development'
];

const child = spawn('npx', ['ng', ...args], {
  stdio: 'inherit',
  env: { ...process.env, NG_CLI_ANALYTICS: 'false' },
  cwd: import.meta.dirname
});

child.on('exit', (code) => process.exit(code || 0));
