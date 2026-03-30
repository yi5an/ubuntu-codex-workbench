const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { EventEmitter } = require("node:events");
const { ProjectStore } = require("../src/main/services/project-store");
const { TaskManager } = require("../src/main/services/task-manager");

class FakeChild extends EventEmitter {
  kill() {
    this.emit("close", null, "SIGTERM");
  }
}

test("TaskManager stores output and notifies only once", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "workbench-task-"));
  const dataFile = path.join(tempDir, "data.json");
  const projectDir = path.join(tempDir, "demo-project");
  fs.mkdirSync(projectDir);

  const store = new ProjectStore(dataFile);
  const project = store.addProject(projectDir);

  const notifications = [];
  const fakeRunner = {
    run({ onStdout, onClose }) {
      const child = new FakeChild();
      process.nextTick(() => {
        onStdout("hello\n");
        onClose(0, null);
        onClose(0, null);
      });
      return child;
    },
  };

  const notificationService = {
    notifyTaskFinished(task, projectName) {
      notifications.push({ task, projectName });
    },
  };

  const manager = new TaskManager(store, fakeRunner, notificationService);
  await manager.runTask(project, "say hello");

  await new Promise((resolve) => setTimeout(resolve, 20));

  const tasks = store.getTasks();
  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].status, "success");
  assert.match(tasks[0].output, /hello/);
  assert.equal(notifications.length, 1);
});

