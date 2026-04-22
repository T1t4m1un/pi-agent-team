import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Orchestrator } from "@/orchestration/orchestrator.js";
import { SessionManifestManager } from "@/recovery/session-manifest.js";

const RECOVERY_YAML = `
name: recovery-integ-team
lead:
  role: lead
  model: claude-sonnet-4-20250514
  system_prompt: You coordinate tasks.
workers:
  - role: worker
    model: claude-sonnet-4-20250514
    system_prompt: You execute tasks.
`;

const TEAM_NAME = "recovery-integ-team";

vi.mock("@mariozechner/pi-agent-core", () => ({
  Agent: vi.fn().mockImplementation(() => ({
    prompt: vi.fn().mockResolvedValue(undefined),
    state: { messages: [], currentState: "idle" },
    abort: vi.fn(),
  })),
}));

vi.mock("@mariozechner/pi-ai", () => ({
  streamSimple: vi.fn().mockReturnValue({
    [Symbol.asyncIterator]() {
      return { next: () => Promise.resolve({ done: true }) };
    },
    result: () => Promise.resolve([]),
    push: vi.fn(),
    end: vi.fn(),
  }),
}));

describe("Recovery integration", () => {
  let tmpDir: string;
  let yamlPath: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "pi-recover-integ-"));
    yamlPath = join(tmpDir, "team.yaml");
    await writeFile(yamlPath, RECOVERY_YAML, "utf-8");
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
    await rm(`.pi/teams/${TEAM_NAME}`, { recursive: true, force: true }).catch(() => {});
  });

  it("bootstraps, shuts down, then recovers from manifest", async () => {
    const onStart = vi.fn();
    const onEnd = vi.fn();

    const first = new Orchestrator({ onTeamStart: onStart, onTeamEnd: onEnd });
    await first.bootstrap(yamlPath, "do something");

    expect(onStart).toHaveBeenCalledWith(expect.objectContaining({ teamName: TEAM_NAME }));

    const manifestAfterBoot = await first.getManifest();
    expect(manifestAfterBoot?.status).toBe("active");

    await first.shutdown();
    expect(onEnd).toHaveBeenCalled();

    const manifestAfterShutdown = await first.getManifest();
    expect(manifestAfterShutdown?.status).toBe("completed");

    const manifestMgr = new SessionManifestManager(TEAM_NAME);
    await manifestMgr.save({
      configPath: yamlPath,
      teamName: TEAM_NAME,
      status: "active",
      startedAt: new Date().toISOString(),
    });

    const onStart2 = vi.fn();
    const second = new Orchestrator({ onTeamStart: onStart2 });
    const result = await second.recover(TEAM_NAME);

    expect(onStart2).toHaveBeenCalledWith(expect.objectContaining({ teamName: TEAM_NAME }));
    expect(result.recoveredFrom).toBeDefined();
    expect(result.pendingTasks).toBeDefined();
    expect(Array.isArray(result.pendingTasks)).toBe(true);

    const manifestAfterRecover = await second.getManifest();
    expect(manifestAfterRecover?.status).toBe("active");

    await second.shutdown();
  });

  it("preserves manifest configPath through bootstrap-shutdown-recover cycle", async () => {
    const first = new Orchestrator();
    await first.bootstrap(yamlPath);
    await first.shutdown();

    const mgr = new SessionManifestManager(TEAM_NAME);
    await mgr.save({
      configPath: yamlPath,
      teamName: TEAM_NAME,
      status: "active",
      startedAt: new Date().toISOString(),
    });

    const second = new Orchestrator();
    await second.recover(TEAM_NAME);

    const manifest = await second.getManifest();
    expect(manifest?.configPath).toBe(yamlPath);

    await second.shutdown();
  });

  it("writes snapshot with configPath and leadTranscript", async () => {
    const first = new Orchestrator();
    await first.bootstrap(yamlPath);

    await first.shutdown();

    const { SnapshotManager } = await import("@/recovery/snapshot.js");
    const snapshotMgr = new SnapshotManager(TEAM_NAME);
    const snapshot = await snapshotMgr.loadLatest();

    expect(snapshot).not.toBeNull();
    expect(snapshot!.configPath).toBe(yamlPath);
    expect(snapshot!.teamName).toBe(TEAM_NAME);
    expect("leadTranscript" in snapshot!).toBe(true);
  });
});
