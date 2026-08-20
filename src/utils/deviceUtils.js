// Device and browser capability detection for iOS, Android, PWA, Safari, Chrome

export function isCapacitor() {
  return !!(typeof window !== 'undefined' && window.Capacitor && window.Capacitor.isNativePlatform);
}

export function isNativeAndroid() {
  return isCapacitor() && window.Capacitor.getPlatform() === 'android';
}

export function getDeviceInfo() {
  if (typeof window === 'undefined') {
    return {
      isIOS: false,
      isStandalone: false,
      isChromeIOS: false,
      isSafariIOS: false,
      hasNotification: false,
      hasServiceWorker: false,
      hasPushManager: false,
      canWebPush: false,
      isNative: false
    };
  }
  const ua = navigator.userAgent || '';
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isChromeIOS = isIOS && /CriOS/i.test(ua);
  const isSafariIOS = isIOS && !isChromeIOS && /Safari/i.test(ua);
  const isStandalone = !!(
    window.navigator.standalone ||
    (typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches)
  );
  const hasNotification = 'Notification' in window;
  const hasServiceWorker = 'serviceWorker' in navigator;
  const hasPushManager = 'PushManager' in window;

  return {
    isIOS,
    isChromeIOS,
    isSafariIOS,
    isStandalone,
    hasNotification,
    hasServiceWorker,
    hasPushManager,
    isNative: isCapacitor() && window.Capacitor.isNativePlatform,
    canWebPush: hasNotification && hasServiceWorker && (hasPushManager || isStandalone || !isIOS)
  };
}

export function isIOS() {
  return getDeviceInfo().isIOS;
}

export function isStandalone() {
  return getDeviceInfo().isStandalone;
}
