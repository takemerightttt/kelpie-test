import { randomUUID } from "expo-crypto";
import * as DocumentPicker from "expo-document-picker";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";
import { ImportsApi } from "../core/api";
import { ImportController, type Inspected } from "../core/controller";
import { consoleLog } from "../core/log";
import { needsPolling, pollDelay } from "../core/rules";
import type { Operation } from "../core/types";
import { API_BASE_URL } from "../platform/config";
import { deviceFiles } from "../platform/files";
import { deviceHttp } from "../platform/http";
import { deviceStore } from "../platform/storage";

export function useImport() {
  const api = useMemo(() => new ImportsApi(deviceHttp(API_BASE_URL)), []);
  const controller = useMemo(
    () =>
      new ImportController({
        api,
        files: deviceFiles,
        store: deviceStore,
        newKey: randomUUID,
        log: consoleLog,
      }),
    [api],
  );
  const [op, setOp] = useState<Operation | null>(null);
  const [pending, setPending] = useState<Inspected | null>(null);
  const [busy, setBusy] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [failures, setFailures] = useState(0);
  const [active, setActive] = useState(AppState.currentState === "active");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const run = useCallback(
    async (task: () => Promise<Operation | null | void>) => {
      setBusy(true);
      try {
        const next = await task();
        if (next !== undefined) setOp(next);
      } catch {
        setNotice(
          "Something went wrong. Nothing was sent twice - you can try again.",
        );
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  useEffect(() => {
    const resume = () =>
      controller
        .resume()
        .then(setOp)
        .catch(() =>
          setNotice("Could not reach the server. Tap Refresh to try again."),
        )
        .finally(() => setBusy(false));
    void resume();
    const sub = AppState.addEventListener("change", (state) => {
      setActive(state === "active");
      if (state === "active") {
        setFailures(0);
        void resume();
      }
    });
    return () => sub.remove();
  }, [controller]);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (active && op && needsPolling(op)) {
      timer.current = setTimeout(async () => {
        const { operation: next, reachable } = await controller.poll();
        setFailures((n) => (reachable ? 0 : n + 1));
        setOp(next);
      }, pollDelay(failures));
    }
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [op, active, failures, controller]);

  const pick = useCallback(async () => {
    setNotice(null);
    const result = await DocumentPicker.getDocumentAsync({
      type: [
        "application/pdf",
        "text/csv",
        "text/comma-separated-values",
        "text/plain",
        "application/octet-stream",
      ],
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setBusy(true);
    try {
      const inspected = await controller.inspect({
        uri: asset.uri,
        name: asset.name,
      });
      if (inspected.check.ok) setPending(inspected);
      else
        setNotice(
          inspected.check.reason === "too_large"
            ? "This file is larger than 10 MiB."
            : "This is not a PDF or CSV statement.",
        );
    } finally {
      setBusy(false);
    }
  }, [controller]);

  return {
    op,
    pending,
    busy,
    notice:
      notice ??
      (failures > 0 && op && needsPolling(op)
        ? "Server not reachable - retrying."
        : null),
    pick,
    confirm: () => {
      const p = pending;
      setPending(null);
      if (p) run(() => controller.confirm(p));
    },
    cancel: () => {
      const p = pending;
      setPending(null);
      if (p) run(() => controller.discard(p));
    },
    checkByKey: () => run(() => controller.checkByKey()),
    retrySend: () => run(() => controller.retrySend()),
    refresh: () => run(() => controller.refresh()),
    requestDelete: () => run(() => controller.requestDelete()),
    reset: () =>
      run(async () => {
        await controller.reset();
        return null;
      }),
    api,
  };
}
