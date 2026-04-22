import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

export type ManifestStatus = "active" | "suspended" | "completed";

export interface SessionManifest {
  configPath: string;
  teamName: string;
  sessionId?: string;
  status: ManifestStatus;
  startedAt: string;
  lastSnapshotAt?: string;
}

export class SessionManifestManager {
  private readonly manifestDir: string;
  private readonly manifestPath: string;

  constructor(
    private readonly teamName: string,
    private readonly baseDir: string = ".pi/teams",
  ) {
    this.manifestDir = join(baseDir, teamName);
    this.manifestPath = join(this.manifestDir, "session.json");
  }

  async save(manifest: SessionManifest): Promise<string> {
    await mkdir(this.manifestDir, { recursive: true });
    await writeFile(this.manifestPath, JSON.stringify(manifest, null, 2), "utf-8");
    return this.manifestPath;
  }

  async load(): Promise<SessionManifest | null> {
    try {
      const content = await readFile(this.manifestPath, "utf-8");
      return JSON.parse(content) as SessionManifest;
    } catch {
      return null;
    }
  }

  async updateStatus(status: ManifestStatus): Promise<void> {
    const manifest = await this.load();
    if (!manifest) return;
    manifest.status = status;
    await this.save(manifest);
  }

  async exists(): Promise<boolean> {
    try {
      await readFile(this.manifestPath, "utf-8");
      return true;
    } catch {
      return false;
    }
  }

  getManifestPath(): string {
    return this.manifestPath;
  }
}
