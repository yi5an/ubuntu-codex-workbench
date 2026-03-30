const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { ProjectStore } = require("../src/main/services/project-store");

function main() {
  const projectPath = process.argv[2];
  if (!projectPath) {
    console.error("Usage: node scripts/seed-project.js <project-path>");
    process.exit(1);
  }

  const userDataDir = path.join(os.homedir(), ".config", "ubuntu-codex-workbench");
  const dataFile = path.join(userDataDir, "workbench-data.json");
  fs.mkdirSync(userDataDir, { recursive: true });

  const store = new ProjectStore(dataFile);
  const project = store.addProject(projectPath);
  const current = store.requireProject(project.id);
  if (!current.favorite) {
    store.toggleFavorite(project.id);
  }
  store.markOpened(project.id);

  console.log(dataFile);
  console.log(project.id);
  console.log(project.name);
}

main();
