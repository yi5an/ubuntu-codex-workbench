const { spawn } = require("node:child_process");

class VSCodeService {
  openProject(project) {
    const target = project.workspace || project.path;

    return new Promise((resolve, reject) => {
      const child = spawn("code", [target], {
        detached: true,
        stdio: "ignore",
      });

      child.on("error", (error) => {
        reject(new Error(`无法打开 VS Code：${error.message}`));
      });

      child.unref();
      resolve();
    });
  }
}

module.exports = { VSCodeService };

