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

test("TaskManager uses configured codex command path", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "workbench-task-"));
  const dataFile = path.join(tempDir, "data.json");
  const projectDir = path.join(tempDir, "demo-project");
  fs.mkdirSync(projectDir);

  const store = new ProjectStore(dataFile);
  const project = store.addProject(projectDir);
  const calls = [];
  const fakeRunner = {
    run(options) {
      calls.push(options);
      return new FakeChild();
    },
  };

  const manager = new TaskManager(
    store,
    fakeRunner,
    { notifyTaskFinished() {} },
    { getCodexCommand: () => "/home/demo/.nvm/bin/codex" }
  );

  await manager.runTask(project, "test path");

  assert.equal(calls.length, 1);
  assert.equal(calls[0].command, "/home/demo/.nvm/bin/codex");
  assert.match(store.getTasks()[0].command, /\/home\/demo\/\.nvm\/bin\/codex/);
});
