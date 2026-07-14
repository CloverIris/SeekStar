import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

const userData = await mkdtemp(join(tmpdir(), "seekstar-electron-smoke-"));
const settingsOnly = process.argv.includes("--settings-only");
const executable = resolve("node_modules/electron/dist/electron.exe");
const entry = resolve("apps/desktop/out/main/index.js");
await writeFile(join(userData, "seekstar-settings.json"), JSON.stringify({
  active_ai_provider_id: "legacy-provider",
  ai_providers: [{
    id: "legacy-provider",
    label: "Legacy Provider",
    kind: "openai_compatible",
    enabled: true,
    base_url: "https://example.invalid/v1",
    model: "legacy-model",
    api_key_value: "legacy-plaintext-secret",
    timeout_ms: 60000,
    retry_attempts: 1,
    retry_backoff_ms: 500,
  }],
}, null, 2), "utf8");

try {
  const first = await runElectron(settingsOnly ? { SEEKSTAR_E2E_SETTINGS_ONLY: "1" } : { SEEKSTAR_E2E_SELF_TEST: "1" });
  const restart = await runElectron(settingsOnly ? { SEEKSTAR_E2E_SETTINGS_RESTART_VERIFY: "1" } : { SEEKSTAR_E2E_RESTART_VERIFY: "1" });
  console.log(JSON.stringify({ status: "ok", tests: [...first.tests, ...restart.tests], tab_id: first.tab_id, layer: first.layer }, null, 2));
} finally {
  await rm(userData, { recursive: true, force: true });
}

async function runElectron(extraEnv) {
  const child = spawn(executable, ["--in-process-gpu", entry], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      SEEKSTAR_E2E: "1",
      SEEKSTAR_E2E_FAKE_WORLD: "1",
      SEEKSTAR_E2E_USER_DATA: userData,
      DEEPSEEK_API_KEY: "",
      SEEKSTAR_AI_API_KEY: "",
      OPENAI_API_KEY: "",
      ...extraEnv,
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  let output = "";
  child.stdout.on("data", (chunk) => { output += chunk.toString(); });
  child.stderr.on("data", (chunk) => { output += chunk.toString(); });
  const timeout = setTimeout(() => child.kill(), 45_000);
  const exitCode = await new Promise((resolveExit) => child.once("exit", (code) => resolveExit(code)));
  clearTimeout(timeout);
  const marker = output.split(/\r?\n/).find((line) => line.startsWith("[SeekStarE2E]"));
  assert.ok(marker, `Electron self-test did not emit a result.\n${output}`);
  const result = JSON.parse(marker.slice("[SeekStarE2E]".length));
  assert.equal(exitCode, 0, `${result.reason ?? "Electron failed."}\n${output}`);
  assert.equal(result.status, "ok", result.reason ?? output);
  return result;
}
