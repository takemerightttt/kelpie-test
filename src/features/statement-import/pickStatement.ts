import * as DocumentPicker from "expo-document-picker";
import type { FileCheck } from "@/core/fileCheck";

/** Opens the system picker; null when the user cancels. */
export async function pickStatement(): Promise<{
  uri: string;
  name: string;
} | null> {
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
  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0];
  return { uri: asset.uri, name: asset.name };
}

export function rejectNotice(check: Extract<FileCheck, { ok: false }>): string {
  return check.reason === "too_large"
    ? "This file is larger than 10 MiB."
    : "This is not a PDF or CSV statement.";
}
