import { describe, it, expect } from "vitest";
import { Orchestrator } from "@/orchestration/orchestrator.js";

const SMOKE_ENABLED = process.env.PI_SMOKE_TEST === "true";

describe.skipIf(!SMOKE_ENABLED)("Smoke: extension registration", () => {
  it("registers /team command with auto-recover support", async () => {
    const orchestrator = new Orchestrator();
    expect(typeof orchestrator.bootstrap).toBe("function");
    expect(typeof orchestrator.recover).toBe("function");
    expect(typeof orchestrator.shutdown).toBe("function");
  });
});
