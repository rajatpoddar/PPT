"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

type PermissionState = "default" | "granted" | "denied" | "unsupported";

/**
 * PushNotificationManager — shows a bell button to enable/disable push notifications.
 * Registers the service worker subscription with the server.
 */
export default function PushNotificationManager() {
  const [permission, setPermission] = useState<PermissionState>("default");
  const [isLoading, setIsLoading] = useState(false);
  const [subscribed, setSubscribed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window) || !("serviceWorker" in navigator)) {
      setPermission("unsupported");
      return;
    }
    setPermission(Notification.permission as PermissionState);

    // Check if already subscribed
    navigator.serviceWorker.ready.then((reg) => {
      reg.pushManager.getSubscription().then((sub) => {
        setSubscribed(!!sub);
      });
    }).catch(() => {});
  }, []);

  async function subscribe() {
    if (!VAPID_PUBLIC_KEY) return;
    setIsLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const perm = await Notification.requestPermission();
      setPermission(perm as PermissionState);
      if (perm !== "granted") return;

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });
      setSubscribed(true);
    } catch (err) {
      console.error("Push subscription failed:", err);
    } finally {
      setIsLoading(false);
    }
  }

  async function unsubscribe() {
    setIsLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) await sub.unsubscribe();
      await fetch("/api/push/subscribe", { method: "DELETE" });
      setSubscribed(false);
    } catch (err) {
      console.error("Unsubscribe failed:", err);
    } finally {
      setIsLoading(false);
    }
  }

  if (permission === "unsupported") return null;

  return (
    <button
      type="button"
      onClick={subscribed ? unsubscribe : subscribe}
      disabled={isLoading || permission === "denied"}
      title={
        permission === "denied"
          ? "Notifications blocked — enable in browser settings"
          : subscribed
          ? "Disable notifications"
          : "Enable notifications"
      }
      aria-label={subscribed ? "Disable push notifications" : "Enable push notifications"}
      className={[
        "flex items-center gap-1.5 rounded-md px-3 py-2 min-h-[44px] text-sm font-medium transition-colors duration-100",
        "focus:outline-none focus:ring-2 focus:ring-offset-1",
        isLoading ? "opacity-50 cursor-not-allowed" : "",
        subscribed
          ? "text-green-600 hover:bg-green-50 focus:ring-green-500"
          : permission === "denied"
          ? "text-gray-400 cursor-not-allowed"
          : "text-gray-600 hover:bg-gray-100 focus:ring-blue-500",
      ].join(" ")}
    >
      {subscribed ? (
        <Bell className="h-4 w-4" aria-hidden="true" />
      ) : (
        <BellOff className="h-4 w-4" aria-hidden="true" />
      )}
      <span className="hidden sm:block">
        {isLoading ? "…" : subscribed ? "Notifications On" : "Enable Notifications"}
      </span>
    </button>
  );
}
