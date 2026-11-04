// Assembles store-ready builds from the Vite output:
//   dist-extension/chrome   + baa-ook-club-chrome.zip    (Chrome Web Store)
//   dist-extension/firefox  + baa-ook-club-firefox.zip   (addons.mozilla.org, desktop and Android)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import AdmZip from "adm-zip";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const out = path.join(root, "dist-extension");
const pages = path.join(out, "pages");
const base = JSON.parse(fs.readFileSync(path.join(here, "manifest.json"), "utf8"));
const pkgVersion = base.version;

const manifests = {
  chrome: base,
  firefox: {
    ...base,
    browser_specific_settings: {
      gecko: {
        id: "baa-ook-club@shriy-singh.github.io",
        strict_min_version: "140.0",
        // Books and questions are sent to Google Gemini to be answered (review this before submitting).
        data_collection_permissions: { required: ["personalCommunications"] },
      },
      gecko_android: { strict_min_version: "142.0" },
    },
  },
};

for (const [browser, manifest] of Object.entries(manifests)) {
  const dir = path.join(out, browser);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.cpSync(pages, dir, { recursive: true });
  fs.cpSync(path.join(root, "public", "characters"), path.join(dir, "characters"), { recursive: true });
  // The official Rive runtime, straight from the npm package (unmodified).
  fs.copyFileSync(path.join(root, "node_modules", "@rive-app", "canvas", "rive.wasm"), path.join(dir, "rive.wasm"));
  fs.cpSync(path.join(here, "icons"), path.join(dir, "icons"), { recursive: true });
  fs.writeFileSync(path.join(dir, "manifest.json"), JSON.stringify(manifest, null, 2));

  const zip = new AdmZip();
  zip.addLocalFolder(dir);
  const zipPath = path.join(out, `baa-ook-club-${browser}-${pkgVersion}.zip`);
  zip.writeZip(zipPath);
  console.log(`${browser}: ${path.relative(root, dir)}  ->  ${path.relative(root, zipPath)} (${(fs.statSync(zipPath).size / 1e6).toFixed(1)} MB)`);
}
