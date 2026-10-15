import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { AppState } from "react-native";
import type { ImportController } from "@/core/controller";
import type { SafeLog } from "@/core/log";
import { needsPolling, pollDelay } from "@/core/rules";
import type { Operation } from "@/core/types";

type Setters = {
  setOperation: Dispatch<SetStateAction<Operation | null>>;
  setBusy: Dispatch<SetStateAction<boolean>>;
  setNotice: Dispatch<SetStateAction<string | null>>;
};

/** Restores the saved operation on start and on foreground, polls the job while it runs.
 * Returns the number of consecutive failed polls. */
export function useJobSync(
  controller: ImportController,
  operation: Operation | null,
  { setOperation, setBusy, setNotice }: Setters,
  log: SafeLog,
): number {
  const [failures, setFailures] = useState(0);
  const [active, setActive] = useState(AppState.currentState === "active");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const resume = () => {
      setBusy(true); // Delete / Refresh stay disabled while the GET runs
      return controller
        .resume()
        .then(setOperation)
        .catch(() =>
          setNotice("Could not reach the server. Tap Refresh to try again."),
        )
        .finally(() => setBusy(false));
    };
    log("relaunch_resume");
    void resume();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active" || state === "background")
        log("app_state", { state });
      setActive(state === "active");
      if (state === "active") {
        setFailures(0);
        void resume();
      }
    });
    return () => subscription.remove();
  }, [controller, setOperation, setBusy, setNotice, log]);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (active && operation && needsPolling(operation)) {
      timer.current = setTimeout(async () => {
        const { operation: next, reachable } = await controller.poll();
        setFailures((previousFailures) =>
          reachable ? 0 : previousFailures + 1,
        );
        setOperation(next);
      }, pollDelay(failures));
    }
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [operation, active, failures, controller, setOperation]);

  return failures;
}
