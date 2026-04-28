import { spawn } from 'node:child_process';

const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const children = [
  spawn(npmCmd, ['--prefix', 'backend', 'run', 'dev'], {
    stdio: 'inherit',
    shell: true
  }),
  spawn(npmCmd, ['--prefix', 'frontend', 'run', 'dev'], {
    stdio: 'inherit',
    shell: true
  })
];

const shutdown = (code = 0) => {
  for (const child of children) {
    if (!child.killed) child.kill();
  }
  process.exit(code);
};

for (const child of children) {
  child.on('exit', (code, signal) => {
    if (code !== 0 || signal) {
      shutdown(typeof code === 'number' ? code : 1);
    }
  });
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
