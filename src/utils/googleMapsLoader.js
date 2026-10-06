/**
 * Asynchronous Google Maps JavaScript API Loader with Singleton Promise Cache
 */
let googleMapsPromise = null;

export function loadGoogleMapsApi(apiKey = null) {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google Maps cannot be loaded on server side"));
  }

  // Already loaded
  if (window.google && window.google.maps) {
    return Promise.resolve(window.google.maps);
  }

  // Already loading
  if (googleMapsPromise) {
    return googleMapsPromise;
  }

  const resolvedKey =
    apiKey ||
    import.meta.env.VITE_GOOGLE_MAPS_API_KEY ||
    import.meta.env.VITE_FIREBASE_API_KEY ||
    window.GOOGLE_MAPS_API_KEY ||
    "AIzaSyAxoLoIPRZum286Y0uXM3Vq98V3403L7Uo";

  googleMapsPromise = new Promise((resolve, reject) => {
    // Check if script element already exists in document
    const existingScript = document.querySelector('script[src*="maps.googleapis.com/maps/api/js"]');
    if (existingScript) {
      let attempts = 0;
      const interval = setInterval(() => {
        attempts++;
        if (window.google && window.google.maps) {
          clearInterval(interval);
          resolve(window.google.maps);
        } else if (attempts > 50) {
          clearInterval(interval);
          reject(new Error("Timeout waiting for existing Google Maps script to initialize"));
        }
      }, 100);
      return;
    }

    const callbackName = `__initGoogleMapsCallback_${Date.now()}`;
    window[callbackName] = () => {
      try {
        delete window[callbackName];
      } catch (_) {}
      if (window.google && window.google.maps) {
        resolve(window.google.maps);
      } else {
        reject(new Error("Google Maps object not found after script load"));
      }
    };

    const script = document.createElement("script");
    script.type = "text/javascript";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
      resolvedKey
    )}&libraries=places,geometry&callback=${callbackName}&loading=async`;
    script.async = true;
    script.defer = true;
    script.onerror = (err) => {
      try {
        delete window[callbackName];
      } catch (_) {}
      googleMapsPromise = null; // allow retry
      reject(err);
    };

    document.head.appendChild(script);
  });

  return googleMapsPromise;
}
