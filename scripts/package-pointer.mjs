import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const site = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const editor = resolve(site, process.argv[2] ?? "../Dadealbit");
const { build } = createRequire(resolve(editor, "package.json"))("esbuild");

await build({
  stdin: {
    contents: `
      import { applySettings, loadMouseEffectSettings } from "./mouseEffect";

      export function apply(motionEnabled) {
        const settings = loadMouseEffectSettings();
        applySettings({
          ...settings,
          cursor: true,
          mode: motionEnabled ? "clickTrail" : "off",
        });
      }
    `,
    resolveDir: resolve(editor, "src/editor/effects"),
    sourcefile: "website-pointer.js",
  },
  bundle: true,
  minify: true,
  globalName: "websitePointer",
  format: "iife",
  target: "es2020",
  loader: { ".png": "dataurl" },
  outfile: resolve(site, "assets/pointer.js"),
});
