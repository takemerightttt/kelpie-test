import AsyncStorage from "@react-native-async-storage/async-storage";
import type { OperationStore } from "../core/controller";
import type { Operation } from "../core/types";

const KEY = "kelpie.import.v1";

export const deviceStore: OperationStore = {
  async load() {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Operation) : null;
  },
  async save(op) {
    if (op) await AsyncStorage.setItem(KEY, JSON.stringify(op));
    else await AsyncStorage.removeItem(KEY);
  },
};
