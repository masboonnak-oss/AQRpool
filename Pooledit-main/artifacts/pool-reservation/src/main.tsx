import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { setAuthTokenGetter, setBaseUrl } from "@workspace/api-client-react";
import App from "./App";
import "./index.css";

// Set up the API client token getter
setAuthTokenGetter(() => localStorage.getItem("pool_token"));
setBaseUrl(import.meta.env.BASE_URL);

// ── Franchise branch switcher (super_admin) ───────────────────────────────
// Tag every same-origin /api request with the chosen branch so existing raw
// fetch() calls are scoped without per-call edits. Non-super-admins: the server
// ignores this header and confines them to their own branch.
const ACTIVE_BRANCH_KEY = "aquarich_active_branch";
const _origFetch = window.fetch.bind(window);
window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
  try {
    const branch = localStorage.getItem(ACTIVE_BRANCH_KEY);
    if (branch) {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : (input as Request).url;
      if (url && url.includes("/api/")) {
        const headers = new Headers(init?.headers || (input instanceof Request ? (input as Request).headers : undefined));
        headers.set("X-Branch-Id", branch);
        return _origFetch(input as RequestInfo, { ...(init || {}), headers });
      }
    }
  } catch { /* fall through to a normal fetch */ }
  return _origFetch(input as RequestInfo, init);
}) as typeof window.fetch;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

// PWA: register the (network-first) service worker in production only, so dev HMR
// is never intercepted. Failures are non-fatal — the app works fine without it.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {});
  });
} else if (!import.meta.env.PROD && "serviceWorker" in navigator) {
  // Dev: a service worker left over from a previous production build on this origin
  // would intercept requests and serve a stale app ("nothing updates"). Proactively
  // unregister it and wipe its caches so dev always reflects the latest code.
  navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => r.unregister())).catch(() => {});
  if (typeof caches !== "undefined") {
    caches.keys().then((ks) => ks.forEach((k) => caches.delete(k))).catch(() => {});
  }
}