import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { join } from "node:path";
import { JsonlInbox, type JsonlEntry } from "@/messaging/jsonl-inbox.js";
import type { StateSnapshot, ActorState } from "@/types.js";

export class SnapshotManager {
  private readonly snapshotsDir: string;

  constructor(
    private readonly teamName: string,
    private readonly baseDir: string = ".pi/teams",
  ) {
    this.snapshotsDir = join(baseDir, teamName, "snapshots");
  }

  async save(snapshot: StateSnapshot): Promise<string> {
    await mkdir(this.snapshotsDir, { recursive: true });
    const filename = `${snapshot.timestamp.replace(/[:.]/g, "-")}.json`;
    const filePath = join(this.snapshotsDir, filename);
    await writeFile(filePath, JSON.stringify(snapshot, null, 2), "utf-8");
    return filePath;
  }

  async loadLatest(): Promise<StateSnapshot | null> {
    try {
      const files = await readdir(this.snapshotsDir);
      const jsonFiles = files.filter((f) => f.endsWith(".json")).sort();
      if (jsonFiles.length === 0) return null;

      const latest = jsonFiles[jsonFiles.length - 1];
      const content = await readFile(join(this.snapshotsDir, latest), "utf-8");
      return JSON.parse(content) as StateSnapshot;
    } catch {
      return null;
    }
  }
}

export interface ReplayResult {
  actorStates: Map<string, ActorState>;
  inFlightTasks: Record<string, string>;
  lastMessageTimestamp: string;
  messageCount: number;
}

export async function replayJsonlInboxes(
  teamName: string,
  actorIds: string[],
  baseDir: string = ".pi/teams",
): Promise<ReplayResult> {
  const actorStates = new Map<string, ActorState>();
  const inFlightTasks = new Map<string, string>();
  let lastMessageTimestamp = "";
  let messageCount = 0;

  for (const actorId of actorIds) {
    actorStates.set(actorId, {
      actorId,
      role: actorId,
      model: "",
      currentState: "created",
      lastActivity: 0,
    });
  }

  const allEntries: { actorId: string; entry: JsonlEntry }[] = [];

  for (const actorId of actorIds) {
    const inbox = new JsonlInbox(teamName, actorId, baseDir);
    const entries = await inbox.readAll();
    for (const entry of entries) {
      allEntries.push({ actorId, entry });
    }
  }

  allEntries.sort((a, b) => a.entry.message.timestamp.localeCompare(b.entry.message.timestamp));

  for (const { actorId, entry } of allEntries) {
    messageCount++;
    lastMessageTimestamp = entry.message.timestamp;

    const state = actorStates.get(actorId);
    if (!state) continue;

    state.lastActivity = new Date(entry.message.timestamp).getTime();

    switch (entry.message.type) {
      case "status_update":
        if ((entry.message.payload as { status: string }).status === "ready") {
          state.currentState = "ready";
        }
        break;
      case "task_assign":
        if (entry.direction === "in") {
          state.currentState = "busy";
          inFlightTasks.set(actorId, entry.message.id);
        }
        break;
      case "task_result": {
        const payload = entry.message.payload as { status: string };
        if (payload.status === "success") {
          state.currentState = "ready";
          inFlightTasks.delete(actorId);
        } else if (payload.status === "error") {
          state.currentState = "error";
          inFlightTasks.delete(actorId);
        }
        break;
      }
      case "shutdown":
        state.currentState = "shutdown";
        break;
    }
  }

  return {
    actorStates,
    inFlightTasks: Object.fromEntries(inFlightTasks),
    lastMessageTimestamp,
    messageCount,
  };
}
