function getFileSubfolder(name) {
  const ext = (name || "").split(".").pop()?.toLowerCase() || "";
  if (ext === "pdf") return "PDF";
  if (ext === "csv") return "CSV";
  if (["png", "jpg", "jpeg", "gif", "webp"].includes(ext)) return "Images";
  if (["zip", "rar", "7z"].includes(ext)) return "Archives";
  return "Other";
}

export async function requestStorageAccess() {
  if (!window.MauzeDownloader) return false;
  if (window.MauzeDownloader.isStorageAccessGranted()) return true;
  try {
    window.MauzeDownloader.requestStorageAccess();
    await new Promise(resolve => setTimeout(resolve, 500));
    return window.MauzeDownloader.isStorageAccessGranted();
  } catch {
    return false;
  }
}

export function isStorageAccessGranted() {
  if (!window.MauzeDownloader) return false;
  try {
    return window.MauzeDownloader.isStorageAccessGranted() === true;
  } catch {
    return false;
  }
}

export function getSaveLocation() {
  try {
    return window.MauzeDownloader?.getSaveLocationPath() || "Not set";
  } catch {
    return "Not set";
  }
}

export async function downloadFile(urlOrBlob, name) {
  try {
    let blob;
    if (typeof urlOrBlob === "string") {
      const response = await fetch(urlOrBlob);
      if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);
      blob = await response.blob();
    } else {
      blob = urlOrBlob;
    }

    if (window.Capacitor?.isNativePlatform()) {
      return await nativeDownload(blob, name);
    }

    const { saveAs } = await import("file-saver");
    saveAs(blob, name);
    return { type: "web" };
  } catch (err) {
    console.error("downloadFile error:", err);
    if (typeof urlOrBlob === "string") {
      const link = document.createElement("a");
      link.href = urlOrBlob;
      link.download = name;
      link.target = "_blank";
      link.rel = "noreferrer";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return { type: "web" };
    }
    throw err;
  }
}

async function nativeDownload(blob, name) {
  const reader = new FileReader();
  const base64 = await new Promise((resolve, reject) => {
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
  const base64Data = base64.split(",")[1];

  if (window.MauzeDownloader) {
    await requestStorageAccess();
    const savedPath = window.MauzeDownloader.downloadAndGetPath(base64Data, name);
    if (savedPath) {
      return { type: "native", filePath: savedPath };
    }
  }

  const { Filesystem, Directory } = await import("@capacitor/filesystem");
  const subfolder = getFileSubfolder(name);
  const relativePath = `Mauze Tahfeez/${subfolder}/${name}`;

  let result;
  try {
    await Filesystem.writeFile({
      path: relativePath,
      data: base64Data,
      directory: Directory.Documents,
    });
    result = await Filesystem.getUri({
      path: relativePath,
      directory: Directory.Documents,
    });
  } catch {
    try {
      await Filesystem.writeFile({
        path: `Download/${relativePath}`,
        data: base64Data,
        directory: Directory.ExternalStorage,
      });
      result = await Filesystem.getUri({
        path: `Download/${relativePath}`,
        directory: Directory.ExternalStorage,
      });
    } catch {
      throw new Error("Failed to save file via any storage method.");
    }
  }
  return { type: "native", filePath: result.uri };
}
