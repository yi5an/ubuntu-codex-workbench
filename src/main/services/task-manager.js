const { randomUUID } = require("node:crypto");
const { EventEmitter } = require("node:events");

class TaskManager extends EventEmitter {
  constructor(projectStore, codexRunner, notificationService) {
    super();
    this.projectStore = projectStore;
    this.codexRunner = codexRunner;
    this.notificationService = notificationService;
    this.activeTask = null;
    this.activeChild = null;
    this.finishedTaskIds = new Set();
  }

  getCurrentTask() {
    return this.activeTask;
  }

  async runTask(project, prompt) {
    if (this.activeTask) {
      throw new Error("当前已有任务在运行，请先停止或等待完成");
    }

    const task = {
      id: randomUUID(),
      projectId: project.id,
      projectName: project.name,
      prompt,
      status: "running",
      command: `codex exec --color never --skip-git-repo-check -C ${JSON.stringify(project.path)} ${JSON.stringify(prompt)}`,
      startTime: new Date().toISOString(),
      endTime: null,
      output: "",
    };

    this.projectStore.appendTask(task);
    this.activeTask = task;
    this.emit("updated");

    this.activeChild = this.codexRunner.run({
      cwd: project.path,
      prompt,
      onStdout: (chunk) => this.appendOutput(task.id, chunk),
      onStderr: (chunk) => this.appendOutput(task.id, chunk),
      onClose: (code, signal) => this.finishTask(task.id, code === 0 && !signal ? "success" : "failed"),
      onError: (error) => {
        this.appendOutput(task.id, `\n[runner error] ${error.message}\n`);
        this.finishTask(task.id, "failed");
      },
    });

    return task;
  }

  stopTask() {
    if (!this.activeChild || !this.activeTask) {
      return false;
    }

    this.appendOutput(this.activeTask.id, "\n[system] 正在停止任务...\n");
    this.activeChild.kill("SIGTERM");
    return true;
  }

  appendOutput(taskId, chunk) {
    const updatedTask = this.projectStore.updateTask(taskId, {});
    if (!updatedTask) {
      return;
    }

    updatedTask.output += chunk;
    this.projectStore.save();

    if (this.activeTask && this.activeTask.id === taskId) {
      this.activeTask.output = updatedTask.output;
    }

    this.emit("updated");
  }

  finishTask(taskId, status) {
    if (this.finishedTaskIds.has(taskId)) {
      return;
    }

    this.finishedTaskIds.add(taskId);
    const finished = this.projectStore.updateTask(taskId, {
      status,
      endTime: new Date().toISOString(),
    });

    if (!finished) {
      return;
    }

    if (this.activeTask && this.activeTask.id === taskId) {
      this.activeTask = finished;
    }

    this.notificationService.notifyTaskFinished(finished, finished.projectName);
    this.activeTask = null;
    this.activeChild = null;
    this.emit("updated");
  }
}

module.exports = { TaskManager };
