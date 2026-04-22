import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MINIMAL_YAML } from "@test/fixtures/team-configs.js";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Orchestrator } from "@/orchestration/orchestrator.js";
import type { SessionManifest } from "@/recovery/session-manifest.js";

vi.mock("@mariozechner/pi-agent-core", () => {
  return {
    Agent: vi.fn().mockImplementation(() => ({
      prompt: vi.fn().mockResolvedValue(undefined),
      state: { messages: [], currentState: "idle" },
      abort: vi.fn(),
    })),
  };
});

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

describe("Orchestrator", () => {
  let tmpDir: string;
  let yamlPath: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "pi-orch-test-"));
    yamlPath = join(tmpDir, "test-team.yaml");
    await writeFile(yamlPath, MINIMAL_YAML, "utf-8");
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
    await rm(".pi/teams/minimal-team", { recursive: true, force: true }).catch(() => {});
  });

  describe("bootstrap", () => {
    it("creates manifest on bootstrap", async () => {
      const onTeamStart = vi.fn();
      const orchestrator = new Orchestrator({ onTeamStart });

      await orchestrator.bootstrap(yamlPath);

      expect(onTeamStart).toHaveBeenCalledWith(
        expect.objectContaining({ teamName: "minimal-team" }),
      );

      const manifest = await orchestrator.getManifest();
      expect(manifest).toMatchObject({
        teamName: "minimal-team",
        status: "active",
        configPath: yamlPath,
      });

      await orchestrator.shutdown();
    });

    it("populates configPath in snapshot", async () => {
      const orchestrator = new Orchestrator();
      await orchestrator.bootstrap(yamlPath);
      await orchestrator.shutdown();

      expect(orchestrator.getTeamName()).toBe("minimal-team");
    });

    it("updates manifest to completed on shutdown", async () => {
      const onTeamEnd = vi.fn();
      const orchestrator = new Orchestrator({ onTeamEnd });

      await orchestrator.bootstrap(yamlPath);
      await orchestrator.shutdown();

      expect(onTeamEnd).toHaveBeenCalled();

      const manifest = await orchestrator.getManifest();
      expect(manifest?.status).toBe("completed");
    });
  });

  describe("recover", () => {
    it("throws when no manifest exists", async () => {
      const orchestrator = new Orchestrator();
      await expect(orchestrator.recover("nonexistent")).rejects.toThrow(
        "No session manifest found",
      );
    });

    it("throws when session already completed", async () => {
      const orchestrator = new Orchestrator();

      await orchestrator.bootstrap(yamlPath);
      await orchestrator.shutdown();

      const completedManifest: SessionManifest = {
        configPath: yamlPath,
        teamName: "minimal-team",
        status: "completed",
        startedAt: new Date().toISOString(),
      };

      const { SessionManifestManager } = await import("@/recovery/session-manifest.js");
      const manifestMgr = new SessionManifestManager("minimal-team");
      await manifestMgr.save(completedManifest);

      const fresh = new Orchestrator();
      await expect(fresh.recover("minimal-team")).rejects.toThrow("already completed");
    });
  });

  describe("getLeadActor", () => {
    it("returns lead actor after bootstrap", async () => {
      const orchestrator = new Orchestrator();
      await orchestrator.bootstrap(yamlPath);

      const lead = orchestrator.getLeadActor();
      expect(lead).toBeDefined();
      expect(lead.actorId).toBe("lead");

      await orchestrator.shutdown();
    });
  });
});
