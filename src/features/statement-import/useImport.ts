import { randomUUID } from "expo-crypto";
import { useCallback, useMemo, useState } from "react";
import { ImportsApi } from "@/core/api";
import { ImportController, type Inspected } from "@/core/controller";
import { consoleLog } from "@/core/log";
import { needsPolling } from "@/core/rules";
import type { Operation } from "@/core/types";
import { API_BASE_URL } from "@/platform/config";
import { deviceFiles } from "@/platform/files";
import { deviceHttp } from "@/platform/http";
import { deviceStore } from "@/platform/storage";
import { pickStatement, rejectNotice } from "./pickStatement";
import { useJobSync } from "./useJobSync";
import { useStillDeleting } from "./useStillDeleting";

export function useImport() {
  const api = useMemo(
    () => new ImportsApi(deviceHttp(API_BASE_URL, consoleLog)),
    [],
  );
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
  const [operation, setOperation] = useState<Operation | null>(null);
  const [pending, setPending] = useState<Inspected | null>(null);
  const [busy, setBusy] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const failures = useJobSync(
    controller,
    operation,
    { setOperation, setBusy, setNotice },
    consoleLog,
  );
  const stillDeleting = useStillDeleting(operation);

  const run = useCallback(
    async (task: () => Promise<Operation | null | void>) => {
      setBusy(true);
      try {
        const next = await task();
        if (next !== undefined) setOperation(next);
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

  const pick = useCallback(async () => {
    setNotice(null);
    const file = await pickStatement();
    if (!file) return;
    setBusy(true);
    try {
      const inspected = await controller.inspect(file);
      if (inspected.check.ok) setPending(inspected);
      else setNotice(rejectNotice(inspected.check));
    } finally {
      setBusy(false);
    }
  }, [controller]);

  const withPending =
    (task: (inspected: Inspected) => Promise<Operation | null | void>) =>
    () => {
      const inspected = pending;
      setPending(null);
      if (inspected) run(() => task(inspected));
    };

  return {
    operation,
    pending,
    busy,
    notice:
      notice ??
      (failures > 0 && operation && needsPolling(operation)
        ? "Server not reachable - retrying."
        : stillDeleting
          ? "Still deleting - the server has not confirmed yet"
          : null),
    pick,
    confirm: withPending((inspected) => controller.confirm(inspected)),
    cancel: withPending((inspected) => controller.discard(inspected)),
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
    log: consoleLog,
  };
}

export type ImportActions = ReturnType<typeof useImport>;
