const { spawn } = require("node:child_process");
const path = require("node:path");

const workdir = path.resolve(__dirname, "..");
const child = spawn("npx", ["electron", ".", "--no-sandbox"], {
  cwd: workdir,
  env: {
    ...process.env,
    ELECTRON_ENABLE_LOGGING: "1",
  },
});

let stdout = "";
let stderr = "";
let settled = false;

const timeout = setTimeout(() => {
  if (settled) {
    return;
  }

  settled = true;
  child.kill("SIGTERM");
  const combined = `${stdout}\n${stderr}`;
  if (/Error|ERR_|Exception|Failed/i.test(combined)) {
    console.error(combined.trim());
    process.exit(1);
  }

  console.log("Electron smoke start passed");
  process.exit(0);
}, 6000);

child.stdout.on("data", (chunk) => {
  stdout += chunk.toString();
});

child.stderr.on("data", (chunk) => {
  stderr += chunk.toString();
});

child.on("error", (error) => {
  if (settled) {
    return;
  }

  settled = true;
  clearTimeout(timeout);
  console.error(error.message);
  process.exit(1);
});

child.on("exit", (code) => {
  if (settled) {
    return;
  }

  settled = true;
  clearTimeout(timeout);
  if (code === 0) {
    console.log("Electron smoke start passed");
    return;
  }

  const combined = `${stdout}\n${stderr}`.trim();
  console.error(combined || `Electron exited with code ${code}`);
  process.exit(code || 1);
});
