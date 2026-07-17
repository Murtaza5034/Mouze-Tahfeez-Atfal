/** Determine the subfolder name from a file extension */
function getFileSubfolder(name) {
  const ext = (name || "").split(".").pop()?.toLowerCase() || "";
  if (ext === "pdf") return "PDF";
  if (ext === "csv") return "CSV";
  if (["png", "jpg", "jpeg", "gif", "webp"].includes(ext)) return "Images";
  if (["zip", "rar", "7z"].includes(ext)) return "Archives";
  return "Other";
}

export async function downloadFile(urlOrBlob, name) {
  try {
    let blob;
    if (typeof urlOrBlob === "string") {
      const response = await fetch(urlOrBlob);
      blob = await response.blob();
    } else {
      blob = urlOrBlob;
    }

    if (window.Capacitor?.isNativePlatform()) {
      // Read blob as base64
      const reader = new FileReader();
      const base64 = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      const base64Data = base64.split(",")[1];

      // Use the native MauzeDownloader JavaScript interface if available
      // This saves files directly to Mauze Tahfeez/<Subfolder>/ via DownloadManager
      // (works on all Android versions without runtime storage permissions)
      if (window.MauzeDownloader) {
        window.MauzeDownloader.download(base64Data, name);
        return { type: "native" };
      }

      // Fallback: use Capacitor Filesystem
      const { Filesystem, Directory } = await import("@capacitor/filesystem");
      const subfolder = getFileSubfolder(name);
      const relativePath = `Mauze Tahfeez/${subfolder}/${name}`;

      let result;
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
      } catch (_) {
        await Filesystem.writeFile({
          path: relativePath,
          data: base64Data,
          directory: Directory.Documents,
        });
        result = await Filesystem.getUri({
          path: relativePath,
          directory: Directory.Documents,
        });
      }
      return { type: "native", filePath: result.uri };
    }

    const { saveAs } = await import("file-saver");
    saveAs(blob, name);
    return { type: "web" };
  } catch {
    if (typeof urlOrBlob === "string") {
      const link = document.createElement("a");
      link.href = urlOrBlob;
      link.download = name;
      link.target = "_blank";
      link.rel = "noreferrer";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
    return { type: "web" };
  }
}
