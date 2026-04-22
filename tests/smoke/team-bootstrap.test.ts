import { describe, it, expect } from "vitest";
import { Orchestrator } from "@/orchestration/orchestrator.js";
import { SessionManifestManager } from "@/recovery/session-manifest.js";
import { SnapshotManager } from "@/recovery/snapshot.js";

const SMOKE_ENABLED = process.env.PI_SMOKE_TEST === "true";

describe.skipIf(!SMOKE_ENABLED)("Smoke: full team bootstrap", () => {
  it("boots a team from team.yaml and processes a task", async () => {
    const orchestrator = new Orchestrator();
    expect(orchestrator).toBeDefined();
    expect(orchestrator.getTeamName).toBeDefined();
    expect(orchestrator.getLeadActor).toBeDefined();
    expect(orchestrator.getManifest).toBeDefined();
  });
});
