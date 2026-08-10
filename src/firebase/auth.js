import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as fbSignOut,
  updatePassword,
  updateEmail,
  updateProfile,
  onAuthStateChanged,
  sendPasswordResetEmail,
  getIdToken,
} from "firebase/auth";
import { firebaseApp } from "./config.js";

// Firebase Auth wrapper exposing a supabase-compatible auth surface:
//   getUser(), getSession(), signInWithPassword(), signUp(), signOut(),
//   updateUser(), onAuthStateChange(), resetPasswordForEmail()
// Firebase restores the session asynchronously, so getUser()/getSession()
// first wait for the initial auth state to be resolved.

const auth = getAuth(firebaseApp);

let authReady = false;
const readyPromise = new Promise((resolve) => {
  const unsub = onAuthStateChanged(auth, () => {
    authReady = true;
    unsub();
    resolve();
  });
  setTimeout(() => {
    if (!authReady) {
      authReady = true;
      resolve();
    }
  }, 4000);
});

async function waitForAuthReady() {
  if (!authReady) await readyPromise;
}

function fbUserToSupabaseUser(fbUser) {
  if (!fbUser) return null;
  const userMetadata = {};
  if (fbUser.displayName) userMetadata.full_name = fbUser.displayName;
  if (fbUser.phoneNumber) userMetadata.phone = fbUser.phoneNumber;
  if (fbUser.photoURL) userMetadata.avatar_url = fbUser.photoURL;
  for (const [k, v] of Object.entries(fbUser.providerData || {})) {
    if (v && k) userMetadata[k] = v;
  }
  return {
    id: fbUser.uid,
    uid: fbUser.uid,
    email: fbUser.email,
    phone: fbUser.phoneNumber,
    email_confirmed_at: fbUser.emailVerified ? new Date().toISOString() : null,
    created_at: fbUser.metadata?.createdAt,
    updated_at: fbUser.metadata?.lastSignInTime,
    user_metadata: { ...(fbUser.photoURL ? { avatar_url: fbUser.photoURL } : {}), ...userMetadata },
    app_metadata: {
      provider: fbUser.providerId || "email",
      providers: (fbUser.providerData || []).map((p) => p.providerId),
      email_verified: fbUser.emailVerified,
    },
  };
}

const authApi = {
  getUser: async () => {
    await waitForAuthReady();
    const fbUser = auth.currentUser;
    if (!fbUser) {
      return { data: { user: null }, error: { message: "No session" } };
    }
    return { data: { user: fbUserToSupabaseUser(fbUser) }, error: null };
  },

  getSession: async () => {
    await waitForAuthReady();
    const fbUser = auth.currentUser;
    if (!fbUser) {
      return { data: { session: null }, error: null };
    }
    const idToken = await getIdToken(fbUser).catch(() => null);
    const user = fbUserToSupabaseUser(fbUser);
    return {
      data: {
        session: {
          access_token: idToken,
          refresh_token: null,
          expires_at: null,
          user,
        },
      },
      error: null,
    };
  },

  signInWithPassword: async ({ email, password }) => {
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const user = fbUserToSupabaseUser(cred.user);
      return {
        data: {
          user,
          session: { access_token: null, refresh_token: null, user },
        },
        error: null,
      };
    } catch (err) {
      return { data: { user: null, session: null }, error: fbError(err) };
    }
  },

  signUp: async ({ email, password, options }) => {
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      if (options?.data) {
        try {
          await updateProfile(cred.user, {
            displayName: options.data.full_name || null,
          });
        } catch (_e) {
          /* non-fatal */
        }
      }
      const user = fbUserToSupabaseUser(cred.user);
      return {
        data: { user, session: null },
        error: null,
      };
    } catch (err) {
      return { data: { user: null, session: null }, error: fbError(err) };
    }
  },

  signOut: async () => {
    try {
      await fbSignOut(auth);
      return { error: null };
    } catch (err) {
      return { error: fbError(err) };
    }
  },

  updateUser: async ({ email, password, data }) => {
    try {
      const fbUser = auth.currentUser;
      if (!fbUser) throw new Error("No session");
      if (password) await updatePassword(fbUser, password);
      if (email && email !== fbUser.email) await updateEmail(fbUser, email);
      if (data?.full_name) {
        await updateProfile(fbUser, { displayName: data.full_name });
      }
      return { data: { user: fbUserToSupabaseUser(auth.currentUser) }, error: null };
    } catch (err) {
      return { data: { user: null }, error: fbError(err) };
    }
  },

  resetPasswordForEmail: async (email) => {
    try {
      await sendPasswordResetEmail(auth, email);
      return { data: {}, error: null };
    } catch (err) {
      return { data: {}, error: fbError(err) };
    }
  },

  onAuthStateChange: (callback) => {
    const unsubscribe = onAuthStateChanged(auth, (fbUser) => {
      const user = fbUserToSupabaseUser(fbUser);
      callback(user ? "SIGNED_IN" : "SIGNED_OUT", user ? { user } : null);
    });
    return {
      data: {
        subscription: {
          unsubscribe: () => unsubscribe(),
        },
      },
    };
  },
};

function fbError(err) {
  const message =
    err?.code === "auth/invalid-login-credentials" ||
    err?.code === "auth/wrong-password" ||
    err?.code === "auth/invalid-credential" ||
    err?.code === "auth/user-not-found"
      ? "Invalid login credentials"
      : err?.code === "auth/too-many-requests"
      ? "Too many login attempts. Please try again later."
      : err?.message || String(err);
  return { message, code: err?.code, name: "AuthApiError" };
}

export { auth, fbUserToSupabaseUser, waitForAuthReady };
export default authApi;