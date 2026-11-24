// Режим розробки: паралельно запускає сервер (з автоперезапуском) і збірку веб-клієнта (watch).
// Ctrl+C зупиняє обидва процеси.
import { spawn, type ChildProcess } from "node:child_process";

const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const tasks = ["dev:web", "dev:server"];

const children: ChildProcess[] = tasks.map((task) =>
  spawn(npm, ["run", "--silent", task], { stdio: "inherit", shell: process.platform === "win32" }),
);

let stopping = false;
function stopAll(code = 0): void {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill();
  process.exit(code);
}

for (const child of children) child.on("exit", (code) => stopAll(code ?? 0));
process.on("SIGINT", () => stopAll(0));
process.on("SIGTERM", () => stopAll(0));
