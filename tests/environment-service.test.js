const test = require("node:test");
const assert = require("node:assert/strict");
const { EnvironmentService } = require("../src/main/services/environment-service");

test("EnvironmentService reports installed command details", () => {
  const service = new EnvironmentService();
  const result = service.inspectCommand("node", ["--version"]);

  assert.equal(result.installed, true);
  assert.match(result.version, /^v\d+/);
});

test("EnvironmentService reports missing command", () => {
  const service = new EnvironmentService();
  const result = service.inspectCommand("definitely-missing-command", ["--version"]);

  assert.equal(result.installed, false);
  assert.equal(result.version, null);
  assert.ok(result.detail);
});

