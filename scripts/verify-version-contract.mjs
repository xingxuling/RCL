import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function readJson(relativePath) {
  return JSON.parse(await readFile(path.join(root, relativePath), "utf8"));
}

const errors = [];
const packageJson = await readJson("package.json");
const contractJson = await readJson("VERSION-CONTRACT.json");
const readme = await readFile(path.join(root, "README.md"), "utf8");

if (packageJson.name !== contractJson.package) {
  errors.push(`package name ${packageJson.name} does not match VERSION-CONTRACT.json`);
}
if (packageJson.version !== contractJson.packageVersion) {
  errors.push(`package version ${packageJson.version} does not match VERSION-CONTRACT.json`);
}
if (contractJson.repository !== "xingxuling/RCL" || contractJson.canonicalBranch !== "main" || contractJson.canonical !== true) {
  errors.push("RCL is not declared as the canonical main-branch source");
}
if (!readme.includes("# RCL v0.94.0-alpha.1") || !readme.includes("Canonical source: `xingxuling/RCL@main`")) {
  errors.push("README does not expose the current version and canonical-source declaration");
}
for (const command of contractJson.verificationCommands ?? []) {
  if (command === "npm run verify:version-contract") continue;
  if (command.startsWith("npm run ")) {
    const scriptName = command.slice("npm run ".length);
    if (!packageJson.scripts?.[scriptName]) errors.push(`missing npm script: ${scriptName}`);
  }
}
const ceiling = contractJson.verifiedCeiling ?? {};
if (ceiling.stage !== "stage40_rcl_owned_dual_need_warrant_lowering_subset") {
  errors.push("verified ceiling is not the explicit Stage40 dual-need subset");
}
if (ceiling.targetSourceRoot !== "71e899db3794f862101f898dbf0549a534db488f4320f30d07585d523a25ce14") {
  errors.push("Stage40 target source root does not match the verified fixture");
}
if (ceiling.targetRbcSha256 !== "4dbfe7408fb24484065b06e7b2d5b421cd2f6773bef28e29cfacd393c724e318") {
  errors.push("Stage40 target RBC hash does not match the verified fixture");
}
if (ceiling.staticInstructions !== 407 || ceiling.executedInstructions !== 367 || ceiling.checkWarrantOperations !== 20) {
  errors.push("Stage40 instruction metrics do not match the verified fixture");
}
await access(path.join(root, "package-lock.json")).catch(() => errors.push("package-lock.json is missing"));
await access(path.join(root, "native", "Makefile")).catch(() => errors.push("native/Makefile is missing"));
await access(path.join(root, "native", "native-windows-manifest.json")).catch(() => errors.push("native/native-windows-manifest.json is missing"));
await access(path.join(root, "selfhost", "rcl-dual-need-stage40.rcl")).catch(() => errors.push("Stage40 fixture is missing"));
await access(path.join(root, "tests", "stage40-dual-need.test.mjs")).catch(() => errors.push("Stage40 test is missing"));
await access(path.join(root, "selfhost")).catch(() => errors.push("selfhost directory is missing"));

const report = {
  ok: errors.length === 0,
  repository: contractJson.repository,
  canonicalBranch: contractJson.canonicalBranch,
  packageVersion: packageJson.version,
  verifiedCeiling: contractJson.verifiedCeiling,
  windowsExecutionVerified: contractJson.boundary?.windowsExecutionVerified ?? false,
  errors
};
console.log(JSON.stringify(report, null, 2));
if (errors.length > 0) process.exitCode = 1;
