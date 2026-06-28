import { spawnSync, spawn } from "node:child_process";

const env = {
  ...process.env,
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: process.env.PORT || "5000",
};

const build = spawnSync(process.execPath, ["./build.mjs"], {
  cwd: import.meta.dirname,
  env,
  stdio: "inherit",
});

if (build.status !== 0) {
  process.exit(build.status ?? 1);
}

const server = spawn(process.execPath, ["--enable-source-maps", "./dist/index.mjs"], {
  cwd: import.meta.dirname,
  env,
  stdio: "inherit",
});

const stop = (signal) => {
  if (!server.killed) server.kill(signal);
};

process.on("SIGINT", () => stop("SIGINT"));
process.on("SIGTERM", () => stop("SIGTERM"));

server.on("exit", (code, signal) => {
  if (signal) process.exit(0);
  process.exit(code ?? 0);
});
