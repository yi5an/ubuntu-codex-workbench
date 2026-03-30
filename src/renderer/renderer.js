const state = {
  projects: [],
  selectedProjectId: null,
  searchQuery: "",
  environment: null,
  settings: null,
  projectViews: {},
  projectAlerts: {},
  renderedSessionId: null,
};

const refs = {
  appShell: document.querySelector(".app-shell"),
  addProjectBtn: document.querySelector("#add-project-btn"),
  settingsBtn: document.querySelector("#settings-btn"),
  settingsModal: document.querySelector("#settings-modal"),
  settingsCloseBtn: document.querySelector("#settings-close-btn"),
  settingsCancelBtn: document.querySelector("#settings-cancel-btn"),
  settingsSaveBtn: document.querySelector("#settings-save-btn"),
  settingsCodexSummary: document.querySelector("#settings-codex-summary"),
  settingsCodexSelectWrap: document.querySelector("#settings-codex-select-wrap"),
  settingsCodexSelect: document.querySelector("#settings-codex-select"),
  settingsCodexHelp: document.querySelector("#settings-codex-help"),
  sidebarResizer: document.querySelector("#sidebar-resizer"),
  projectSearchInput: document.querySelector("#project-search-input"),
  projectList: document.querySelector("#project-list"),
  environmentBanner: document.querySelector("#environment-banner"),
  terminalHost: document.querySelector("#terminal-host"),
  terminalView: document.querySelector("#terminal-view"),
};

let draftCodexPath = "";

const terminal = new window.Terminal({
  cursorBlink: true,
  fontFamily: '"JetBrains Mono", "Fira Code", monospace',
  fontSize: 13,
  lineHeight: 1.45,
  theme: {
    background: "#040916",
    foreground: "#e8f1ff",
    cursor: "#51c4a8",
    selectionBackground: "rgba(81, 196, 168, 0.25)",
  },
});
const fitAddon = new window.FitAddon.FitAddon();
terminal.loadAddon(fitAddon);
terminal.open(refs.terminalHost);
const DEFAULT_TERMINAL_SIZE = { cols: 120, rows: 32 };
terminal.resize(DEFAULT_TERMINAL_SIZE.cols, DEFAULT_TERMINAL_SIZE.rows);
console.log(`terminal:init ${JSON.stringify({
  hostWidth: refs.terminalHost.clientWidth,
  hostHeight: refs.terminalHost.clientHeight,
  ...DEFAULT_TERMINAL_SIZE,
})}`);

let lastGoodTerminalSize = { ...DEFAULT_TERMINAL_SIZE };

async function copyTerminalSelection() {
  const selection = terminal.getSelection();
  if (!selection) {
    return false;
  }

  try {
    await navigator.clipboard.writeText(selection);
    return true;
  } catch (error) {
    console.warn("clipboard:copy-failed", error);
    return false;
  }
}

async function pasteIntoTerminal() {
  try {
    const text = await navigator.clipboard.readText();
    if (!text) {
      return false;
    }

    const view = currentProjectView();
    if (!view?.terminalLoaded || !view.terminalConnected) {
      return false;
    }

    terminal.paste(text.replaceAll("\r\n", "\n"));
    return true;
  } catch (error) {
    console.warn("clipboard:paste-failed", error);
    return false;
  }
}

terminal.attachCustomKeyEventHandler((event) => {
  const modifier = event.ctrlKey || event.metaKey;
  const key = event.key.toLowerCase();

  if (event.type === "keydown" && modifier && event.shiftKey && key === "c") {
    void copyTerminalSelection();
    return false;
  }

  return true;
});

refs.terminalHost.addEventListener("auxclick", (event) => {
  if (event.button !== 1) {
    return;
  }

  event.preventDefault();
  void pasteIntoTerminal();
});

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function selectedProject() {
  return state.projects.find((project) => project.id === state.selectedProjectId) || null;
}

function ensureProjectView(projectId) {
  if (!state.projectViews[projectId]) {
    state.projectViews[projectId] = {
      terminalSessionId: `project-${projectId}`,
      terminalConnected: false,
      terminalLoaded: false,
      terminalBuffer: "",
    };
  }

  return state.projectViews[projectId];
}

function clearProjectAlert(projectId) {
  if (!projectId) {
    return;
  }
  state.projectAlerts[projectId] = false;
}

function currentProjectView() {
  const project = selectedProject();
  return project ? ensureProjectView(project.id) : null;
}

function syncSelection() {
  if (state.selectedProjectId && state.projects.some((project) => project.id === state.selectedProjectId)) {
    return;
  }

  state.selectedProjectId = state.projects[0]?.id || null;
}

function renderEnvironment() {
  if (!state.environment) {
    refs.environmentBanner.textContent = "正在检查本地命令环境...";
    refs.environmentBanner.classList.remove("hidden", "ok", "warn");
    return;
  }

  const missing = [];
  if (!state.environment.codex?.installed) {
    if (state.environment.codex?.needsSelection) {
      missing.push("检测到多个 Codex，请先选择要使用的版本");
    } else if (state.environment.codex?.configuredPathMissing) {
      missing.push("已配置的 Codex 路径不可用");
    } else {
      missing.push("未检测到 codex");
    }
  }
  if (!state.environment.code?.installed) {
    missing.push("未检测到 code");
  }

  if (missing.length === 0) {
    refs.environmentBanner.textContent = "";
    refs.environmentBanner.className = "environment-banner hidden";
    return;
  }

  refs.environmentBanner.textContent = missing.join(" | ");
  refs.environmentBanner.className = "environment-banner warn";
}

function renderSettingsModal() {
  const codex = state.environment?.codex;
  if (!codex) {
    refs.settingsCodexSummary.textContent = "正在检查...";
    refs.settingsCodexSelectWrap.classList.add("hidden");
    refs.settingsCodexHelp.textContent = "";
    return;
  }

  const currentPath = codex.path || codex.configuredPath || "未选择";
  refs.settingsCodexSummary.textContent = `${codex.version || "未就绪"} · ${currentPath}`;

  if (codex.hasMultipleCandidates) {
    refs.settingsCodexSelectWrap.classList.remove("hidden");
    refs.settingsCodexSelect.innerHTML = [
      '<option value="">请选择要使用的 Codex</option>',
      ...codex.candidates.map((candidate) => (
        `<option value="${escapeHtml(candidate.path)}">${escapeHtml(`${candidate.version || "未知版本"} · ${candidate.path}`)}</option>`
      )),
    ].join("");
    refs.settingsCodexSelect.value = draftCodexPath || codex.configuredPath || "";
    refs.settingsCodexHelp.textContent = "检测到多个 Codex 安装。保存后应用会自动重启，并使用这里选中的路径。";
    return;
  }

  refs.settingsCodexSelectWrap.classList.add("hidden");
  refs.settingsCodexSelect.innerHTML = "";
  refs.settingsCodexHelp.textContent = "当前只检测到一份 Codex，应用会自动使用它。";
}

function renderProjects() {
  const query = state.searchQuery.trim().toLowerCase();
  const projects = state.projects.filter((project) => project.name.toLowerCase().includes(query));

  if (projects.length === 0) {
    refs.projectList.innerHTML = `<div class="empty-state">没有匹配的项目，先添加一个本地目录。</div>`;
    return;
  }

  refs.projectList.innerHTML = projects
    .map((project) => {
      const isActive = project.id === state.selectedProjectId;
      const hasAlert = Boolean(state.projectAlerts[project.id]);
      const lastOpened = project.lastOpened
        ? new Date(project.lastOpened).toLocaleString("zh-CN")
        : "尚未打开";

      return `
        <article class="project-item ${isActive ? "active" : ""}" data-project-id="${project.id}">
          <div class="project-row">
            <div class="project-title-wrap">
              <strong>${escapeHtml(project.name)}</strong>
              ${hasAlert ? '<span class="project-alert-dot" aria-label="有新消息"></span>' : ""}
            </div>
            <div class="project-actions">
              <button class="icon-button" data-action="favorite" data-project-id="${project.id}">${project.favorite ? "★" : "☆"}</button>
              <button class="icon-button" data-action="remove" data-project-id="${project.id}">删除</button>
            </div>
          </div>
          <div class="project-meta">${escapeHtml(project.path)}</div>
          <div class="project-meta">最近打开：${escapeHtml(lastOpened)}</div>
        </article>
      `;
    })
    .join("");
}

function renderTerminalBuffer() {
  const view = currentProjectView();
  if (!view || !view.terminalLoaded) {
    terminal.clear();
    state.renderedSessionId = null;
    return;
  }

  if (state.renderedSessionId === view.terminalSessionId) {
    return;
  }

  terminal.reset();
  terminal.clear();
  if (view.terminalBuffer) {
    terminal.write(view.terminalBuffer);
  }
  terminal.resize(lastGoodTerminalSize.cols, lastGoodTerminalSize.rows);
  state.renderedSessionId = view.terminalSessionId;
}

function renderWorkspace() {
  refs.terminalView.classList.remove("hidden");
  renderTerminalBuffer();
}

function render() {
  syncSelection();
  renderEnvironment();
  renderSettingsModal();
  renderProjects();
  renderWorkspace();
}

async function createOrAttachTerminal(projectId, force = false) {
  const project = state.projects.find((item) => item.id === projectId);
  if (!project) {
    return;
  }

  const view = ensureProjectView(projectId);
  console.log("createOrAttachTerminal:start", { projectId, force, hasView: !!view });
  if (view.terminalLoaded && view.terminalConnected && !force) {
    console.log("createOrAttachTerminal:reuse", { projectId });
    renderWorkspace();
    return;
  }

  if (force && view.terminalLoaded) {
    await window.workbenchApi.disposeTerminal({ sessionId: view.terminalSessionId });
    view.terminalLoaded = false;
    view.terminalConnected = false;
    view.terminalBuffer = "";
  }

  await window.workbenchApi.createTerminal({
    sessionId: view.terminalSessionId,
    projectId,
  });
  console.log("createOrAttachTerminal:created", { projectId, sessionId: view.terminalSessionId });
  view.terminalLoaded = true;
  view.terminalConnected = true;
  view.terminalBuffer = "";

  if (state.selectedProjectId === projectId) {
    await window.workbenchApi.resizeTerminal({
      sessionId: view.terminalSessionId,
      cols: lastGoodTerminalSize.cols,
      rows: lastGoodTerminalSize.rows,
    });
  }
  renderWorkspace();
}

async function ensureProjectLoaded(projectId) {
  await createOrAttachTerminal(projectId, false);
}

function refreshTerminalSize() {
  const project = selectedProject();
  const view = currentProjectView();
  if (!project || !view?.terminalLoaded || !view.terminalConnected) {
    return;
  }
  terminal.resize(lastGoodTerminalSize.cols, lastGoodTerminalSize.rows);
  console.log(`terminal:resize-stable ${JSON.stringify(lastGoodTerminalSize)}`);
  window.workbenchApi.resizeTerminal({
    sessionId: view.terminalSessionId,
    cols: lastGoodTerminalSize.cols,
    rows: lastGoodTerminalSize.rows,
  });
}

async function refreshState() {
  const nextState = await window.workbenchApi.getState();
  state.projects = nextState.projects;
  state.environment = nextState.environment;
  state.settings = nextState.settings;
  render();
  if (state.selectedProjectId) {
    await ensureProjectLoaded(state.selectedProjectId);
  }
}

terminal.onData((data) => {
  const view = currentProjectView();
  if (!view?.terminalLoaded || !view.terminalConnected) {
    return;
  }

  window.workbenchApi.terminalInput({
    sessionId: view.terminalSessionId,
    data,
  });
});

window.addEventListener("resize", refreshTerminalSize);

refs.sidebarResizer.addEventListener("mousedown", (event) => {
  event.preventDefault();

  const onMove = (moveEvent) => {
    const nextWidth = Math.min(520, Math.max(220, moveEvent.clientX));
    document.documentElement.style.setProperty("--sidebar-width", `${nextWidth}px`);
  };

  const onUp = () => {
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("mouseup", onUp);
  };

  window.addEventListener("mousemove", onMove);
  window.addEventListener("mouseup", onUp);
});

refs.addProjectBtn.addEventListener("click", async () => {
  try {
    await window.workbenchApi.pickProject();
  } catch (error) {
    alert(error.message);
  }
});

refs.projectSearchInput.addEventListener("input", (event) => {
  state.searchQuery = event.target.value;
  renderProjects();
});

refs.settingsBtn.addEventListener("click", () => {
  draftCodexPath = state.environment?.codex?.configuredPath || "";
  renderSettingsModal();
  refs.settingsModal.classList.remove("hidden");
});

function closeSettingsModal() {
  refs.settingsModal.classList.add("hidden");
}

refs.settingsCloseBtn.addEventListener("click", closeSettingsModal);
refs.settingsCancelBtn.addEventListener("click", closeSettingsModal);
refs.settingsModal.addEventListener("click", (event) => {
  if (event.target === refs.settingsModal) {
    closeSettingsModal();
  }
});
window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !refs.settingsModal.classList.contains("hidden")) {
    closeSettingsModal();
  }
});

refs.projectList.addEventListener("click", async (event) => {
  const projectId = event.target.getAttribute("data-project-id");
  const action = event.target.getAttribute("data-action");
  const projectCard = event.target.closest("[data-project-id]");

  if (!projectId && !projectCard) {
    return;
  }

  const targetProjectId = projectId || projectCard.getAttribute("data-project-id");

  if (action === "favorite") {
    await window.workbenchApi.toggleFavorite(targetProjectId);
    return;
  }

  if (action === "remove") {
    const confirmed = window.confirm("仅从列表移除项目，不删除磁盘目录。是否继续？");
    if (confirmed) {
      const removedView = state.projectViews[targetProjectId];
      if (removedView?.terminalLoaded) {
        await window.workbenchApi.disposeTerminal({ sessionId: removedView.terminalSessionId });
      }
      delete state.projectViews[targetProjectId];
      if (state.selectedProjectId === targetProjectId) {
        state.selectedProjectId = null;
      }
      await window.workbenchApi.removeProject(targetProjectId);
    }
    return;
  }

  state.selectedProjectId = targetProjectId;
  clearProjectAlert(targetProjectId);
  render();
  await ensureProjectLoaded(targetProjectId);
});

refs.settingsCodexSelect.addEventListener("change", (event) => {
  draftCodexPath = event.target.value;
});

refs.settingsSaveBtn.addEventListener("click", async () => {
  try {
    await window.workbenchApi.applySettingsAndRestart({
      codex: {
        path: draftCodexPath,
      },
    });
  } catch (error) {
    alert(error.message);
  }
});

window.workbenchApi.onTerminalData((payload) => {
  console.log(`onTerminalData ${JSON.stringify({
    sessionId: payload.sessionId,
    size: String(payload.data || "").length,
  })}`);
  const projectId = Object.keys(state.projectViews).find(
    (id) => state.projectViews[id].terminalSessionId === payload.sessionId
  );
  if (!projectId) {
    return;
  }

  const view = ensureProjectView(projectId);
  view.terminalBuffer = `${view.terminalBuffer}${payload.data}`.slice(-120000);
  if (state.selectedProjectId === projectId) {
    if (state.renderedSessionId !== payload.sessionId) {
      renderWorkspace();
    } else {
      terminal.write(payload.data);
    }
    console.log(`terminal:data-active ${JSON.stringify({
      sessionId: payload.sessionId,
      size: String(payload.data || "").length,
      hostWidth: refs.terminalHost.clientWidth,
      hostHeight: refs.terminalHost.clientHeight,
    })}`);
  }
});

window.workbenchApi.onTerminalExit((payload) => {
  const projectId = Object.keys(state.projectViews).find(
    (id) => state.projectViews[id].terminalSessionId === payload.sessionId
  );
  if (!projectId) {
    return;
  }

  const view = ensureProjectView(projectId);
  view.terminalConnected = false;
  if (state.selectedProjectId === projectId) {
    renderWorkspace();
  }
});

window.workbenchApi.onStateUpdated((nextState) => {
  state.projects = nextState.projects;
  state.environment = nextState.environment;
  state.settings = nextState.settings;
  render();
  if (state.selectedProjectId) {
    const activeView = currentProjectView();
    if (activeView && !activeView.terminalLoaded) {
      ensureProjectLoaded(state.selectedProjectId);
    }
  }
});

window.workbenchApi.onNotificationShow((payload) => {
  console.log(`notification:show ${JSON.stringify(payload)}`);
  if (payload.projectId && payload.projectId !== state.selectedProjectId) {
    state.projectAlerts[payload.projectId] = true;
    renderProjects();
  }
});

refreshState().then(() => {
  refreshTerminalSize();
});
