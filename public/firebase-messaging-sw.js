/* global importScripts, firebase, self */

importScripts("https://www.gstatic.com/firebasejs/12.10.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.10.0/firebase-messaging-compat.js");

// 🔥 Get config from URL params (from your firebase.js)
const params = new URL(self.location.href).searchParams;

const firebaseConfig = {
  apiKey: params.get("apiKey"),
  authDomain: params.get("authDomain"),
  projectId: params.get("projectId"),
  storageBucket: params.get("storageBucket"),
  messagingSenderId: params.get("messagingSenderId"),
  appId: params.get("appId"),
};

// 🔥 Initialize Firebase safely
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const messaging = firebase.messaging();

// ==============================
// 🔔 BACKGROUND NOTIFICATION
// ==============================
messaging.onBackgroundMessage((payload) => {
  console.log("📩 Background message:", payload);

  const title = payload?.notification?.title || "BMSCE Buzz 🔥";

  const options = {
    body: payload?.notification?.body || "New update available",
    icon: "/logo192.png",
    data: payload?.data || {},
  };

  self.registration.showNotification(title, options);
});

// ==============================
// 🔁 HANDLE NOTIFICATION CLICK
// ==============================
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const urlToOpen = "/"; // you can change this later

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // If app already open → focus it
      for (const client of clientList) {
        if (client.url === urlToOpen && "focus" in client) {
          return client.focus();
        }
      }
      // Else open new tab
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});