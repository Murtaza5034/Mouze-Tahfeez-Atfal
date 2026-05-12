import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: "AIzaSyAxoLoIPRZum286Y0uXM3Vq98V3403L7Uo",
  authDomain: "mawaid-b929a.firebaseapp.com",
  projectId: "mawaid-b929a",
  storageBucket: "mawaid-b929a.appspot.com",
  messagingSenderId: "353078822685",
  appId: "1:353078822685:android:8f83b293733213472bc3f4",
  measurementId: "B5W2bPUAQQmqbmDf5lF-6g"
};

// Initialize Firebase
const firebaseApp = initializeApp(firebaseConfig);

// Initialize Firebase Cloud Messaging
const messaging = getMessaging(firebaseApp);

// Get registration token
export const getFCMToken = async () => {
  try {
    console.log('Requesting FCM Token...');
    
    // Explicitly register service worker for official PWA support
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
      console.log('Service Worker registered with scope:', registration.scope);
      
      const currentToken = await getToken(messaging, { 
        vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY || "BGrvEM2dyLW86HLnNNIDibzCT7NHZka42OFBlVxyA86wBieuXZ09vJldEnQazc9h3VQgBbikEh0oqfiG0xeeyfg",
        serviceWorkerRegistration: registration
      });
      
      if (currentToken) {
        console.log('Official FCM Token retrieved:', currentToken);
        return currentToken;
      } else {
        console.log('No registration token available. Permission might be needed.');
        return null;
      }
    } else {
      console.error('Service workers are not supported in this browser.');
      return null;
    }
  } catch (error) {
    console.error('An error occurred while retrieving token: ', error);
    if (error.code === 'messaging/permission-blocked') {
      alert('Notification permission was blocked. Please reset permissions in your browser bar.');
    }
    return null;
  }
};

// Handle incoming messages
export const onMessageListener = () => {
  return new Promise((resolve) => {
    onMessage(messaging, (payload) => {
      console.log('Message received. ', payload);
      resolve(payload);
    });
  });
};

export { messaging };
