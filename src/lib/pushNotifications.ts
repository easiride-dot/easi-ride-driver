import { supabase } from "@/lib/supabase";

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

const urlBase64ToUint8Array = (base64String: string) => {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
};

export const registerServiceWorker = async () => {
  if (!("serviceWorker" in navigator)) return null;
  // Never let the cache-first service worker hijack local dev — it would keep
  // serving a stale bundle and hide every code change from the running app.
  if (import.meta.env.DEV) return null;
  return navigator.serviceWorker.register("/sw.js");
};

export const getExistingPushSubscription = async () => {
  const registration = await navigator.serviceWorker.ready;
  return registration.pushManager.getSubscription();
};

export const subscribeToPushNotifications = async (userId: string) => {
  if (!VAPID_PUBLIC_KEY) {
    throw new Error("VAPID public key is not configured.");
  }
  await registerServiceWorker();
  const registration = await navigator.serviceWorker.ready;

  const existingSubscription = await registration.pushManager.getSubscription();
  const subscription =
    existingSubscription ||
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
    }));

  const subscriptionJson = subscription.toJSON();
  const p256dh = subscriptionJson.keys?.p256dh;
  const auth = subscriptionJson.keys?.auth;

  if (!p256dh || !auth) {
    throw new Error("Browser did not return valid push subscription keys.");
  }

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: userId,
      endpoint: subscription.endpoint,
      p256dh,
      auth,
      user_agent: navigator.userAgent,
    },
    { onConflict: "endpoint" }
  );

  if (error) throw error;
  return subscription;
};
