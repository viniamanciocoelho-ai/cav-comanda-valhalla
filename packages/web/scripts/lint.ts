import { existsSync, readFileSync } from "node:fs";

const spawnSyncOriginal = Bun.spawnSync.bind(Bun);

if (process.platform === "win32") {
  Bun.spawnSync = ((command, options) => {
    const executable = command[0];
    const scriptFile =
      typeof executable === "string" &&
      existsSync(executable) &&
      (/\.[cm]?js$/i.test(executable) || readFileSync(executable, "utf8").startsWith("#!"));
    if (scriptFile) {
      return spawnSyncOriginal([process.execPath, ...command], options);
    }
    return spawnSyncOriginal(command, options);
  }) as typeof Bun.spawnSync;
}

await import("../../../node_modules/@runablehq/runkit/dist/bin/runkit.js");
