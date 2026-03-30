const fs = require("node:fs");

class CodexNotifyService {
  constructor(options = {}) {
    this.eventFile = options.eventFile;
    this.onEvent = options.onEvent || (() => {});
    this.offset = 0;
    this.watcher = null;
  }

  start() {
    if (!this.eventFile) {
      return;
    }

    fs.mkdirSync(require("node:path").dirname(this.eventFile), { recursive: true });
    if (!fs.existsSync(this.eventFile)) {
      fs.writeFileSync(this.eventFile, "");
    }

    this.offset = fs.statSync(this.eventFile).size;
    this.watcher = fs.watch(this.eventFile, () => {
      this.consumeNewLines();
    });
  }

  stop() {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
  }

  consumeNewLines() {
    const stats = fs.statSync(this.eventFile);
    if (stats.size < this.offset) {
      this.offset = 0;
    }
    if (stats.size === this.offset) {
      return;
    }

    const stream = fs.createReadStream(this.eventFile, {
      encoding: "utf8",
      start: this.offset,
      end: stats.size,
    });

    let buffer = "";
    stream.on("data", (chunk) => {
      buffer += chunk;
    });
    stream.on("end", () => {
      this.offset = stats.size;
      for (const line of buffer.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed) {
          continue;
        }
        try {
          this.onEvent(JSON.parse(trimmed));
        } catch {}
      }
    });
  }
}

module.exports = { CodexNotifyService };
