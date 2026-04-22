import { appendFile, mkdir, readFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { TeamMessage } from "@/types.js";

export interface JsonlEntry {
  direction: "in" | "out";
  message: TeamMessage;
}

export class JsonlInbox {
  private filePath: string;

  constructor(
    private readonly teamName: string,
    private readonly actorId: string,
    private readonly baseDir: string = ".pi/teams",
  ) {
    this.filePath = `${baseDir}/${teamName}/inboxes/${actorId}.jsonl`;
  }

  async append(entry: JsonlEntry): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    const line = JSON.stringify(entry) + "\n";
    await appendFile(this.filePath, line, "utf-8");
  }

  async readAll(): Promise<JsonlEntry[]> {
    try {
      const content = await readFile(this.filePath, "utf-8");
      return content
        .split("\n")
        .filter((line) => line.trim().length > 0)
        .map((line, index) => {
          try {
            return JSON.parse(line) as JsonlEntry;
          } catch {
            console.warn(
              `[JsonlInbox] Skipping corrupted line ${index + 1} in ${this.filePath}: ${line.slice(0, 80)}`,
            );
            return null;
          }
        })
        .filter((e): e is JsonlEntry => e !== null);
    } catch {
      return [];
    }
  }

  getFilePath(): string {
    return this.filePath;
  }
}
