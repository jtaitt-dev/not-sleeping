import { defineConfig } from "wxt";

export default defineConfig({
  srcDir: "src",
  modules: ["@wxt-dev/module-react"],
  manifestVersion: 3,
  manifest: {
    name: "Not Sleeping",
    short_name: "Not Sleeping",
    description:
      "Independent open-source fantasy football intelligence companion for Sleeper.",
    minimum_chrome_version: "116",
    permissions: ["storage", "sidePanel", "alarms"],
    optional_permissions: ["notifications"],
    host_permissions: [
      "https://api.sleeper.app/*",
      "https://sleeper.com/*",
      "https://*.sleeper.com/*",
      "https://api.open-meteo.com/*",
    ],
    optional_host_permissions: [
      "https://api.openai.com/*",
      "https://api.anthropic.com/*",
      "https://github.com/nflverse/nflverse-data/*",
    ],
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
    side_panel: { default_path: "sidepanel.html" },
    options_ui: { page: "options.html", open_in_tab: true },
    content_security_policy: {
      extension_pages:
        "script-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
    },
  },
});
