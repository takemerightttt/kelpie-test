import { File, UploadType } from "expo-file-system";
import type { Http, HttpResult } from "@/core/api";
import { traced } from "@/core/httpTrace";
import type { SafeLog } from "@/core/log";

const TIMEOUT_MS = 15000;

/** fetch for JSON calls, File.upload for the statement bytes (streamed from disk).
 * Every call is traced as http_request through the given SafeLog. */
export function deviceHttp(baseUrl: string, log: SafeLog): Http {
  async function send(
    method: "GET" | "POST" | "DELETE",
    path: string,
    call: (signal: AbortSignal) => Promise<HttpResult>,
  ): Promise<HttpResult> {
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, TIMEOUT_MS);
    try {
      return await traced(
        log,
        method,
        path,
        () => timedOut,
        () => call(controller.signal),
      );
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    request(method, path, headers = {}, json) {
      return send(method, path, async (signal) => {
        const response = await fetch(baseUrl + path, {
          method,
          headers,
          body: json === undefined ? undefined : JSON.stringify(json),
          signal,
        });
        return { status: response.status, body: await response.text() };
      });
    },

    uploadFile(path, fileUri, headers) {
      return send("POST", path, async (signal) => {
        const response = await new File(fileUri).upload(baseUrl + path, {
          httpMethod: "POST",
          uploadType: UploadType.BINARY_CONTENT,
          headers,
          sessionType: "foreground",
          signal,
        });
        return { status: response.status, body: response.body };
      });
    },
  };
}
