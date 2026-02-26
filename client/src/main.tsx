import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Auto-inject CSRF token header on all mutating API requests
const originalFetch = window.fetch;
window.fetch = function (input: RequestInfo | URL, init?: RequestInit) {
  if (init?.method && ["POST", "PUT", "DELETE", "PATCH"].includes(init.method.toUpperCase())) {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    if (url.startsWith("/api/")) {
      const match = document.cookie.match(/(?:^|;\s*)csrf-token=([^;]*)/);
      if (match) {
        const headers = new Headers(init.headers);
        headers.set("x-csrf-token", match[1]);
        init = { ...init, headers };
      }
    }
  }
  return originalFetch.call(this, input, init);
};

createRoot(document.getElementById("root")!).render(<App />);
