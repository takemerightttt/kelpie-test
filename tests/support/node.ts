// Node implementations of the core's ports, so the same controller runs in
// Jest against the real, unmodified mock server from mock-kit/.
import { spawn, type ChildProcess } from "node:child_process";
import {
  closeSync,
  copyFileSync,
  mkdtempSync,
  openSync,
  readSync,
  renameSync,
  rmSync,
  statSync,
  readFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import type { Http, HttpResult } from "../../src/core/api";
import type { FileStore, OperationStore } from "../../src/core/controller";
import type { Operation } from "../../src/core/types";

export const KIT_DIRECTORY = resolve(__dirname, "../../mock-kit");
export const FIXTURES = join(KIT_DIRECTORY, "fixtures");

export class NodeHttp implements Http {
  constructor(private readonly base: string) {}

  async request(
    method: "GET" | "POST" | "DELETE",
    path: string,
    headers: Record<string, string> = {},
    json?: unknown,
  ): Promise<HttpResult> {
    const response = await fetch(this.base + path, {
      method,
      headers,
      body: json === undefined ? undefined : JSON.stringify(json),
    });
    return { status: response.status, body: await response.text() };
  }

  async uploadFile(
    path: string,
    fileUri: string,
    headers: Record<string, string>,
  ): Promise<HttpResult> {
    const response = await fetch(this.base + path, {
      method: "POST",
      headers,
      body: readFileSync(fileUri),
    });
    return { status: response.status, body: await response.text() };
  }
}

export class NodeFiles implements FileStore {
  readonly directory = mkdtempSync(join(tmpdir(), "kelpie-private-"));

  async inspect(uri: string, headBytes: number) {
    const size = statSync(uri).size;
    const head = Buffer.alloc(Math.min(headBytes, size));
    const fileDescriptor = openSync(uri, "r");
    try {
      readSync(fileDescriptor, head, 0, head.length, 0);
    } finally {
      closeSync(fileDescriptor);
    }
    return { size, head: new Uint8Array(head) };
  }

  async keepPrivate(uri: string, key: string): Promise<string> {
    const target = join(this.directory, key);
    renameSync(uri, target); // a move, like the device adapter
    return target;
  }

  async remove(uri: string): Promise<void> {
    rmSync(uri, { force: true });
  }
}

/** Simulates the picker: a temporary copy of a fixture the controller may delete. */
export function pickFixture(name: string): { uri: string; name: string } {
  const directory = mkdtempSync(join(tmpdir(), "kelpie-picked-"));
  const uri = join(directory, name);
  copyFileSync(join(FIXTURES, name), uri);
  return { uri, name };
}

/** Survives a simulated relaunch: a new controller reads the same store. */
export class MemoryStore implements OperationStore {
  private value: string | null = null;
  async load(): Promise<Operation | null> {
    return this.value ? (JSON.parse(this.value) as Operation) : null;
  }
  async save(operation: Operation | null): Promise<void> {
    this.value = operation ? JSON.stringify(operation) : null;
  }
}

export const newKey = () => randomUUID();

export async function startMock(): Promise<{
  base: string;
  stop: () => Promise<void>;
}> {
  const port = 18000 + Math.floor(Math.random() * 2000);
  const child: ChildProcess = spawn(process.execPath, ["mock-server.mjs"], {
    cwd: KIT_DIRECTORY,
    env: { ...process.env, PORT: String(port) },
    stdio: "pipe",
  });
  const base = `http://127.0.0.1:${port}`;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const response = await fetch(`${base}/health`);
      if (response.ok) break;
    } catch {
      await new Promise((resolveWait) => setTimeout(resolveWait, 50));
    }
  }
  await fetch(`${base}/__test/reset`, { method: "POST" });
  return {
    base,
    stop: async () => {
      child.kill();
      rmSync(join(KIT_DIRECTORY, ".mock-state.json"), { force: true });
    },
  };
}

export async function until<Result>(
  probe: () => Promise<Result>,
  done: (value: Result) => boolean,
  timeoutMs = 5000,
): Promise<Result> {
  const start = Date.now();
  for (;;) {
    const value = await probe();
    if (done(value)) return value;
    if (Date.now() - start > timeoutMs)
      throw new Error("condition not reached in time");
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  }
}
