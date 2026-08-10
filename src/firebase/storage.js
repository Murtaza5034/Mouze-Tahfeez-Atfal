import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
  listAll,
  deleteObject,
  getMetadata,
} from "firebase/storage";
import { firebaseApp } from "./config.js";

// ---------------------------------------------------------------------------
// Storage wrapper exposing a supabase-compatible `storage` surface.
// Supabase buckets are mapped 1:1 to folders in the Firebase Storage bucket:
//   storage.from("teacher_photos").upload("a.jpg", file)
//     -> gs://<bucket>/teacher_photos/a.jpg
// The storage.rules allow public reads, so getPublicUrl / createSignedUrl both
// return the standard public download URL.
// ---------------------------------------------------------------------------

const storage = getStorage(firebaseApp);

function joinPath(bucket, path) {
  const cleanPath = String(path || "").replace(/^\/+/, "");
  return `${String(bucket).replace(/\/+$/, "")}/${cleanPath}`;
}

function supabaseError(error) {
  if (!error) return { message: "Storage error" };
  return { message: error.message || String(error) };
}

function buildStorageFrom(bucketName) {
  return {
    async upload(filePath, file, options = {}) {
      try {
        const full = joinPath(bucketName, filePath);
        const storageRef = ref(storage, full);
        const metadata = {};
        if (options.cacheControl) {
          metadata.cacheControl = options.cacheControl;
        }
        if (options.contentType) {
          metadata.contentType = options.contentType;
        }
        if (options.upsert !== false) metadata.upsertFlag = true; // updateBytes overwrites anyway
        const snap = await uploadBytes(storageRef, file, metadata);
        return { data: { path: snap.metadata.fullPath }, error: null };
      } catch (error) {
        return { data: null, error: supabaseError(error) };
      }
    },

    async getPublicUrl(filePath) {
      try {
        const full = joinPath(bucketName, filePath);
        const publicUrl = firebaseStoragePublicUrl(full);
        return { data: { publicUrl }, error: null };
      } catch (error) {
        return { data: { publicUrl: null }, error: supabaseError(error) };
      }
    },

    async createSignedUrl(filePath, expiresIn = 3600) {
      try {
        const full = joinPath(bucketName, filePath);
        const publicUrl = firebaseStoragePublicUrl(full);
        return { data: { signedUrl: publicUrl }, error: null };
      } catch (error) {
        return { data: { signedUrl: null }, error: supabaseError(error) };
      }
    },

    async createSignedUrls(paths = [], expiresIn = 3600) {
      try {
        const list = paths.map((p) => ({
          path: p,
          signedUrl: firebaseStoragePublicUrl(joinPath(bucketName, p)),
        }));
        return { data: list, error: null };
      } catch (error) {
        return { data: null, error: supabaseError(error) };
      }
    },

    async list(folderPath = "", options = {}) {
      try {
        const storageRef = ref(storage, joinPath(bucketName, folderPath));
        const res = await listAll(storageRef);
        let items = res.items.map((itemRef) => ({
          name: itemRef.name,
          path: itemRef.fullPath,
        }));
        let folders = res.prefixes.map((prefixRef) => ({
          name: prefixRef.name,
          path: prefixRef.fullPath,
        }));
        if (options.limit) items = items.slice(0, options.limit);
        return {
          data: [
            ...items.map((i) => ({ name: i.name, id: i.path })),
            ...folders.map((f) => ({ name: f.name, id: f.path })),
          ],
          error: null,
        };
      } catch (error) {
        return { data: null, error: supabaseError(error) };
      }
    },

    async remove(paths) {
      const list = Array.isArray(paths) ? paths : [paths];
      let count = 0;
      for (const p of list) {
        try {
          await deleteObject(ref(storage, joinPath(bucketName, p)));
          count++;
        } catch (_) {}
      }
      return { data: { count }, error: null };
    },

    async info(filePath) {
      try {
        const meta = await getMetadata(ref(storage, joinPath(bucketName, filePath)));
        return {
          data: { name: meta.name, size: meta.size, contentType: meta.contentType, timeCreated: meta.timeCreated },
          error: null,
        };
      } catch (error) {
        return { data: null, error: supabaseError(error) };
      }
    },
  };
}

function firebaseStoragePublicUrl(fullPath) {
  const encoded = encodeURIComponent(fullPath);
  const bucket = storage.app.options.storageBucket || "mawaid-b929a.appspot.com";
  return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encoded}?alt=media`;
}

function createStorageFrom(bucketName) {
  return buildStorageFrom(bucketName);
}

const storageApi = {
  from: (bucketName) => createStorageFrom(bucketName),

  async listBuckets() {
    // Hand-rolled bucket list used by the app to decide whether to create a
    // bucket before uploading. Firebase Storage has no bucket-level listing,
    // so we return the known buckets the app cares about.
    return {
      data: [
        { name: "child profile pictures", id: "child profile pictures" },
        { name: "muhaffezat atfal", id: "muhaffezat atfal" },
        { name: "notification_files", id: "notification_files" },
        { name: "report_backgrounds", id: "report_backgrounds" },
        { name: "teacher_photos", id: "teacher_photos" },
        { name: "ikhtebar_recordings", id: "ikhtebar_recordings" },
      ],
      error: null,
    };
  },
};

export default storageApi;
export { storage };