// Service worker dédié aux notifications push de l'app employé (/moi).
// Enregistré côté client par components/moi/NotificationsPush.jsx.

self.addEventListener("push", (event) => {
  let data = { titre: "Gozly", corps: "Nouveau message.", url: "/moi/discussion" };
  try {
    data = { ...data, ...event.data.json() };
  } catch {}

  event.waitUntil(
    self.registration.showNotification(data.titre, {
      body: data.corps,
      // icon : la grande image dans la notification (l'icône de l'app, en couleur).
      // badge : la petite icône de la barre d'état Android. Elle doit être blanche sur fond transparent
      // (Android n'en garde que la forme) - sinon il la remplace par l'icône du navigateur.
      icon: "/icone-app-192",
      badge: "/notif-badge.png",
      data: { url: data.url },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/moi/discussion";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(url) && "focus" in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
