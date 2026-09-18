"use strict";

self.addEventListener("install", event => {
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    self.clients.claim()
  );
});

self.addEventListener("push", event => {
  let data = {};

  try {
    data = event.data
      ? event.data.json()
      : {};
  } catch (error) {
    data = {
      title: "ZakiChat",
      body: event.data
        ? event.data.text()
        : "You have a new notification."
    };
  }

  const title =
    data.title || "ZakiChat";

  const options = {
    body:
      data.body ||
      "You have a new notification.",
    icon:
      "/static/images/icon.jpg",
    badge:
      "/static/images/icon.jpg",
    tag:
      data.notificationId
        ? `zakichat-${data.notificationId}`
        : "zakichat-notification",
    renotify: true,
    data: {
      actorId:
        data.actorId || "",
      conversationId:
        data.conversationId || "",
      messageId:
        data.messageId || "",
      notificationId:
        data.notificationId || ""
    }
  };

  event.waitUntil(
    self.registration.showNotification(
      title,
      options
    )
  );
});

self.addEventListener(
  "notificationclick",
  event => {
    event.notification.close();

    const data =
      event.notification.data || {};

    const actorId =
      data.actorId || "";

    const targetUrl =
      actorId
        ? `/pages/chats.html?user=${encodeURIComponent(
            actorId
          )}`
        : "/pages/notifications.html";

    event.waitUntil(
      self.clients
        .matchAll({
          type: "window",
          includeUncontrolled: true
        })
        .then(clients => {
          for (const client of clients) {
            if ("focus" in client) {
              return client
                .focus()
                .then(() => {
                  if ("navigate" in client) {
                    return client.navigate(
                      targetUrl
                    );
                  }
                });
            }
          }

          if (self.clients.openWindow) {
            return self.clients.openWindow(
              targetUrl
            );
          }

          return undefined;
        })
    );
  }
);
