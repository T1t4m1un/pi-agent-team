import {
  VALID_YAML,
  MINIMAL_YAML,
  MISSING_NAME_YAML,
  MISSING_WORKERS_YAML,
  MISSING_LEAD_YAML,
} from "@test/fixtures/team-configs.js";
import { describe, it, expect } from "vitest";
import { parseTeamConfig } from "@/config/parser.js";

describe("parseTeamConfig", () => {
  it("parses valid team config", () => {
    const config = parseTeamConfig(VALID_YAML);
    expect(config.name).toBe("dev-team");
    expect(config.lead.role).toBe("lead");
    expect(config.workers).toHaveLength(2);
    expect(config.workers[0].role).toBe("backend");
    expect(config.workers[1].role).toBe("reviewer");
    expect(config.settings?.busyTimeoutMs).toBe(300000);
  });

  it("parses minimal team config", () => {
    const config = parseTeamConfig(MINIMAL_YAML);
    expect(config.name).toBe("minimal-team");
    expect(config.lead.role).toBe("lead");
    expect(config.workers).toHaveLength(1);
  });

  it("throws on missing name", () => {
    expect(() => parseTeamConfig(MISSING_NAME_YAML)).toThrow(/name/i);
  });

  it("throws on missing lead", () => {
    expect(() => parseTeamConfig(MISSING_LEAD_YAML)).toThrow(/lead/i);
  });

  it("throws on missing workers", () => {
    expect(() => parseTeamConfig(MISSING_WORKERS_YAML)).toThrow(/worker/i);
  });

  it("provides default settings when not specified", () => {
    const config = parseTeamConfig(MINIMAL_YAML);
    expect(config.settings).toBeDefined();
    expect(config.settings?.busyTimeoutMs).toBe(300_000);
  });
});
