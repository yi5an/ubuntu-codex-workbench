const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("workbenchApi", {
  getState: () => ipcRenderer.invoke("state:get"),
  pickProject: () => ipcRenderer.invoke("project:pick"),
  removeProject: (projectId) => ipcRenderer.invoke("project:remove", projectId),
  toggleFavorite: (projectId) => ipcRenderer.invoke("project:favorite", projectId),
  openProject: (projectId) => ipcRenderer.invoke("project:open", projectId),
  updateSettings: (patch) => ipcRenderer.invoke("settings:update", patch),
  applySettingsAndRestart: (patch) => ipcRenderer.invoke("settings:apply-and-restart", patch),
  runTask: (payload) => ipcRenderer.invoke("task:run", payload),
  stopTask: () => ipcRenderer.invoke("task:stop"),
  createTerminal: (payload) => ipcRenderer.invoke("terminal:create", payload),
  terminalInput: (payload) => ipcRenderer.invoke("terminal:input", payload),
  resizeTerminal: (payload) => ipcRenderer.invoke("terminal:resize", payload),
  runTerminalCommand: (payload) => ipcRenderer.invoke("terminal:run-command", payload),
  disposeTerminal: (payload) => ipcRenderer.invoke("terminal:dispose", payload),
  onStateUpdated: (listener) => {
    const wrapped = (_event, state) => listener(state);
    ipcRenderer.on("state:updated", wrapped);
    return () => ipcRenderer.removeListener("state:updated", wrapped);
  },
  onTerminalData: (listener) => {
    const wrapped = (_event, payload) => listener(payload);
    ipcRenderer.on("terminal:data", wrapped);
    return () => ipcRenderer.removeListener("terminal:data", wrapped);
  },
  onTerminalExit: (listener) => {
    const wrapped = (_event, payload) => listener(payload);
    ipcRenderer.on("terminal:exit", wrapped);
    return () => ipcRenderer.removeListener("terminal:exit", wrapped);
  },
  onNotificationShow: (listener) => {
    const wrapped = (_event, payload) => listener(payload);
    ipcRenderer.on("notification:show", wrapped);
    return () => ipcRenderer.removeListener("notification:show", wrapped);
  },
});
