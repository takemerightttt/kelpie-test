import { Directory, File, Paths } from 'expo-file-system';
import type { FileStore } from '../core/controller';

// Private import copies live in the app's own documents folder, so a pending
// retry survives a relaunch, and are deleted as soon as the server has the job,
// on reject, on cancel and on reset.
const importsDir = () => new Directory(Paths.document, 'imports');

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
    const dir = importsDir();
    if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
    const target = new File(dir, key);
    new File(uri).move(target);
    return target.uri;
  },

  async remove(uri) {
    const file = new File(uri);
    if (file.exists) file.delete();
  },
};
