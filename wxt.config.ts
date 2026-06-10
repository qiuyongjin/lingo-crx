// wxt.config.ts
import { defineConfig } from "wxt";

export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  outDir: "dist",
  manifest: {
    name: "Lingo",
    description: "Click any word to see its Chinese definition",
    permissions: ["storage"],
    host_permissions: ["<all_urls>"],
  },
});
