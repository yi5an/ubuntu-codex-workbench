const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { ProjectStore } = require("../src/main/services/project-store");
const { TaskManager } = require("../src/main/services/task-manager");
const { CodexRunner } = require("../src/main/services/codex-runner");

async function main() {
  const projectPath = process.argv[2];
  const prompt = process.argv[3];

  if (!projectPath || !prompt) {
    console.error("Usage: node scripts/run-real-task.js <project-path> <prompt>");
    process.exit(1);
  }

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "workbench-real-task-"));
  const dataFile = path.join(tempDir, "data.json");
  const store = new ProjectStore(dataFile);
  const project = store.addProject(projectPath);

  const notifications = [];
  const notificationService = {
    notifyTaskFinished(task, projectName) {
      notifications.push({ task, projectName });
    },
  };

  const manager = new TaskManager(store, new CodexRunner(), notificationService);
  manager.on("updated", () => {
    const current = manager.getCurrentTask();
    if (current) {
      process.stdout.write(".");
    }
  });

  await manager.runTask(project, prompt);

  await new Promise((resolve) => {
    const timer = setInterval(() => {
      if (!manager.getCurrentTask()) {
        clearInterval(timer);
        resolve();
      }
    }, 500);
  });

  const task = store.getTasks(1)[0];
  console.log("\nstatus:", task.status);
  console.log("project:", task.projectName);
  console.log("command:", task.command);
  console.log("output:\n" + task.output.trim());
  console.log("notifications:", notifications.length);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
