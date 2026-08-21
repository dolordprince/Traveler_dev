export function registerTravelerDevServiceWorker(): void {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  if (!import.meta.env.PROD) {
    return;
  }

  window.addEventListener("load", () => {
    void navigator.serviceWorker.register("/sw.js", {
      scope: "/",
    });
  });
}
