const BIOMETRIC_ENABLED_KEY = "mauze-biometric-enabled";
const BIOMETRIC_EMAIL_KEY = "mauze-biometric-email";
const BIOMETRIC_SERVER = "mauze-tahfeez";

function isNative() {
  try {
    return !!(window.Capacitor && window.Capacitor.isNativePlatform());
  } catch {
    return false;
  }
}

export async function isBiometricAvailable() {
  if (isNative()) {
    try {
      const { NativeBiometric } = await import(
        "@capgo/capacitor-native-biometric"
      );
      const result = await NativeBiometric.isAvailable();
      return result.isAvailable;
    } catch {
      return false;
    }
  }

  try {
    if (
      window.PublicKeyCredential &&
      typeof window.PublicKeyCredential
        .isUserVerifyingPlatformAuthenticatorAvailable === "function"
    ) {
      return await window.PublicKeyCredential
        .isUserVerifyingPlatformAuthenticatorAvailable();
    }
  } catch {}
  return false;
}

export async function setBiometricCredentials(email, password) {
  localStorage.setItem(BIOMETRIC_ENABLED_KEY, "true");
  localStorage.setItem(BIOMETRIC_EMAIL_KEY, email);

  if (isNative()) {
    try {
      const { NativeBiometric } = await import(
        "@capgo/capacitor-native-biometric"
      );
      await NativeBiometric.setCredentials({
        username: email,
        password: password,
        server: BIOMETRIC_SERVER,
      });
    } catch (err) {
      console.warn("Failed to save native biometric credentials:", err);
    }
  }
}

export async function getBiometricCredentials() {
  if (isNative()) {
    try {
      const { NativeBiometric } = await import(
        "@capgo/capacitor-native-biometric"
      );
      const credentials = await NativeBiometric.getCredentials({
        server: BIOMETRIC_SERVER,
      });
      return {
        email: credentials.username,
        password: credentials.password,
      };
    } catch (err) {
      if (err.message?.includes("cancel") || err.code === "10") return null;
      console.warn("Failed to get native biometric credentials:", err);
      return null;
    }
  }

  const email = localStorage.getItem(BIOMETRIC_EMAIL_KEY);
  const password = localStorage.getItem("mauze-saved-password");
  if (email && password) {
    return { email, password };
  }
  return null;
}

export async function removeBiometricCredentials() {
  localStorage.removeItem(BIOMETRIC_ENABLED_KEY);
  localStorage.removeItem(BIOMETRIC_EMAIL_KEY);

  if (isNative()) {
    try {
      const { NativeBiometric } = await import(
        "@capgo/capacitor-native-biometric"
      );
      await NativeBiometric.deleteCredentials({ server: BIOMETRIC_SERVER });
    } catch {}
  }
}

export function isBiometricEnabled() {
  return localStorage.getItem(BIOMETRIC_ENABLED_KEY) === "true";
}
