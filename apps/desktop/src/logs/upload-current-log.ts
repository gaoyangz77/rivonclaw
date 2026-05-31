import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { LOG_DIR } from "@rivonclaw/logger";

export const LOG_FILENAME = "rivonclaw.log";
const MAX_UPLOAD_SIZE = 10 * 1024 * 1024; // 10 MB

export class LocalLogUploadError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: Record<string, string>,
  ) {
    super(body.error);
  }
}

export interface LogUploadCloudClient {
  rest<T>(path: string, init?: RequestInit): Promise<T>;
}

export interface UploadCurrentLogOptions {
  deviceId?: string;
  requestId?: string;
}

export async function uploadCurrentLog<T = unknown>(
  cloudClient: LogUploadCloudClient,
  options: UploadCurrentLogOptions = {},
): Promise<T> {
  const logPath = join(LOG_DIR, LOG_FILENAME);

  let fileBuffer: Buffer;
  try {
    fileBuffer = await readFile(logPath);
  } catch {
    throw new LocalLogUploadError(404, { error: "Log file not found" });
  }

  if (fileBuffer.length > MAX_UPLOAD_SIZE) {
    throw new LocalLogUploadError(413, { error: "Log file too large" });
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/octet-stream",
    "x-filename": LOG_FILENAME,
  };
  if (options.deviceId) headers["x-device-id"] = options.deviceId;
  if (options.requestId) headers["x-log-upload-request-id"] = options.requestId;

  return cloudClient.rest<T>("/api/client-logs/upload", {
    method: "POST",
    headers,
    body: fileBuffer,
  });
}
