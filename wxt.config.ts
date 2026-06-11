// wxt.config.ts
import { defineConfig } from "wxt";

export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  outDir: "dist",
  manifest: {
    name: "Lingo",
    description: "Click any word to see its Chinese definition",
    permissions: ["storage", "sidePanel"],
    host_permissions: ["<all_urls>"],
    commands: {
      "toggle-side-panel": {
        suggested_key: {
          default: "Alt+L",
        },
        description: "Toggle the side panel",
      },
    },
    icons: {
      16: "icons/icon-16.png",
      32: "icons/icon-32.png",
      48: "icons/icon-48.png",
      128: "icons/icon-128.png",
    },
  },
});
