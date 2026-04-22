import { mkdtemp, rm, appendFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTestMessage } from "@test/fixtures/messages.js";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { JsonlInbox } from "@/messaging/jsonl-inbox.js";

describe("JsonlInbox", () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), "pi-team-test-"));
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it("appends and reads entries", async () => {
    const inbox = new JsonlInbox("test-team", "actor-1", testDir);
    const msg = createTestMessage();

    await inbox.append({ direction: "in", message: msg });
    const entries = await inbox.readAll();

    expect(entries).toHaveLength(1);
    expect(entries[0].direction).toBe("in");
    expect(entries[0].message.id).toBe(msg.id);
  });

  it("appends multiple entries in order", async () => {
    const inbox = new JsonlInbox("test-team", "actor-1", testDir);

    await inbox.append({ direction: "in", message: createTestMessage() });
    await inbox.append({ direction: "out", message: createTestMessage() });

    const entries = await inbox.readAll();
    expect(entries).toHaveLength(2);
    expect(entries[0].direction).toBe("in");
    expect(entries[1].direction).toBe("out");
  });

  it("handles empty inbox", async () => {
    const inbox = new JsonlInbox("test-team", "actor-1", testDir);
    const entries = await inbox.readAll();
    expect(entries).toHaveLength(0);
  });

  it("skips corrupted lines", async () => {
    const inbox = new JsonlInbox("test-team", "actor-1", testDir);
    await inbox.append({ direction: "in", message: createTestMessage() });

    await appendFile(inbox.getFilePath(), "\nnot valid json\n");

    const entries = await inbox.readAll();
    expect(entries).toHaveLength(1);
  });
});
