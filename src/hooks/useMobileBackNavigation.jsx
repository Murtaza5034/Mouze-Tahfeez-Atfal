import React, { useState, useEffect, useRef, useCallback } from "react";
import { ChevronLeft } from "lucide-react";

/**
 * Checks if current page is the root/home page for the given portal role
 */
export function isRootPageForRole(page, role) {
  if (!page) return true;
  const p = String(page).toLowerCase();
  if (role === "admin" || role === "kibar-admin") {
    return p === "overview" || p === "home";
  }
  return p === "home";
}

/**
 * Helper to get default root page for role
 */
export function getRootPageForRole(role) {
  if (role === "admin" || role === "kibar-admin") {
    return "Overview";
  }
  return "Home";
}

/**
 * useMobileBackNavigation
 *
 * Provides full mobile back navigation support:
 * 1. Hardware/Android Back Button (@capacitor/app)
 * 2. Browser / PWA popstate history navigation
 * 3. Left Edge Swipe-to-Back Gesture with glowing gold chevron feedback
 * 4. Modal Dismissal Priority: Closes active overlays/drawers before navigating
 * 5. Native Background Minimization: App.minimizeApp() when pressing back on Home
 * 6. Directional page transition state ('back' | 'forward')
 */
export function useMobileBackNavigation({
  activePage,
  setActivePage,
  portalRole = "parents",
  modals = [],
  isAppLocked = false,
  reduceAnimations = false,
}) {
  const [transitionDirection, setTransitionDirection] = useState("");
  const [swipeState, setSwipeState] = useState({
    active: false,
    progress: 0, // 0 to 1
    travel: 0,   // px
  });

  const historyStackRef = useRef([activePage || getRootPageForRole(portalRole)]);
  const isNavigatingBackRef = useRef(false);
  const transitionTimerRef = useRef(null);
  const portalRoleRef = useRef(portalRole);
  const modalsRef = useRef(modals);
  const activePageRef = useRef(activePage);

  // Keep refs in sync
  useEffect(() => {
    portalRoleRef.current = portalRole;
  }, [portalRole]);

  useEffect(() => {
    modalsRef.current = modals;
  }, [modals]);

  useEffect(() => {
    activePageRef.current = activePage;
  }, [activePage]);

  // Handle page changes & maintain history stack
  useEffect(() => {
    if (!activePage) return;

    if (isNavigatingBackRef.current) {
      // Completed back navigation
      isNavigatingBackRef.current = false;
      setTransitionDirection("back");
    } else {
      // Forward or direct tab navigation
      const currentStack = historyStackRef.current;
      const lastPage = currentStack[currentStack.length - 1];

      if (lastPage !== activePage) {
        // Limit stack size to 30 items
        const nextStack = [...currentStack.slice(-29), activePage];
        historyStackRef.current = nextStack;
        setTransitionDirection("forward");

        // Sync browser history state for web/PWA
        try {
          if (typeof window !== "undefined" && window.history?.pushState) {
            window.history.pushState(
              { page: activePage, role: portalRole, timestamp: Date.now() },
              "",
              window.location.href
            );
          }
        } catch (_) {}
      }
    }

    // Reset transition direction class after animation finishes
    if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
    transitionTimerRef.current = setTimeout(() => {
      setTransitionDirection("");
    }, 400);

    return () => {
      if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
    };
  }, [activePage, portalRole]);

  // Reset history stack when portal role changes
  useEffect(() => {
    const rootPage = getRootPageForRole(portalRole);
    historyStackRef.current = [activePage || rootPage];
  }, [portalRole]);

  /**
   * Unified goBack handler
   */
  const goBack = useCallback(() => {
    if (isAppLocked) return false;

    // 1. Check open modals hierarchy first (close topmost modal)
    const activeModals = modalsRef.current || [];
    for (let i = 0; i < activeModals.length; i++) {
      const modal = activeModals[i];
      if (modal && modal.isOpen) {
        if (typeof modal.close === "function") {
          modal.close();
          return true;
        }
      }
    }

    const currentRole = portalRoleRef.current;
    const rootPage = getRootPageForRole(currentRole);
    const stack = historyStackRef.current;

    // 2. If history stack has pages to go back to
    if (stack.length > 1) {
      const newStack = [...stack];
      newStack.pop(); // Remove current page
      const prevPage = newStack[newStack.length - 1];
      historyStackRef.current = newStack;

      isNavigatingBackRef.current = true;
      setTransitionDirection("back");
      setActivePage(prevPage);
      return true;
    }

    // 3. If stack is at 1 item but user is not on Root/Home page
    const currentPage = activePageRef.current;
    if (!isRootPageForRole(currentPage, currentRole)) {
      historyStackRef.current = [rootPage];
      isNavigatingBackRef.current = true;
      setTransitionDirection("back");
      setActivePage(rootPage);
      return true;
    }

    // 4. On Root/Home page with no modals open -> Minimize app on native mobile
    if (typeof window !== "undefined") {
      const isNative = !!(window.Capacitor?.isNativePlatform?.());
      if (isNative) {
        import("@capacitor/app")
          .then(({ App }) => {
            App.minimizeApp().catch(() => {});
          })
          .catch(() => {});
        return true;
      }
    }

    return false;
  }, [isAppLocked, setActivePage]);

  // Capacitor Hardware Back Button Listener
  useEffect(() => {
    if (typeof window === "undefined") return;

    let appListenerHandle = null;
    let isSubscribed = true;

    import("@capacitor/app")
      .then(({ App }) => {
        if (!isSubscribed) return;
        App.addListener("backButton", ({ canGoBack }) => {
          goBack();
        })
          .then((handle) => {
            if (isSubscribed) {
              appListenerHandle = handle;
            } else if (handle?.remove) {
              handle.remove();
            }
          })
          .catch(() => {});
      })
      .catch(() => {});

    return () => {
      isSubscribed = false;
      if (appListenerHandle?.remove) {
        appListenerHandle.remove();
      }
    };
  }, [goBack]);

  // Browser / PWA Popstate Listener
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handlePopState = (e) => {
      // When browser back is pressed, run our unified goBack
      const handled = goBack();
      if (!handled && e.state?.page) {
        // Fallback: If stack was empty but state had page, set it
        setActivePage(e.state.page);
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [goBack, setActivePage]);

  // Left Edge Swipe-to-Back Gesture Detection
  useEffect(() => {
    if (typeof window === "undefined") return;

    let touchStartX = 0;
    let touchStartY = 0;
    let isEdgeSwipe = false;
    let isSwipeCancelled = false;

    const SWIPE_MAX_START_X = 45; // Start within 45px of screen left edge
    const SWIPE_TRIGGER_THRESHOLD = 70; // px travel needed to trigger
    const SWIPE_MAX_TRAVEL = 130; // Max visual elastic travel

    const handleTouchStart = (e) => {
      if (!e.touches || e.touches.length !== 1) return;
      const touch = e.touches[0];

      // Only on mobile / tablet screens (< 1024px)
      if (window.innerWidth > 1024) return;

      if (touch.clientX <= SWIPE_MAX_START_X) {
        touchStartX = touch.clientX;
        touchStartY = touch.clientY;
        isEdgeSwipe = true;
        isSwipeCancelled = false;
      } else {
        isEdgeSwipe = false;
      }
    };

    const handleTouchMove = (e) => {
      if (!isEdgeSwipe || isSwipeCancelled || !e.touches || e.touches.length !== 1) return;
      const touch = e.touches[0];
      const dx = touch.clientX - touchStartX;
      const dy = touch.clientY - touchStartY;

      // If user is scrolling vertically, cancel gesture
      if (Math.abs(dy) > Math.abs(dx) * 1.3 && dx < 25) {
        isSwipeCancelled = true;
        setSwipeState({ active: false, progress: 0, travel: 0 });
        return;
      }

      if (dx > 0) {
        const elasticTravel = Math.min(SWIPE_MAX_TRAVEL, dx);
        const progress = Math.min(1, dx / SWIPE_TRIGGER_THRESHOLD);

        setSwipeState({
          active: true,
          progress,
          travel: elasticTravel,
        });
      }
    };

    const handleTouchEnd = (e) => {
      if (!isEdgeSwipe || isSwipeCancelled) {
        isEdgeSwipe = false;
        setSwipeState({ active: false, progress: 0, travel: 0 });
        return;
      }

      const touch = e.changedTouches?.[0];
      const dx = touch ? touch.clientX - touchStartX : 0;

      if (dx >= SWIPE_TRIGGER_THRESHOLD) {
        goBack();
      }

      isEdgeSwipe = false;
      setSwipeState({ active: false, progress: 0, travel: 0 });
    };

    const handleTouchCancel = () => {
      isEdgeSwipe = false;
      setSwipeState({ active: false, progress: 0, travel: 0 });
    };

    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: true });
    window.addEventListener("touchend", handleTouchEnd, { passive: true });
    window.addEventListener("touchcancel", handleTouchCancel, { passive: true });

    return () => {
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
      window.removeEventListener("touchcancel", handleTouchCancel);
    };
  }, [goBack]);

  /**
   * Component to render the floating edge swipe chevron indicator
   */
  const SwipeBackIndicator = useCallback(() => {
    if (!swipeState.active || reduceAnimations) return null;

    const scale = 0.7 + swipeState.progress * 0.45;
    const opacity = Math.min(1, swipeState.progress * 1.3);
    const translateX = Math.min(48, swipeState.travel * 0.4);
    const isReady = swipeState.progress >= 1;

    return (
      <div
        className={`mauze-swipe-back-indicator ${isReady ? "ready" : ""}`}
        style={{
          transform: `translateY(-50%) translateX(${translateX}px) scale(${scale})`,
          opacity,
        }}
        aria-hidden="true"
      >
        <div className="mauze-swipe-back-pill">
          <ChevronLeft size={22} className="mauze-swipe-back-chevron" />
        </div>
      </div>
    );
  }, [swipeState, reduceAnimations]);

  return {
    transitionDirection,
    swipeState,
    goBack,
    SwipeBackIndicator,
  };
}

export default useMobileBackNavigation;
