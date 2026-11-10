import { cp, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const root = new URL("../", import.meta.url).pathname;
const output = join(root, "out/pages");
const built = await Bun.build({
  entrypoints: [join(root, "site-pages/app.mjs")],
  target: "browser",
  minify: true,
  naming: "app.js",
  outdir: output,
});
if (!built.success) throw new Error(built.logs.map((log) => log.message).join("\n"));
await mkdir(join(output, "media"), { recursive: true });
for (const file of ["index.html", "styles.css"]) await cp(join(root, "site-pages", file), join(output, file));
for (const file of ["shipos-readme-banner.png", "social-preview.png", "repo-teaser.mp4", "repo-teaser.vtt", "repo-preview.gif"]) {
  await cp(join(root, "docs/media", file), join(output, "media", file));
}
await writeFile(join(output, ".nojekyll"), "");
console.log(`Built the Pages site in ${output}`);
