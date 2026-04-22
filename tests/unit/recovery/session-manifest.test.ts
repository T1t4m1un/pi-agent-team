import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SessionManifestManager } from "@/recovery/session-manifest.js";

describe("SessionManifestManager", () => {
  let baseDir: string;
  let manager: SessionManifestManager;

  beforeEach(async () => {
    baseDir = await mkdtemp(join(tmpdir(), "pi-manifest-test-"));
    manager = new SessionManifestManager("test-team", baseDir);
  });

  afterEach(async () => {
    await rm(baseDir, { recursive: true, force: true });
  });

  it("saves and loads manifest", async () => {
    const manifest = {
      configPath: "/path/to/team.yaml",
      teamName: "test-team",
      status: "active" as const,
      startedAt: "2025-01-01T00:00:00.000Z",
    };

    await manager.save(manifest);
    const loaded = await manager.load();

    expect(loaded).toEqual(manifest);
  });

  it("returns null when no manifest exists", async () => {
    const loaded = await manager.load();
    expect(loaded).toBeNull();
  });

  it("reports exists correctly", async () => {
    expect(await manager.exists()).toBe(false);

    await manager.save({
      configPath: "/path",
      teamName: "test-team",
      status: "active",
      startedAt: new Date().toISOString(),
    });

    expect(await manager.exists()).toBe(true);
  });

  it("updates status", async () => {
    await manager.save({
      configPath: "/path",
      teamName: "test-team",
      status: "active",
      startedAt: new Date().toISOString(),
    });

    await manager.updateStatus("completed");
    const loaded = await manager.load();

    expect(loaded?.status).toBe("completed");
  });

  it("preserves fields on status update", async () => {
    const original = {
      configPath: "/path/to/team.yaml",
      teamName: "test-team",
      status: "active" as const,
      startedAt: "2025-01-01T00:00:00.000Z",
      lastSnapshotAt: "2025-01-01T00:05:00.000Z",
    };

    await manager.save(original);
    await manager.updateStatus("suspended");

    const loaded = await manager.load();
    expect(loaded).toMatchObject({
      configPath: original.configPath,
      teamName: original.teamName,
      startedAt: original.startedAt,
      lastSnapshotAt: original.lastSnapshotAt,
      status: "suspended",
    });
  });

  it("returns correct manifest path", () => {
    expect(manager.getManifestPath()).toBe(join(baseDir, "test-team", "session.json"));
  });

  it("writes valid JSON to disk", async () => {
    await manager.save({
      configPath: "/path",
      teamName: "test-team",
      status: "active",
      startedAt: "2025-01-01T00:00:00.000Z",
    });

    const raw = await readFile(manager.getManifestPath(), "utf-8");
    const parsed = JSON.parse(raw);
    expect(parsed.teamName).toBe("test-team");
  });
});
