import { defineConfig } from "wxt";
import { resolve } from "node:path";

const buildFlavor =
  process.env["NOT_SLEEPING_BUILD_FLAVOR"] === "labs" ? "labs" : "core";

export default defineConfig({
  srcDir: "src",
  modules: ["@wxt-dev/module-react"],
  manifestVersion: 3,
  manifest: {
    name: buildFlavor === "labs" ? "Not Sleeping Labs" : "Not Sleeping",
    short_name: "Not Sleeping",
    description:
      "Independent open-source fantasy football intelligence companion for Sleeper.",
    minimum_chrome_version: "116",
    permissions: ["storage", "sidePanel", "activeTab", "alarms"],
    optional_permissions: ["notifications"],
    host_permissions: [
      "https://api.sleeper.app/*",
      "https://sleeper.com/*",
      "https://*.sleeper.com/*",
      "https://api.openai.com/*",
      "https://api.anthropic.com/*",
      "https://api.open-meteo.com/*",
    ],
    optional_host_permissions: ["https://github.com/nflverse/nflverse-data/*"],
    action: {
      default_title: "Not Sleeping",
      default_popup: "popup.html",
      default_icon: {
        "16": "icons/icon-16.png",
        "32": "icons/icon-32.png",
        "48": "icons/icon-48.png",
        "128": "icons/icon-128.png",
      },
    },
    icons: {
      "16": "icons/icon-16.png",
      "32": "icons/icon-32.png",
      "48": "icons/icon-48.png",
      "128": "icons/icon-128.png",
    },
    side_panel: {
      default_path: "sidepanel.html",
    },
    options_ui: {
      page: "options.html",
      open_in_tab: true,
    },
    content_security_policy: {
      extension_pages:
        "script-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
    },
  },
  vite: () => ({
    define: {
      __NOT_SLEEPING_BUILD_FLAVOR__: JSON.stringify(buildFlavor),
    },
    plugins: [
      {
        name: "not-sleeping-build-flavor-module",
        enforce: "pre",
        resolveId(source) {
          if (source !== "virtual:not-sleeping-labs-workspace") return null;
          return resolve(
            import.meta.dirname,
            buildFlavor === "core"
              ? "src/features/labs/core-stub.tsx"
              : "src/features/labs/parlay-lab-workspace.tsx",
          );
        },
      },
    ],
  }),
});
