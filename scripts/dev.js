import { spawn } from 'node:child_process';

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const children = ['Backend', 'Frontend'].map(workspace => spawn(
  npm,
  ['run', 'dev', '--workspace', workspace],
  { stdio: 'inherit', shell: process.platform === 'win32' }
));

let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill();
  process.exitCode = code;
}

for (const child of children) {
  child.on('error', error => {
    console.error(`Could not start a workspace: ${error.message}`);
    stop(1);
  });
  child.on('exit', code => {
    if (!stopping) stop(code ?? 1);
  });
}

process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());