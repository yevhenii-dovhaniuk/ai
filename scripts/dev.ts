// Режим розробки: паралельно запускає сервер (з автоперезапуском) і збірку веб-клієнта (watch).
// Ctrl+C зупиняє обидва процеси. Запускаємо node напряму (без npm і shell).
import { spawn, type ChildProcess } from "node:child_process";

const tasks: string[][] = [
  ["scripts/build-web.ts", "--watch"],
  ["--watch", "--env-file-if-exists=.env", "src/server/index.ts"],
];

const children: ChildProcess[] = tasks.map((args) => spawn(process.execPath, args, { stdio: "inherit" }));

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
