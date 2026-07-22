import fs from "node:fs";

const configPath = "src-tauri/tauri.conf.json";
const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
const githubRef = process.env.GITHUB_REF ?? "";
const isReleaseTag = githubRef.startsWith("refs/tags/v");
const privateKey = (process.env.TAURI_SIGNING_PRIVATE_KEY ?? "").trim();

if (isReleaseTag && !privateKey) {
  console.error(
    "::error::Release tags require the TAURI_SIGNING_PRIVATE_KEY repository secret. " +
      "Add the Tauri updater private key that matches plugins.updater.pubkey before publishing a v* tag."
  );
  process.exit(1);
}

config.bundle ??= {};
config.bundle.createUpdaterArtifacts = isReleaseTag;

fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");

console.log(
  isReleaseTag
    ? "Signed updater artifacts enabled for release tag."
    : "Updater artifacts disabled for PR/main build; platform installers remain enabled."
);
