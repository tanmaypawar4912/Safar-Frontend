/** Check the required Node runtime, key project files, and relative frontend imports. */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(scriptDir, "..");
const version = process.versions.node.split(".").map(Number);
const required = [22, 22, 0];
const versionOkay = version[0] > required[0] ||
  (version[0] === required[0] && (version[1] > required[1] ||
    (version[1] === required[1] && version[2] >= required[2])));

if (!versionOkay) {
  console.warn(`WARN  Node.js ${process.versions.node}; React Router in the lockfile declares >=22.22.0. The build may still run, but use a compatible Node release if installation/build issues occur.`);
} else {
  console.log(`PASS  Node.js ${process.versions.node} meets the project's React Router engine requirement.`);
}

const requiredFiles = [
  "src/App.tsx",
  "src/index.css",
  "src/pages/public/Home.tsx",
  "src/pages/public/PublicBooking.tsx",
  "src/pages/public/Business.tsx",
  "src/pages/customer/BookingDetails.tsx",
  "src/pages/driver/DriverJobs.tsx",
  "src/pages/admin/AdminBookings.tsx",
  "src/pages/admin/AdminEnterpriseEnquiries.tsx",
  "package-lock.json",
];
let missing = 0;
for (const relativePath of requiredFiles) {
  if (fs.existsSync(path.join(frontendRoot, relativePath))) {
    console.log(`PASS  ${relativePath}`);
  } else {
    missing += 1;
    console.error(`FAIL  Missing required file: ${relativePath}`);
  }
}
if (missing) process.exit(1);

const importCheck = spawnSync(process.execPath, [path.join(scriptDir, "phase6-check-imports.mjs")], { encoding: "utf8" });
if (importCheck.stdout) process.stdout.write(importCheck.stdout);
if (importCheck.stderr) process.stderr.write(importCheck.stderr);
if (importCheck.status !== 0) process.exit(importCheck.status || 1);

console.log("\nPreflight passed. Run `npm run build` next; preflight does not replace TypeScript/build or browser integration tests.");
