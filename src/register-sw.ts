export function registerServiceWorker(): void {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  if (import.meta.env.DEV) {
    return;
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js", {
      scope: "/",
    }).catch((error) => {
      console.error("Traveler.dev service worker registration failed", error);
    });
  });
}
