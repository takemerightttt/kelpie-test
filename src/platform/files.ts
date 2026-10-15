import Constants from "expo-constants";
import { Directory, File, Paths } from "expo-file-system";
import { Platform } from "react-native";
import type { FileStore } from "@/core/controller";

// Private import copies live in the app's own documents folder, so a pending
// retry survives a relaunch, and are deleted as soon as the server has the job,
// on reject, on cancel and on reset.
const importsDirectory = () => new Directory(Paths.document, "imports");

const inboxDirectory = () => {
  const bundleId =
    Constants.expoConfig?.ios?.bundleIdentifier ??
    "com.kuliaev.kelpiestatementimport";
  // Paths.document = <container>/Documents; the Inbox lives in <container>/tmp/<bundleId>-Inbox
  return new Directory(
    Paths.document.parentDirectory,
    "tmp",
    `${bundleId}-Inbox`,
  );
};

export const deviceFiles: FileStore = {
  async inspect(uri, headBytes) {
    const file = new File(uri);
    const size = file.size ?? 0;
    const handle = file.open();
    try {
      return { size, head: handle.readBytes(Math.min(headBytes, size)) };
    } finally {
      handle.close();
    }
  },

  async keepPrivate(uri, key) {
    const directory = importsDirectory();
    if (!directory.exists)
      directory.create({ intermediates: true, idempotent: true });
    const target = new File(directory, key);
    new File(uri).move(target);
    return target.uri;
  },

  async remove(uri) {
    const file = new File(uri);
    if (file.exists) file.delete();
  },

  async listPrivate() {
    const directory = importsDirectory();
    if (!directory.exists) return [];
    return directory
      .list()
      .filter((entry) => entry instanceof File)
      .map((entry) => entry.uri);
  },

  // The iOS picker (asCopy) leaves its own copy in tmp/<bundleId>-Inbox before expo-document-picker
  // copies it to the cache. The Inbox folder itself belongs to the system and stays.
  async removeSystemCopies() {
    if (Platform.OS !== "ios") return;
    const directory = inboxDirectory();
    if (!directory.exists) return;
    for (const entry of directory.list()) entry.delete();
  },
};
