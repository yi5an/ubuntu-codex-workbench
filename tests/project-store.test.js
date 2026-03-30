const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { ProjectStore } = require("../src/main/services/project-store");

test("ProjectStore sorts favorites first and recent projects before older ones", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "workbench-store-"));
  const dataFile = path.join(tempDir, "data.json");
  const store = new ProjectStore(dataFile);

  const alphaDir = path.join(tempDir, "alpha");
  const betaDir = path.join(tempDir, "beta");
  const gammaDir = path.join(tempDir, "gamma");
  fs.mkdirSync(alphaDir);
  fs.mkdirSync(betaDir);
  fs.mkdirSync(gammaDir);

  const alpha = store.addProject(alphaDir);
  const beta = store.addProject(betaDir);
  const gamma = store.addProject(gammaDir);

  store.toggleFavorite(beta.id);
  store.updateTask("missing", {});

  alpha.lastOpened = "2026-03-30T10:00:00.000Z";
  beta.lastOpened = "2026-03-30T09:00:00.000Z";
  gamma.lastOpened = "2026-03-30T11:00:00.000Z";
  store.save();

  const sorted = store.getProjects();
  assert.equal(sorted[0].id, beta.id);
  assert.equal(sorted[1].id, gamma.id);
  assert.equal(sorted[2].id, alpha.id);
});

test("ProjectStore detects workspace file in project root", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "workbench-store-"));
  const dataFile = path.join(tempDir, "data.json");
  const projectDir = path.join(tempDir, "workspace-demo");
  fs.mkdirSync(projectDir);
  fs.writeFileSync(path.join(projectDir, "workspace-demo.code-workspace"), "{}");

  const store = new ProjectStore(dataFile);
  const project = store.addProject(projectDir);

  assert.equal(
    project.workspace,
    path.join(projectDir, "workspace-demo.code-workspace")
  );
});
