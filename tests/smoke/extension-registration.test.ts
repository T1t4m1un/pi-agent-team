import { describe, it } from "vitest";

const SMOKE_ENABLED = process.env.PI_SMOKE_TEST === "true";

describe.skipIf(!SMOKE_ENABLED)("Smoke: extension registration", () => {
  it("registers /team and /team-recover commands", async () => {});
});
