// Google Play In-App Updates — official Android API.
//
// This module drives Google's own update UI through
// `@capawesome/capacitor-app-update`, a thin Capacitor bridge over Google's
// official `com.google.android.play:app-update` library:
//   https://developer.android.com/guide/playcore/in-app-updates
//
// Behaviour on Android (app installed from Google Play):
//   * an available update opens Google's update flow — either the blocking
//     "immediate" screen or a background "flexible" download;
//   * a flexible download that already finished is applied on the next launch;
//   * an immediate flow interrupted by the user or a process kill is resumed
//     when the app starts again.
//
// When Play reports no update (or the API is unavailable — web, iOS,
// sideloaded APK, no Play Services, offline, older build without the native
// plugin) this module does nothing at all and never throws, so the custom
// in-app popup (AppUpdatePopup) keeps working exactly as before.
//
// Nothing here is trusted to the network or to user input: the Play API is
// signed and verified by Google Play Store itself, and we only ever ask it to
// install a release Google already published to a track this install belongs
// to. Only the boolean "an update flow is on screen" leaves this module.

const LOG_PREFIX = "[AppUpdate]";

// "immediate"  → show Google's blocking update screen whenever Play allows it.
// "flexible"   → download in the background and restart when it is ready,
//                using the blocking screen only for critical updates.
const UPDATE_STRATEGY = "immediate";

// Priority (0-5, set per release in Play Console) that counts as critical.
// Only consulted when UPDATE_STRATEGY is "flexible".
const CRITICAL_UPDATE_PRIORITY = 4;

// Minimum gap between two Play update checks (the app also re-checks whenever
// it is brought back to the foreground, which is what Google recommends).
const RECHECK_COOLDOWN_MS = 2 * 60 * 1000;

// Never let the Play check block the rest of the app for longer than this.
const CHECK_TIMEOUT_MS = 8000;

// Values from Google's own model classes:
//   com.google.android.play.core.install.model.UpdateAvailability
//   com.google.android.play.core.install.model.InstallStatus
//   com.google.android.play.core.install.model.ActivityResult
const UPDATE_AVAILABILITY = {
  UPDATE_AVAILABLE: 2,
  // DEVELOPER_TRIGGERED_UPDATE_IN_PROGRESS — an immediate flow was started
  // but never finished (user backed out or the process was killed).
  UPDATE_IN_PROGRESS: 3,
};

const INSTALL_STATUS = {
  // The bytes are downloaded and the update only needs to be installed.
  DOWNLOADED: 11,
};

const RESULT_CODE = {
  OK: 0,
  CANCELED: 1,
  FAILED: 2,
};

let plugin = null;
let pluginLoadAttempted = false;
let updateHandled = false;
let checkRunning = false;
let lastCheckAt = 0;
let startupPromise = null;

function isAndroidNative() {
  try {
    const capacitor = typeof window !== "undefined" ? window.Capacitor : undefined;
    if (!capacitor || typeof capacitor.isNativePlatform !== "function") return false;
    return capacitor.isNativePlatform() === true && capacitor.getPlatform() === "android";
  } catch (_) {
    return false;
  }
}

function describeError(error) {
  return (error && (error.message || error.errorMessage)) || String(error);
}

function delay(ms) {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    // Node keeps the process alive for pending timers; browsers have no unref.
    if (timer && typeof timer.unref === "function") timer.unref();
  });
}

async function loadPlugin() {
  if (pluginLoadAttempted) return plugin;
  pluginLoadAttempted = true;
  try {
    // The specifier must stay a literal so the bundler can code-split it.
    plugin = await import("@capawesome/capacitor-app-update");
  } catch (error) {
    plugin = null;
    console.warn(`${LOG_PREFIX} native plugin unavailable:`, describeError(error));
  }
  return plugin;
}

/**
 * Pure decision table — given a Play `AppUpdateInfo` payload, what should the
 * app do? Kept side-effect free so it can be tested without a device.
 *
 * @returns {"complete-flexible"|"immediate"|"flexible"|"none"}
 */
export function decideUpdateAction(info, strategy = UPDATE_STRATEGY, criticalPriority = CRITICAL_UPDATE_PRIORITY) {
  if (!info || typeof info !== "object") return "none";

  const immediateAllowed = info.immediateUpdateAllowed === true;
  const flexibleAllowed = info.flexibleUpdateAllowed === true;
  const priority = Number(info.updatePriority) || 0;
  const wantsImmediate = strategy === "immediate" || priority >= criticalPriority;

  // A flexible download already finished — install it and restart.
  if (info.installStatus === INSTALL_STATUS.DOWNLOADED) {
    return "complete-flexible";
  }

  // A flow was interrupted before it finished; pick it back up.
  if (info.updateAvailability === UPDATE_AVAILABILITY.UPDATE_IN_PROGRESS) {
    if (wantsImmediate && immediateAllowed) return "immediate";
    if (flexibleAllowed) return "flexible";
    return "none";
  }

  if (info.updateAvailability !== UPDATE_AVAILABILITY.UPDATE_AVAILABLE) return "none";

  if (wantsImmediate && immediateAllowed) return "immediate";
  if (flexibleAllowed) return "flexible";
  return "none";
}

function logUpdateInfo(reason, info) {
  console.log(`${LOG_PREFIX} check (${reason})`, {
    installedVersionCode: info.currentVersionCode,
    installedVersionName: info.currentVersionName,
    availableVersionCode: info.availableVersionCode,
    updateAvailability: info.updateAvailability,
    installStatus: info.installStatus,
    updatePriority: info.updatePriority,
    immediateUpdateAllowed: info.immediateUpdateAllowed,
    flexibleUpdateAllowed: info.flexibleUpdateAllowed,
  });
}

async function performImmediateUpdate() {
  try {
    const result = await plugin.AppUpdate.performImmediateUpdate();
    const code = result && result.code;
    if (code === RESULT_CODE.OK) {
      // Google Play has installed the update and is restarting the app.
      console.log(`${LOG_PREFIX} immediate update installed — the app will restart`);
    } else if (code === RESULT_CODE.CANCELED) {
      console.warn(`${LOG_PREFIX} update screen dismissed by the user; it will be offered again next launch`);
    } else {
      console.warn(`${LOG_PREFIX} immediate update not performed (code ${code})`);
    }
  } catch (error) {
    console.warn(`${LOG_PREFIX} immediate update failed:`, describeError(error));
  }
}

async function completeFlexibleUpdate() {
  try {
    // Installs the downloaded update and restarts the app.
    await plugin.AppUpdate.completeFlexibleUpdate();
    console.log(`${LOG_PREFIX} flexible update installed — the app will restart`);
  } catch (error) {
    console.warn(`${LOG_PREFIX} completing the flexible update failed:`, describeError(error));
  }
}

async function removeFlexibleListener() {
  try {
    await plugin?.AppUpdate?.removeAllListeners();
  } catch (_) {
    // Nothing to clean up.
  }
}

async function startFlexibleUpdate() {
  try {
    await plugin.AppUpdate.addListener("onFlexibleUpdateStateChange", (state) => {
      if (state && state.installStatus === INSTALL_STATUS.DOWNLOADED) {
        completeFlexibleUpdate();
      }
    });
    const result = await plugin.AppUpdate.startFlexibleUpdate();
    const code = result && result.code;
    if (code !== RESULT_CODE.OK) {
      console.warn(`${LOG_PREFIX} flexible update not started (code ${code})`);
      await removeFlexibleListener();
    }
  } catch (error) {
    console.warn(`${LOG_PREFIX} flexible update failed:`, describeError(error));
    await removeFlexibleListener();
  }
}

async function checkForUpdate(reason) {
  if (updateHandled || checkRunning || !plugin) return;
  if (Date.now() - lastCheckAt < RECHECK_COOLDOWN_MS) return;

  checkRunning = true;
  lastCheckAt = Date.now();

  try {
    const info = await plugin.AppUpdate.getAppUpdateInfo();
    logUpdateInfo(reason, info);

    const action = decideUpdateAction(info);
    if (action === "none") return;

    // Mark as handled before the flow opens so nothing else prompts for the
    // same update (and so the resume listener stays quiet).
    updateHandled = true;

    if (action === "complete-flexible") await completeFlexibleUpdate();
    else if (action === "immediate") await performImmediateUpdate();
    else await startFlexibleUpdate();
  } catch (error) {
    // Fail soft: not installed from Google Play, Play Services missing,
    // offline, or a build without the native plugin.
    console.warn(`${LOG_PREFIX} update check skipped (${reason}):`, describeError(error));
  } finally {
    checkRunning = false;
  }
}

function handleAppResumed() {
  checkForUpdate("resume");
}

/**
 * Starts the Play in-app update flow. Safe to call once at app startup on any
 * platform: it is a no-op outside Android and it never rejects.
 *
 * @returns {Promise<boolean>} true when the Android plugin was available.
 */
export function initNativeAppUpdate() {
  if (!isAndroidNative()) return Promise.resolve(false);
  if (startupPromise) return startupPromise;

  startupPromise = (async () => {
    const loaded = await loadPlugin();
    if (!loaded) return false;

    // Google recommends re-checking whenever the app comes back to the
    // foreground — the native side raises this event on every onResume.
    try {
      window.addEventListener("mauze-app-resumed", handleAppResumed);
    } catch (_) {
      // Non-browser environment; the startup check still runs.
    }

    const timeout = delay(CHECK_TIMEOUT_MS);
    await Promise.race([checkForUpdate("startup"), timeout]);
    return true;
  })();

  return startupPromise;
}

/**
 * Resolves to true when the Play flow is showing/handling an update, so other
 * update prompts should stand down for this session. Never rejects, and is
 * bounded in time so it cannot stall a fallback reminder.
 */
export async function isNativeUpdateTakingOver() {
  if (!startupPromise) return false;
  await Promise.race([
    startupPromise.catch(() => false),
    delay(CHECK_TIMEOUT_MS),
  ]);
  return updateHandled;
}
