import { describe, it } from "vitest";

const SMOKE_ENABLED = process.env.PI_SMOKE_TEST === "true";

describe.skipIf(!SMOKE_ENABLED)("Smoke: full team bootstrap", () => {
  it("boots a team from team.yaml and processes a task", async () => {});
});
