// Збірка веб-клієнта: web/src/main.ts → dist/web/main.js (esbuild) + копія web/public/*.
//   node scripts/build-web.ts          → одноразова збірка (мінімізована)
//   node scripts/build-web.ts --watch  → перезбірка при змінах (для розробки)
import { cp, mkdir, rm } from "node:fs/promises";
import { watch } from "node:fs";
import * as esbuild from "esbuild";

const watchMode = process.argv.includes("--watch");
const outdir = "dist/web";

async function copyPublic(): Promise<void> {
  await cp("web/public", outdir, { recursive: true });
}

await rm(outdir, { recursive: true, force: true });
await mkdir(outdir, { recursive: true });
await copyPublic();

const options: esbuild.BuildOptions = {
  entryPoints: ["web/src/main.ts"],
  outfile: `${outdir}/main.js`,
  bundle: true,
  format: "esm",
  target: ["es2022", "safari15"],
  sourcemap: true,
  minify: !watchMode,
  logLevel: "info",
};

if (watchMode) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
  watch("web/public", { recursive: true }, () => {
    copyPublic().then(
      () => console.log("[web] public/ скопійовано"),
      (err: unknown) => console.error("[web] помилка копіювання", err),
    );
  });
  console.log("[web] стежу за змінами в web/ …");
} else {
  await esbuild.build(options);
}
