import { File, UploadType } from "expo-file-system";
import type { Http } from "../core/api";

const TIMEOUT_MS = 15000;

/** fetch for JSON calls, File.upload for the statement bytes (streamed from disk). */
export function deviceHttp(baseUrl: string): Http {
  return {
    async request(method, path, headers = {}, json) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      try {
        const res = await fetch(baseUrl + path, {
          method,
          headers,
          body: json === undefined ? undefined : JSON.stringify(json),
          signal: controller.signal,
        });
        return { status: res.status, body: await res.text() };
      } finally {
        clearTimeout(timer);
      }
    },

    async uploadFile(path, fileUri, headers) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      try {
        const res = await new File(fileUri).upload(baseUrl + path, {
          httpMethod: "POST",
          uploadType: UploadType.BINARY_CONTENT,
          headers,
          sessionType: "foreground",
          signal: controller.signal,
        });
        return { status: res.status, body: res.body };
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
