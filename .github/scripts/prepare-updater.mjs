import fs from "node:fs";

const configPath = "src-tauri/tauri.conf.json";
const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
const githubRef = process.env.GITHUB_REF ?? "";
const isReleaseTag = githubRef.startsWith("refs/tags/v");
const privateKey = (process.env.TAURI_SIGNING_PRIVATE_KEY ?? "").trim();
const updaterEnabled = isReleaseTag && privateKey.length > 0;

config.bundle ??= {};
config.bundle.createUpdaterArtifacts = updaterEnabled;

fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");

if (updaterEnabled) {
  console.log("Signed updater artifacts enabled for release tag.");
} else if (isReleaseTag) {
  console.warn(
    "::warning::TAURI_SIGNING_PRIVATE_KEY is not configured. " +
      "Installers will still be built and published, but no updater manifest will be generated."
  );
} else {
  console.log(
    "Updater artifacts disabled for PR/main build; platform installers remain enabled."
  );
}
