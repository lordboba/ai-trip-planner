import { spawn } from "node:child_process";
import fs from "node:fs";
import readline from "node:readline";
import path from "node:path";
import { fileURLToPath } from "node:url";

const pnpmCommand = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const rootDir = path.dirname(fileURLToPath(import.meta.url));
const workspaceDir = path.dirname(rootDir);

for (const envFileName of [".env", ".env.local"]) {
  const envFilePath = path.join(workspaceDir, envFileName);

  if (fs.existsSync(envFilePath)) {
    process.loadEnvFile?.(envFilePath);
  }
}

const processes = [
  {
    name: "frontend",
    color: "\x1b[36m",
    command: pnpmCommand,
    args: ["--filter", "@ai-trip-planner/web", "frontend:dev"],
  },
  {
    name: "backend",
    color: "\x1b[33m",
    command: pnpmCommand,
    args: ["--filter", "@ai-trip-planner/web", "backend:dev"],
  },
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
    cwd: workspaceDir,
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
