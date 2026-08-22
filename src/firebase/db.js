import {
  initializeFirestore,
  getFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  collection,
  doc,
  getDocs,
  getDoc,
  getDocsFromCache,
  getDocsFromServer,
  getDocFromCache,
  getDocFromServer,
  query,
  where,
  documentId,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  Timestamp,
} from "firebase/firestore";
import { firebaseApp } from "./config.js";

// ---------------------------------------------------------------------------
// Firestore data engine exposing a supabase-compatible query surface.
//
// Every Supabase table is mirrored 1:1 as a Firestore collection with the same
// name and the same field names. Document ids follow a deterministic scheme:
//
//   tables with an `id` PK          -> doc id = String(id)
//   child_profiles                  -> doc id = student_id
//   self_jadwal / self_jadawal      -> doc id = user_id
//   user_portal_access              -> doc id = user_id
//   parent_report_views             -> doc id = student_id
//   page_visibility                 -> doc id = `${page_key}__${role}`
//   user_fcm_tokens                 -> doc id = fcm_token
//   weekly_results(_archive)        -> doc id = `${student_id}_${week_date}`
//   student_daily_attendance        -> doc id = `${student_id}_${attendance_date}`
//   singletons (jadwal_settings ..) -> doc id = String(id ?? 1)
//
// migrate.ts writes docs using exactly this scheme.
// ---------------------------------------------------------------------------

// Enable IndexedDB offline persistence + multi-tab cache. Once data is cached
// locally, repeat page loads render instantly (no network round-trip) and the
// realtime onSnapshot listeners keep the cache fresh in the background.
// Falls back to plain in-memory Firestore if IndexedDB is unavailable (e.g.
// private/incognito browsing) so the app never breaks.
let db;
try {
  db = initializeFirestore(firebaseApp, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager(),
    }),
  });
} catch (_e) {
  db = getFirestore(firebaseApp);
}

export { db };

// ---------------------------------------------------------------------------
// Portal section scoping.
//
// The app now hosts two independent institutes:
//   - "atfal"  -> the original Rawdat Tahfeez al Atfal (default; no prefix)
//   - "kibar"  -> the new adult/Kibar portal (reads/writes kibar_* collections)
//
// Every collection queried through `from()` is resolved through
// resolveCollectionName(). When the active section is "kibar", data tables are
// redirected to their kibar_* counterpart so the two institutes never share a
// single record. A small set of collections (auth users, device lock, FCM
// tokens, presence, releases, email logs) stays shared across both sections.
// ---------------------------------------------------------------------------

let activeSection = "atfal";

export function setSectionScope(section) {
  const next = section === "kibar" ? "kibar" : "atfal";
  if (activeSection !== next) {
    activeSection = next;
    console.log(`[Database] Switched active section scope to: ${next}`);
  }
  return activeSection;
}

export function getSectionScope() {
  return activeSection;
}

const SHARED_COLLECTIONS = new Set([
  "users",
  "app_lock_settings",
  "user_fcm_tokens",
  "_presence",
  "app_releases",
  "email_logs",
  "tahfeez_signals",
  "online_tahfeez_sessions",
  "online_tahfeez_logs",
]);

export function resolveCollectionName(name) {
  if (!name) return name;
  const str = String(name);
  if (str.startsWith("atfal_")) {
    return str.slice(6);
  }
  if (str.startsWith("raw:")) {
    return str.slice(4);
  }
  if (
    activeSection === "kibar" &&
    !SHARED_COLLECTIONS.has(str) &&
    !str.startsWith("kibar_")
  ) {
    return `kibar_${str}`;
  }
  return str;
}

const DOC_ID_BY = {
  child_profiles: (d) => d.student_id || d.id,
  student_profiles: (d) => d.student_id || d.id || d.user_id,
  teacher_profiles: (d) => d.id || d.teacher_id || d.email,
  self_jadwal: (d) => d.user_id || d.id,
  self_jadawal: (d) => d.user_id || d.id,
  user_portal_access: (d) => d.user_id || d.id,
  parent_report_views: (d) => d.student_id || d.id,
  page_visibility: (d) => [d.page_key, d.role].join("__"),
  user_fcm_tokens: (d) => d.fcm_token || d.token,
  weekly_results: (d) => [d.student_id, d.week_date].join("_"),
  weekly_results_archive: (d) => [d.student_id, d.week_date].join("_"),
  student_daily_attendance: (d) => [d.student_id, d.attendance_date].join("_"),
  jadwal_settings: (d) => String(d.id ?? 1),
  report_settings: (d) => String(d.id ?? 1),
  marhala_settings: (d) => String(d.id ?? 1),
  email_settings: (d) => String(d.id ?? 1),
  whatsapp_config: (d) => String(d.id ?? 1),
  jadawal: (d) => d.student_id || d.id,
  app_lock_settings: (d) => d.user_id || d.id,
};

function deriveDocId(collectionName, data) {
  if (!data || typeof data !== "object") return null;
  const baseName = String(collectionName).replace(/^kibar_/, "");
  const derive = DOC_ID_BY[baseName];
  if (derive) {
    const id = derive(data);
    if (id !== undefined && id !== null && String(id) !== "") return String(id);
  }
  if (data.id !== undefined && data.id !== null && String(data.id) !== "") {
    return String(data.id);
  }
  return null;
}

export function docIdFor(collectionName, data) {
  return deriveDocId(collectionName, data);
}

function genId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `row_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

// ---------------------------------------------------------------------------
// Conversions
// ---------------------------------------------------------------------------

function sanitizeValue(value) {
  if (value === undefined || value === null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "bigint") return Number(value);
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(sanitizeValue);
  if (typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      const sv = sanitizeValue(v);
      if (sv !== undefined) out[k] = sv;
    }
    return out;
  }
  return value;
}

function sanitizeWrite(data) {
  const s = sanitizeValue(data);
  if (s && typeof s === "object" && !Array.isArray(s)) {
    delete s.id;
  }
  return s;
}

function isoFromValue(v) {
  if (v instanceof Timestamp) return v.toDate().toISOString();
  if (v instanceof Date) return v.toISOString();
  if (v && typeof v === "object" && "seconds" in v && "nanoseconds" in v) {
    return new Date(v.seconds * 1000).toISOString();
  }
  return v;
}

function convertRow(snap) {
  const raw = snap.data() || {};
  const row = {};
  for (const [k, v] of Object.entries(raw)) {
    row[k] = isoFromValue(v);
  }
  if (row.id === undefined || row.id === null) row.id = snap.id;
  return row;
}

function normValue(v) {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v.toISOString();
  if (v instanceof Timestamp) return v.toDate().toISOString();
  return v;
}

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

function normalizeFilter(column, rawOp, value, negated = false) {
  const op = String(rawOp).toLowerCase();
  if (op === "is") return { column, op: "is", val: value, negated };
  if (op === "not" && Array.isArray(value)) {
    return {
      column,
      op: String(value[0]).toLowerCase(),
      val: value.length > 1 ? value[1] : null,
      negated: true,
    };
  }
  if ((op === "eq" || op === "neq") && (value === null || value === undefined)) {
    return { column, op: op === "eq" ? "is" : "isnot", val: null, negated };
  }
  return { column, op, val: value, negated };
}

function isSimpleFilter(f) {
  if (f.negated) return false;
  if (f.column === "id") return true;
  return ["eq", "gt", "gte", "lt", "lte", "in"].includes(f.op);
}

function looseEq(a, b) {
  if (a === b) return true;
  if (a === null || a === undefined) return b === null || b === undefined;
  if (typeof a === "number") {
    const bn = Number(b);
    if (!Number.isNaN(bn)) return a === bn;
    return String(a) === String(b);
  }
  if (typeof b === "number") {
    const an = Number(a);
    if (!Number.isNaN(an)) return an === b;
    return String(a) === String(b);
  }
  if (typeof a === "boolean" || typeof b === "boolean") return !!a === !!b;
  return String(a) === String(b);
}

const DATE_LIKE_RE = /^\d{4}-\d{2}-\d{2}/;

function compareLoose(a, b) {
  if (a === null || a === undefined) a = "";
  if (b === null || b === undefined) b = "";
  const sa = String(a).trim();
  const sb = String(b).trim();
  // ISO date keys ("YYYY-MM-DD...") must compare lexicographically — never
  // through parseFloat (which collapses every date in the same year to equal).
  if (DATE_LIKE_RE.test(sa) && DATE_LIKE_RE.test(sb)) {
    const da = sa.slice(0, 10);
    const db = sb.slice(0, 10);
    return da === db ? 0 : da < db ? -1 : 1;
  }
  const na = parseFloat(sa);
  const nb = parseFloat(sb);
  if (!Number.isNaN(na) && !Number.isNaN(nb) && sa !== "" && sb !== "") {
    return na - nb;
  }
  return sa.localeCompare(sb);
}

function likeMatch(raw, pattern, caseInsensitive) {
  let s = String(raw === null || raw === undefined ? "" : raw);
  let p = String(pattern);
  if (caseInsensitive) {
    s = s.toLowerCase();
    p = p.toLowerCase();
  }
  if (p.includes("%")) {
    const re = new RegExp(
      "^" +
        p
          .split("%")
          .map((seg) => seg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
          .join(".*") +
        "$"
    );
    return re.test(s);
  }
  return s.includes(p);
}

function matchesFilter(f, row) {
  if (f.negated) return !matchesFilter({ ...f, negated: false }, row);
  const raw = row[f.column];
  const target = f.val;
  switch (f.op) {
    case "is":
      if (target === null || target === undefined) {
        return raw === null || raw === undefined;
      }
      return raw === target;
    case "isnot":
      return raw !== null && raw !== undefined;
    case "isnull":
      return raw === null || raw === undefined;
    case "notnull":
      return raw !== null && raw !== undefined;
    case "neq":
      return !looseEq(raw, target);
    case "eq":
      return looseEq(raw, target);
    case "gt":
      return compareLoose(raw, target) > 0;
    case "gte":
      return compareLoose(raw, target) >= 0;
    case "lt":
      return compareLoose(raw, target) < 0;
    case "lte":
      return compareLoose(raw, target) <= 0;
    case "in":
      return Array.isArray(target) && target.some((x) => looseEq(raw, x));
    case "notin":
      return !(Array.isArray(target) && target.some((x) => looseEq(raw, x)));
    case "like":
      return likeMatch(raw, target, false);
    case "ilike":
      return likeMatch(raw, target, true);
    case "contains":
      return Array.isArray(raw) && raw.some((x) => looseEq(x, target));
    default:
      return looseEq(raw, target);
  }
}

function splitTopLevel(str) {
  const parts = [];
  let depth = 0;
  let cur = "";
  for (const ch of String(str)) {
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    else if (ch === "," && depth === 0) {
      parts.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  if (cur.trim()) parts.push(cur);
  return parts;
}

function parseSingle(s) {
  const m = String(s).match(
    /^([a-zA-Z0-9_]+)\.(eq|neq|gt|gte|lt|lte|is|in|like|ilike)?\.(.+)$/i
  );
  if (!m) return null;
  const op = (m[2] || "eq").toLowerCase();
  let val = m[3];
  if (val === "null") val = null;
  return { column: m[1], op, val };
}

function parseOrFilter(orStr) {
  const groups = [];
  for (const token of splitTopLevel(orStr)) {
    const trimmed = token.trim();
    if (trimmed.startsWith("(") && trimmed.endsWith(")")) {
      const group = splitTopLevel(trimmed.slice(1, -1))
        .map((t) => parseSingle(t))
        .filter(Boolean);
      if (group.length) groups.push(group);
    } else {
      const single = parseSingle(trimmed);
      if (single) groups.push([single]);
    }
  }
  return groups;
}

function matchesAll(rows, state) {
  const filters = state.filters || [];
  const orGroups = state.orFilters || [];
  return rows.filter((row) => {
    const fOk = filters.every((f) => matchesFilter(f, row));
    if (!fOk) return false;
    if (orGroups.length) {
      return orGroups.some((group) =>
        group.every((f) => matchesFilter(f, row))
      );
    }
    return true;
  });
}

function sortRows(rows, clauses) {
  if (!clauses || clauses.length === 0) return rows;
  const arr = rows.slice();
  arr.sort((a, b) => {
    for (const c of clauses) {
      const cmp = compareLoose(a[c.column], b[c.column]);
      if (cmp !== 0) return c.ascending === false ? -cmp : cmp;
    }
    return 0;
  });
  return arr;
}

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------

function isIndexError(e) {
  if (!e) return false;
  const code = e.code || "";
  const msg = e.message || "";
  return (
    code === "FAILED_PRECONDITION" ||
    /failed-prede|index|cannot be used|requires an index/i.test(msg)
  );
}

function nativeConstraints(filters) {
  const constraints = [];
  const OP_MAP = { eq: "==", gt: ">", gte: ">=", lt: "<", lte: "<=" };
  for (const f of filters) {
    if (!isSimpleFilter(f)) continue;
    if (f.op === "in") {
      if (Array.isArray(f.val) && f.val.length <= 10) {
        constraints.push(
          f.column === "id"
            ? where(documentId(), "in", f.val.map(String))
            : where(f.column, "in", f.val.map(normValue))
        );
      }
    } else {
      const op = OP_MAP[f.op] || "==";
      constraints.push(
        f.column === "id"
          ? where(documentId(), op, String(f.val))
          : where(f.column, op, normValue(f.val))
      );
    }
  }
  return constraints;
}

async function loadCandidates(state, ref) {
  const filters = state.filters || [];

  // Intercept empty 'in' filters to avoid Firestore crashes and return [] immediately
  const hasEmptyInFilter = filters.some(f => f.op === "in" && Array.isArray(f.val) && f.val.length === 0);
  if (hasEmptyInFilter) {
    return [];
  }

  // Fast path: single eq(id) -> getDoc
  if (
    filters.length === 1 &&
    filters[0].column === "id" &&
    filters[0].op === "eq" &&
    !filters[0].negated
  ) {
    const docRef = doc(db, state.collection, String(filters[0].val));
    try {
      const snap = await getDocFromCache(docRef);
      if (snap.exists()) {
        getDocFromServer(docRef).catch(() => {});
        return [convertRow(snap)];
      }
    } catch (_) {}

    try {
      const snap = await getDoc(docRef);
      return snap.exists() ? [convertRow(snap)] : [];
    } catch (_) {
      const snap = await getDocFromServer(docRef);
      return snap.exists() ? [convertRow(snap)] : [];
    }
  }

  const constraints = nativeConstraints(filters);
  const q = constraints.length ? query(ref, ...constraints) : ref;

  try {
    const snap = await getDocsFromCache(q);
    if (snap && snap.docs.length > 0) {
      getDocsFromServer(q).catch(() => {});
      return snap.docs.map(convertRow);
    }
  } catch (_) {}

  try {
    const snap = await getDocs(q);
    return snap.docs.map(convertRow);
  } catch (e) {
    if (isIndexError(e)) {
      const first = filters.find(isSimpleFilter);
      let indexQ = ref;
      if (first) {
        if (first.column === "id") {
          indexQ = query(ref, where(documentId(), "==", String(first.val)));
        } else if (first.op === "eq") {
          indexQ = query(ref, where(first.column, "==", normValue(first.val)));
        } else if (
          first.op === "in" &&
          Array.isArray(first.val) &&
          first.val.length <= 10
        ) {
          indexQ = query(ref, where(first.column, "in", first.val.map(normValue)));
        }
      }
      try {
        const snap = await getDocsFromCache(indexQ);
        if (snap && snap.docs.length > 0) {
          getDocsFromServer(indexQ).catch(() => {});
          return snap.docs.map(convertRow);
        }
      } catch (_) {}

      const snap = await getDocs(indexQ);
      return snap.docs.map(convertRow);
    }
    throw e;
  }
}

async function executeSelect(state) {
  const ref = collection(db, state.collection);
  let rows;
  try {
    rows = await loadCandidates(state, ref);
  } catch (err) {
    console.warn(`Firestore select warning on collection "${state.collection}":`, err?.message || err);
    if (state.single === "single") {
      return { data: null, error: { message: err.message || String(err) } };
    }
    if (state.single === "maybeSingle") {
      return { data: null, error: null };
    }
    return { data: [], error: { message: err.message || String(err) } };
  }

  rows = matchesAll(rows, state);
  rows = sortRows(rows, state.orderByClauses || []);
  if (state.limit) rows = rows.slice(0, state.limit);

  if (state.countOnly) return { count: rows.length, data: null, error: null };

  if (state.single === "single") {
    if (rows.length === 0) {
      return {
        data: null,
        error: {
          message: "JSON object requested, multiple (or no) rows returned",
          code: "PGRST116",
        },
      };
    }
    return { data: rows[0], error: null };
  }
  if (state.single === "maybeSingle") {
    return { data: rows[0] || null, error: null };
  }
  return { data: rows, error: null };
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

async function findRows(state) {
  return executeSelect({ ...state, limit: undefined, countOnly: false });
}

async function executeInsert(state) {
  const values = Array.isArray(state.pendingInsert)
    ? state.pendingInsert
    : [state.pendingInsert];
  const rows = [];
  try {
    for (const value of values || []) {
      const clean = sanitizeWrite(value);
      let id = docIdFor(state.collection, value);
      let docId;
      if (id) {
        await setDoc(doc(db, state.collection, id), clean);
        docId = id;
      } else {
        docId = (await addDoc(collection(db, state.collection), clean)).id;
      }
      rows.push({ ...sanitizeValue(value), id: docId });
    }
  } catch (e) {
    console.error(`Firestore insert error on collection "${state.collection}":`, e);
    return { data: null, error: { message: e.message || String(e) } };
  }
  if (!state.markSelectAfterWrite) return { data: null, error: null };
  return filterAfterRows(rows, state);
}

async function executeUpsert(state) {
  const values = Array.isArray(state.pendingUpsert)
    ? state.pendingUpsert
    : [state.pendingUpsert];
  const rows = [];
  const conflicts = (state.upsertOnConflict || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  for (const value of values || []) {
    let id = docIdFor(state.collection, value);
    if (!id && conflicts.length) {
      id = conflicts.map((k) => value[k]).join("_");
    }
    if (!id || id === "null_undefined") id = genId();
    const clean = sanitizeWrite(value);
    try {
      await setDoc(doc(db, state.collection, id), clean, { merge: true });
    } catch (e) {
      console.error(`Firestore upsert error on collection "${state.collection}":`, e);
      return {
        data: null,
        error: { message: e.message || String(e), code: e.code || "write-failed" },
      };
    }
    rows.push({ ...sanitizeValue(value), id });
  }
  if (!state.markSelectAfterWrite) return { data: null, error: null };
  return filterAfterRows(rows, state);
}

async function executePatch(state) {
  const { data: found, error } = await findRows(state);
  if (error) return { data: null, error };
  const patch = sanitizeWrite(state.patch || {});
  for (const row of found || []) {
    try {
      await updateDoc(doc(db, state.collection, String(row.id)), patch);
    } catch (e) {
      return { data: null, error: { message: e.message || String(e) } };
    }
  }
  if (!state.markSelectAfterWrite) return { data: null, error: null };
  const rows = (found || []).map((r) => ({ ...r, ...sanitizeValue(state.patch) }));
  return filterAfterRows(rows, state);
}

async function executeDelete(state) {
  const { data: found, error } = await findRows(state);
  if (error) return { data: null, error };
  for (const row of found || []) {
    try {
      await deleteDoc(doc(db, state.collection, String(row.id)));
    } catch (_e) {}
  }
  return { data: null, error: null };
}

function filterAfterRows(rows, state) {
  let out = matchesAll(rows, state);
  out = sortRows(out, state.orderByClauses || []);
  if (state.limit) out = out.slice(0, state.limit);
  if (state.single === "single") {
    if (!out.length)
      return {
        data: null,
        error: {
          message: "JSON object requested, multiple (or no) rows returned",
          code: "PGRST116",
        },
      };
    return { data: out[0], error: null };
  }
  if (state.single === "maybeSingle") return { data: out[0] || null, error: null };
  return { data: out, error: null };
}

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

function createBuilder(collectionName) {
  const state = {
    collection: collectionName,
    filters: [],
    orFilters: [],
    orderByClauses: [],
    limit: null,
    single: null,
    countOnly: false,
    pendingInsert: null,
    pendingUpsert: null,
    upsertOnConflict: null,
    patch: null,
    markSelectAfterWrite: false,
    pendingDelete: false,
  };

  const builder = {
    select() {
      state.markSelectAfterWrite = true;
      return builder;
    },
    eq(column, value) {
      state.filters.push(normalizeFilter(column, "eq", value));
      return builder;
    },
    neq(column, value) {
      state.filters.push(normalizeFilter(column, "neq", value));
      return builder;
    },
    gt(column, value) {
      state.filters.push({ column, op: "gt", val: value, negated: false });
      return builder;
    },
    gte(column, value) {
      state.filters.push({ column, op: "gte", val: value, negated: false });
      return builder;
    },
    lt(column, value) {
      state.filters.push({ column, op: "lt", val: value, negated: false });
      return builder;
    },
    lte(column, value) {
      state.filters.push({ column, op: "lte", val: value, negated: false });
      return builder;
    },
    in(column, values) {
      state.filters.push({ column, op: "in", val: values, negated: false });
      return builder;
    },
    contains(column, value) {
      state.filters.push({ column, op: "contains", val: value, negated: false });
      return builder;
    },
    like(column, pattern) {
      state.filters.push({ column, op: "like", val: pattern, negated: false });
      return builder;
    },
    ilike(column, pattern) {
      state.filters.push({ column, op: "ilike", val: pattern, negated: false });
      return builder;
    },
    is(column, value) {
      state.filters.push({ column, op: "is", val: value, negated: false });
      return builder;
    },
    not(column, op, value) {
      const f = normalizeFilter(column, op, value);
      state.filters.push({ ...f, negated: true });
      return builder;
    },
    or(str) {
      state.orFilters = parseOrFilter(str);
      return builder;
    },
    order(column, opts) {
      state.orderByClauses.push({ column, ascending: opts && opts.ascending });
      return builder;
    },
    limit(n) {
      state.limit = n;
      return builder;
    },
    single() {
      state.single = "single";
      return builder;
    },
    maybeSingle() {
      state.single = "maybeSingle";
      return builder;
    },
    insert(values) {
      state.pendingInsert = values;
      state.markSelectAfterWrite = state.markSelectAfterWrite || false;
      return builder;
    },
    upsert(values, opts) {
      state.pendingUpsert = values;
      state.upsertOnConflict = opts && opts.onConflict;
      return builder;
    },
    update(patch) {
      state.patch = patch;
      return builder;
    },
    delete() {
      state.pendingDelete = true;
      return builder;
    },
    async execute() {
      if (state.pendingDelete) return executeDelete(state);
      if (state.pendingUpsert) return executeUpsert(state);
      if (state.pendingInsert) return executeInsert(state);
      if (state.patch) return executePatch(state);
      return executeSelect(state);
    },
  };

  builder.select = function (columns, opts) {
    if (opts && opts.head) state.countOnly = true;
    state.markSelectAfterWrite = true;
    return builder;
  };

  builder.then = function (onFulfilled, onRejected) {
    return this.execute().then(onFulfilled, onRejected);
  };

  return builder;
}

export function from(collectionName) {
  return createBuilder(resolveCollectionName(collectionName));
}

export default { from };