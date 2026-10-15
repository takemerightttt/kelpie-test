import { useState } from "react";
import type { Operation } from "@/core/types";

const DELETING_ANSWERS_LIMIT = 20;

/** True after 20 answers in a row still say "deleting"; polling goes on, the user is only told. */
export function useStillDeleting(operation: Operation | null): boolean {
  const [seen, setSeen] = useState<{
    operation: Operation | null;
    count: number;
  }>({ operation, count: 0 });
  if (seen.operation !== operation)
    setSeen({
      operation,
      count: operation?.job?.status === "deleting" ? seen.count + 1 : 0,
    });
  return seen.count >= DELETING_ANSWERS_LIMIT;
}
