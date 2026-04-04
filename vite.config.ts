import { defineConfig, type Plugin, type TransformResult } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

type TransformFn = (
  this: unknown,
  code: string,
  id: string,
  options?: { ssr?: boolean },
) => TransformResult | Promise<TransformResult>;

interface ObjectHook {
  handler: TransformFn;
  order?: "pre" | "post" | null;
  enforce?: "pre" | "post";
}

function excludeFromPlugin(plugin: Plugin, excludePattern: RegExp): Plugin {
  const originalTransform = plugin.transform;

  if (typeof originalTransform === "function") {
    const orig = originalTransform as TransformFn;
    plugin.transform = function (this: unknown, code: string, id: string, options?: { ssr?: boolean }) {
      if (excludePattern.test(id)) return null;
      return orig.call(this, code, id, options);
    } as any;
  } else if (
    originalTransform &&
    typeof originalTransform === "object" &&
    "handler" in originalTransform &&
    typeof (originalTransform as ObjectHook).handler === "function"
  ) {
    const hook = originalTransform as ObjectHook;
    const origHandler = hook.handler;
    hook.handler = function (this: unknown, code: string, id: string, options?: { ssr?: boolean }) {
      if (excludePattern.test(id)) return null;
      return origHandler.call(this, code, id, options);
    } as any;
  }

  return plugin;
}

export default defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    tailwindcss(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            excludeFromPlugin(
              m.cartographer(),
              /[\\/]scene[\\/]/,
            ),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  css: {
    postcss: {
      plugins: [],
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    host: "0.0.0.0",
    allowedHosts: true,
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
