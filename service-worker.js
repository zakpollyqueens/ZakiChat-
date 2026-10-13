"use strict";

const CACHE_NAME = "molan-chat-shell-v6-brand-refresh";
const CORE_ASSETS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/static/images/zamivox-icon.svg",
  "/pages/chats.html",
  "/pages/chat.html",
  "/pages/settings.html",
  "/pages/message-expiry.html",
  "/pages/updates.html",
  "/static/css/main.css",
  "/static/css/signature-theme.css",
  "/static/js/telegram-chat.js",
  "/static/js/message-expiry.js",
  "/static/js/data-storage.js",
  "/static/js/zaki-ringtones.js"
];

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // Keep installation resilient if an optional page/file is not present in a deployment.
    await Promise.all(CORE_ASSETS.map(async url => {
      try {
        const response = await fetch(url, { cache: "reload" });
        if (response.ok) await cache.put(url, response);
      } catch (_) {}
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => (key.startsWith("zakichat-shell-") || key.startsWith("zamivox-shell-")) && key !== CACHE_NAME)
      .map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never cache API/auth/database responses: private chat data must be cached by the
  // signed-in app code, not shared by the service worker across accounts.
  if (/\/rest\/v1\/|\/auth\/v1\/|\/functions\/v1\/|\/realtime\/v1\//i.test(url.pathname)) return;

  if (request.mode === "navigate") {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        const response = await fetch(request);
        if (response.ok) await cache.put(request, response.clone());
        return response;
      } catch (_) {
        const exact = await cache.match(request);
        if (exact) return exact;
        const path = url.pathname;
        const fallback = await cache.match(path);
        if (fallback) return fallback;
        return (await cache.match("/index.html")) ||
          new Response("Molan Chat is offline. Open the app once while connected to prepare offline access.", {
            status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" }
          });
      }
    })());
    return;
  }

  const isAsset = /\.(?:css|js|mjs|png|jpe?g|webp|svg|gif|ico|woff2?|ttf|json|mp3|ogg|wav)$/i.test(url.pathname);
  if (!isAsset) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    if (cached) {
      event.waitUntil(fetch(request).then(response => {
        if (response.ok) return cache.put(request, response.clone());
      }).catch(() => {}));
      return cached;
    }
    try {
      const response = await fetch(request);
      if (response.ok) await cache.put(request, response.clone());
      return response;
    } catch (_) {
      return new Response("", { status: 504, statusText: "Offline asset unavailable" });
    }
  })());
});

self.addEventListener("push", event => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (error) {
    data = { title: "Molan Chat", body: event.data ? event.data.text() : "You have a new notification." };
  }

  const title = data.title || "Molan Chat";
  const options = {
    body: data.body || "You have a new notification.",
    icon: "/static/images/zamivox-icon.svg",
    badge: "/static/images/zamivox-icon.svg",
    tag: data.notificationId ? `zakichat-${data.notificationId}` : "zakichat-notification",
    renotify: true,
    actions: [{ action: "reply", title: "Reply" }, { action: "open", title: "Open" }],
    data: {
      actorId: data.actorId || "",
      conversationId: data.conversationId || "",
      messageId: data.messageId || "",
      notificationId: data.notificationId || ""
    }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const data = event.notification.data || {};
  const replyMode = event.action === "reply";
  const targetUrl = data.conversationId
    ? `/pages/chat.html?id=${encodeURIComponent(data.conversationId)}${replyMode && data.messageId ? `&replyMessageId=${encodeURIComponent(data.messageId)}` : ""}`
    : data.actorId
      ? `/pages/contacts.html?user=${encodeURIComponent(data.actorId)}`
      : "/pages/notifications.html";

  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async clients => {
    for (const client of clients) {
      if ("focus" in client) {
        await client.focus();
        if ("navigate" in client) await client.navigate(targetUrl);
        return;
      }
    }
    if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
  }));
});
