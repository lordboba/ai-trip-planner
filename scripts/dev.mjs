import { spawn } from "node:child_process";
import readline from "node:readline";

const pnpmCommand = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

const processes = [
  { name: "frontend", color: "\x1b[36m", command: pnpmCommand, args: ["frontend:dev"] },
  { name: "backend", color: "\x1b[33m", command: pnpmCommand, args: ["backend:dev"] },
];

const children = [];
let isShuttingDown = false;

function prefixOutput(stream, label, color) {
  const rl = readline.createInterface({ input: stream });
  rl.on("line", (line) => {
    process.stdout.write(`${color}[${label}]\x1b[0m ${line}\n`);
  });
}

function shutdown(exitCode = 0) {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;

  for (const child of children) {
    if (!child.killed) {
      child.kill("SIGINT");
    }
  }

  setTimeout(() => process.exit(exitCode), 50);
}

for (const processConfig of processes) {
  const child = spawn(processConfig.command, processConfig.args, {
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
  });

  prefixOutput(child.stdout, processConfig.name, processConfig.color);
  prefixOutput(child.stderr, processConfig.name, processConfig.color);

  child.on("exit", (code) => {
    if (!isShuttingDown) {
      shutdown(code ?? 0);
    }
  });

  children.push(child);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
