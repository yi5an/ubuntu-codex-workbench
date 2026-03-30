const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");

class ProjectStore {
  constructor(dataFile) {
    this.dataFile = dataFile;
    this.data = this.load();
  }

  load() {
    fs.mkdirSync(path.dirname(this.dataFile), { recursive: true });

    if (!fs.existsSync(this.dataFile)) {
      const initial = { projects: [], tasks: [], settings: this.defaultSettings() };
      fs.writeFileSync(this.dataFile, JSON.stringify(initial, null, 2));
      return initial;
    }

    try {
      const raw = fs.readFileSync(this.dataFile, "utf8");
      const parsed = JSON.parse(raw);
      return {
        projects: Array.isArray(parsed.projects) ? parsed.projects : [],
        tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
        settings: this.normalizeSettings(parsed.settings),
      };
    } catch {
      return { projects: [], tasks: [], settings: this.defaultSettings() };
    }
  }

  save() {
    fs.writeFileSync(this.dataFile, JSON.stringify(this.data, null, 2));
  }

  getProjects() {
    return [...this.data.projects].sort((a, b) => {
      if (Boolean(a.favorite) !== Boolean(b.favorite)) {
        return a.favorite ? -1 : 1;
      }

      const aTime = a.lastOpened ? new Date(a.lastOpened).getTime() : 0;
      const bTime = b.lastOpened ? new Date(b.lastOpened).getTime() : 0;
      if (aTime !== bTime) {
        return bTime - aTime;
      }

      return a.name.localeCompare(b.name);
    });
  }

  getSettings() {
    return {
      ...this.data.settings,
      codex: { ...this.data.settings.codex },
      proxy: { ...this.data.settings.proxy },
    };
  }

  updateSettings(patch = {}) {
    const nextSettings = {
      ...this.data.settings,
      ...patch,
      codex: {
        ...this.data.settings.codex,
        ...(patch.codex || {}),
      },
      proxy: {
        ...this.data.settings.proxy,
        ...(patch.proxy || {}),
      },
    };

    this.data.settings = this.normalizeSettings(nextSettings);
    this.save();
    return this.getSettings();
  }

  getTasks(limit = 20) {
    return [...this.data.tasks]
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
      .slice(0, limit);
  }

  addProject(projectPath) {
    const existing = this.data.projects.find((project) => project.path === projectPath);
    if (existing) {
      return existing;
    }

    const workspace = this.findWorkspace(projectPath);
    const project = {
      id: randomUUID(),
      name: path.basename(projectPath),
      path: projectPath,
      workspace,
      favorite: false,
      lastOpened: null,
    };

    this.data.projects.push(project);
    this.save();
    return project;
  }

  removeProject(projectId) {
    this.data.projects = this.data.projects.filter((project) => project.id !== projectId);
    this.data.tasks = this.data.tasks.filter((task) => task.projectId !== projectId);
    this.save();
  }

  toggleFavorite(projectId) {
    const project = this.requireProject(projectId);
    project.favorite = !project.favorite;
    this.save();
    return project;
  }

  markOpened(projectId) {
    const project = this.requireProject(projectId);
    project.lastOpened = new Date().toISOString();
    this.save();
    return project;
  }

  requireProject(projectId) {
    const project = this.data.projects.find((item) => item.id === projectId);
    if (!project) {
      throw new Error("项目不存在");
    }
    return project;
  }

  appendTask(task) {
    this.data.tasks.unshift(task);
    this.data.tasks = this.data.tasks.slice(0, 50);
    this.save();
  }

  updateTask(taskId, patch) {
    const task = this.data.tasks.find((item) => item.id === taskId);
    if (!task) {
      return null;
    }

    Object.assign(task, patch);
    this.save();
    return task;
  }

  findWorkspace(projectPath) {
    try {
      const entries = fs.readdirSync(projectPath, { withFileTypes: true });
      const workspace = entries.find(
        (entry) => entry.isFile() && entry.name.endsWith(".code-workspace")
      );
      return workspace ? path.join(projectPath, workspace.name) : null;
    } catch {
      return null;
    }
  }

  defaultSettings() {
    return {
      codex: {
        path: "",
      },
      proxy: {
        enabled: false,
        url: "",
      },
    };
  }

  normalizeSettings(settings) {
    const defaults = this.defaultSettings();
    return {
      ...defaults,
      ...(settings || {}),
      codex: {
        ...defaults.codex,
        ...((settings && settings.codex) || {}),
      },
      proxy: {
        ...defaults.proxy,
        ...((settings && settings.proxy) || {}),
      },
    };
  }
}

module.exports = { ProjectStore };
