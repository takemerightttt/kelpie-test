// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*", "mock-kit/*"],
  },
  {
    // src/core is pure TypeScript tested in Node: no React Native or Expo.
    files: ["src/core/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "react-native",
                "react-native/*",
                "react-native-*",
                "@react-native/*",
                "@react-native-*/*",
                "expo",
                "expo/*",
                "expo-*",
                "@expo/*",
              ],
              message: "src/core must not depend on React Native or Expo; use an adapter in src/platform.",
            },
          ],
        },
      ],
    },
  },
]);
