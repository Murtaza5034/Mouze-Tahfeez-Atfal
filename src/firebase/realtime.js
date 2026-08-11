import {
  collection,
  query,
  where,
  onSnapshot,
  documentId,
  setDoc,
  deleteDoc,
  doc,
} from "firebase/firestore";
import { db } from "./db.js";
import { firebaseApp } from "./config.js";

// ---------------------------------------------------------------------------
// Realtime adapter: maps supabase `.channel().on('postgres_changes'|'presence')`
// to Firestore `onSnapshot` listeners.
//
//   - postgres_changes  -> live query on the table collection (table name is
//                          used verbatim as the Firestore collection name).
//   - presence          -> docs under the `_presence` collection with doc ids
//                          of the form `${channelId}__${sessionSuffix}`. Each
//                          client watches the id-prefix `${channelId}__` so
//                          every peer in that channel sees each other.
// ---------------------------------------------------------------------------

const PRESENCE_COLLECTION = "_presence";
const PRESENCE_TTL_MS = 90 * 1000;
const HEARTBEAT_MS = 20 * 1000;

const channels = new Set();

function parsePgFilter(filterStr) {
  const out = [];
  for (const chunk of String(filterStr || "").split(",")) {
    const trimmed = chunk.trim();
    if (!trimmed) continue;
    const m = trimmed.match(/^([a-zA-Z0-9_]+)=([a-z]*)?\.?([^,]+)$/i);
    if (!m) continue;
    const col = m[1];
    const op = (m[2] || "eq").toLowerCase() || "eq";
    const val = m[3];
    out.push({ col, op, val });
  }
  return out;
}

function rowFromSnap(snap) {
  const raw = snap.data() || {};
  const row = {};
  for (const [k, v] of Object.entries(raw)) {
    if (v && typeof v === "object" && "seconds" in v && "nanoseconds" in v) {
      row[k] = new Date(v.seconds * 1000).toISOString();
    } else if (
      v &&
      typeof v === "object" &&
      v.constructor &&
      v.constructor.name === "Timestamp"
    ) {
      row[k] = v.toDate().toISOString();
    } else {
      row[k] = v;
    }
  }
  if (row.id === undefined || row.id === null) row.id = snap.id;
  return row;
}

function createChannel(channelName, channelOptions = {}) {
  const listeners = []; // { type, opts, cb }
  const cleanupFns = [];
  const presenceMap = new Map(); // docId -> presence record
  let subscribed = false;
  let sessionSuffix = Math.random().toString(36).slice(2, 10);
  let heartbeatTimer = null;
  let trackedDocId = null;
  let trackedPayload = null;

  const leaveIdOf = () => {
    const m = String(channelName).match(/:([^/]+)$/);
    return m ? m[1] : channelName;
  };

  const baseKey = () => leaveIdOf();

  const myPresenceId = () => {
    const cfgKey =
      (channelOptions &&
        channelOptions.config &&
        channelOptions.config.presence &&
        channelOptions.config.presence.key) ||
      null;
    const keyBase = cfgKey || channelName;
    return `${baseKey()}__${keyBase}_${sessionSuffix}`;
  };

  function emit(type, payload) {
    for (const l of listeners) {
      if (l.type === "presence" && l.opts.event === type) {
        try {
          l.cb(payload);
        } catch (_) {}
      }
    }
  }

  function emitAllJoined() {
    for (const l of listeners) {
      if (l.type === "presence" && l.opts.event === "sync") {
        try {
          l.cb(null);
        } catch (_) {}
      }
    }
  }

  function startPg(listener) {
    const table = (listener.opts && listener.opts.table) || "";
    if (!table) return;
    const filters = parsePgFilter(listener.opts && listener.opts.filter);
    let q = collection(db, table);
    let valid = true;
    try {
      const constraints = [];
      for (const f of filters.slice(0, 3)) {
        if (f.op === "eq") constraints.push(where(f.col, "==", f.val));
      }
      if (constraints.length) q = query(q, ...constraints);
    } catch (_) {
      valid = false;
      q = collection(db, table);
    }

    let firstSnapshot = true;
    const cache = new Map();
    const unsub = onSnapshot(
      q,
      (snap) => {
        if (firstSnapshot) {
          firstSnapshot = false;
          snap.docChanges().forEach((c) => cache.set(c.doc.id, rowFromSnap(c.doc)));
          return;
        }
        snap.docChanges().forEach((c) => {
          if (c.type === "added" || c.type === "modified") {
            const row = rowFromSnap(c.doc);
            cache.set(c.doc.id, row);
            try {
              listener.cb({
                eventType: c.type === "added" ? "INSERT" : "UPDATE",
                schema: "public",
                table,
                new: row,
                old: null,
              });
            } catch (_) {}
          } else if (c.type === "removed") {
            const old = cache.get(c.doc.id) || {};
            cache.delete(c.doc.id);
            try {
              listener.cb({ eventType: "DELETE", schema: "public", table, new: null, old });
            } catch (_) {}
          }
        });
      },
      (err) => {
        // Permission-denied listeners (role-scoped tables) are non-fatal: the
        // app keeps polling via its fallback refresh loop. Swallow silently.
        if (!err || err.code === "permission-denied") return;
        console.warn(`[realtime:${table}]`, err && err.message ? err.message : err);
      }
    );
    cleanupFns.push(unsub);
  }

  function startPresence(listener) {
    const prefix = `${baseKey()}__`;
    const base = collection(db, PRESENCE_COLLECTION);
    let q;
    try {
      q = query(
        collection(db, PRESENCE_COLLECTION),
        where(documentId(), ">=", prefix),
        where(documentId(), "<", prefix + "\uffff")
      );
    } catch (_) {
      return;
    }
    let firstSnapshot = true;
    let knownKeys = new Set();
    const unsub = onSnapshot(q, (snap) => {
      const seen = new Set();
      const docs = {};
      snap.docs.forEach((d) => {
        seen.add(d.id);
        docs[d.id] = d.data() || {};
      });
      if (firstSnapshot) {
        firstSnapshot = false;
        knownKeys = seen;
        syncPresence(docs);
        emitAllJoined();
        return;
      }
      const joined = [...seen].filter((id) => !knownKeys.has(id));
      const left = [...knownKeys].filter((id) => !seen.has(id));
      knownKeys = seen;
      syncPresence(docs);
      if (joined.length) emit("join", null);
      if (left.length) emit("leave", null);
      emit("sync", null);
    });
    cleanupFns.push(unsub);
  }

  function syncPresence(docs) {
    presenceMap.clear();
    const now = Date.now();
    for (const [id, v] of Object.entries(docs)) {
      if (v._expiresAt && new Date(v._expiresAt).getTime() < now) continue;
      presenceMap.set(id, v);
    }
  }

  function pushTrackedRecord(record) {
    presenceMap.set(myPresenceId(), record);
  }

  const channel = {
    name: channelName,
    on(type, opts, cb) {
      listeners.push({ type, opts, cb });
      return channel;
    },
    subscribe(callback) {
      if (!subscribed) {
        subscribed = true;
        listeners.forEach((l) => {
          if (l.type === "postgres_changes") startPg(l);
          if (l.type === "presence") startPresence(l);
        });
      }
      if (typeof callback === "function") {
        setTimeout(() => callback("SUBSCRIBED"), 300);
      }
      return channel;
    },
    async track(payload, trackOptions = {}) {
      const id = myPresenceId();
      trackedDocId = id;
      trackedPayload = { ...(payload || {}) };
      const record = {
        ...trackedPayload,
        _ts: Date.now(),
        _expiresAt: new Date(Date.now() + PRESENCE_TTL_MS).toISOString(),
      };
      startHeartbeat();
      try {
        await setDoc(doc(db, PRESENCE_COLLECTION, id), record);
      } catch (_) {}
      pushTrackedRecord(record);
      return Promise.resolve();
    },
    untrack() {
      stopHeartbeat();
      if (trackedDocId) {
        return deleteDoc(doc(db, PRESENCE_COLLECTION, trackedDocId))
          .catch(() => {})
          .then(() => {
            presenceMap.delete(trackedDocId);
            trackedDocId = null;
            trackedPayload = null;
          });
      }
      trackedPayload = null;
      return Promise.resolve();
    },
    presenceState() {
      const out = {};
      const now = Date.now();
      for (const [id, v] of presenceMap.entries()) {
        if (v._expiresAt && new Date(v._expiresAt).getTime() < now) continue;
        out[id] = [v];
      }
      return out;
    },
    stop() {
      stopHeartbeat();
      cleanupFns.forEach((fn) => {
        try {
          fn();
        } catch (_) {}
      });
      cleanupFns.length = 0;
      if (trackedDocId) {
        deleteDoc(doc(db, PRESENCE_COLLECTION, trackedDocId)).catch(() => {});
        trackedDocId = null;
      }
      trackedPayload = null;
    },
  };

  function pushTrackedRecord(record) {
    presenceMap.set(myPresenceId(), record);
  }

  function heartbeat() {
    if (trackedDocId) {
      // setDoc REPLACES the whole doc, so always re-include the tracked
      // payload (role / userRole / leaveId) — otherwise peers lose our
      // presence after the first heartbeat and we'd flip offline.
      setDoc(doc(db, PRESENCE_COLLECTION, trackedDocId), {
        ...(trackedPayload || {}),
        _expiresAt: new Date(Date.now() + PRESENCE_TTL_MS).toISOString(),
      }).catch(() => {});
    }
  }
  function startHeartbeat() {
    if (heartbeatTimer) return;
    heartbeatTimer = setInterval(heartbeat, HEARTBEAT_MS);
  }
  function stopHeartbeat() {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
  }

  return channel;
}

export function channel(name, options) {
  for (const c of channels) {
    if (c.name === name) return c;
  }
  const ch = createChannel(name, options);
  channels.add(ch);
  return ch;
}

export function removeChannel(target) {
  for (const c of channels) {
    if (c === target || c.name === target) {
      try {
        c.stop();
      } catch (_) {}
      channels.delete(c);
      return true;
    }
  }
  return false;
}

export function removeAllChannels() {
  channels.forEach((c) => {
    try {
      c.stop();
    } catch (_) {}
  });
  channels.clear();
}

export default { channel, removeChannel, removeAllChannels };