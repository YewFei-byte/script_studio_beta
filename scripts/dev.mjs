// `npm run dev`: starts the API (server.js, watching for changes) and the
// Vite frontend together, so /api calls always have something to talk to.
// Ctrl+C stops both. `npm run dev:web` still runs Vite alone (used by
// docker-compose, which runs the API as its own service).

import { spawn } from 'node:child_process';

const children = [];

function run(name, command, args, color) {
  // One command string (shell needed for `npx` on Windows).
  const child = spawn([command, ...args].join(' '), { shell: true, env: process.env });
  const prefix = `\x1b[${color}m[${name}]\x1b[0m `;
  const pipe = (stream, out) =>
    stream.on('data', (chunk) => {
      for (const line of chunk.toString().split(/\r?\n/)) if (line.trim()) out.write(prefix + line + '\n');
    });
  pipe(child.stdout, process.stdout);
  pipe(child.stderr, process.stderr);
  child.on('exit', (code) => {
    process.stdout.write(`${prefix}exited (${code ?? 'signal'})\n`);
    stopAll(code ?? 0);
  });
  children.push(child);
}

let stopping = false;
function stopAll(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const c of children) if (c.exitCode === null) c.kill();
  setTimeout(() => process.exit(code), 300);
}

process.on('SIGINT', () => stopAll(0));
process.on('SIGTERM', () => stopAll(0));

run('api', 'node', ['--watch', 'server.js'], 36);
run('web', 'npx', ['vite', ...process.argv.slice(2)], 35);
