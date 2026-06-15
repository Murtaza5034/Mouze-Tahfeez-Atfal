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
      const { Filesystem, Directory } = await import("@capacitor/filesystem");
      const reader = new FileReader();
      const base64 = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      const base64Data = base64.split(",")[1];
      await Filesystem.writeFile({
        path: name,
        data: base64Data,
        directory: Directory.Documents,
      });
      const result = await Filesystem.getUri({
        path: name,
        directory: Directory.Documents,
      });
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
