/**
 * Image compression utility for Mauze Tahfeez.
 * Resizes and compresses images client-side to lightweight WebP / JPEG Data URLs (typically 15KB - 35KB).
 * Ensures instant, fault-tolerant profile photo uploads without hitting storage quota limits.
 */

export async function compressImageToDataUrl(fileOrBlob, maxDim = 380, quality = 0.82) {
  if (!fileOrBlob) return "";
  if (typeof fileOrBlob === "string") {
    if (fileOrBlob.startsWith("data:") || fileOrBlob.startsWith("http")) {
      return fileOrBlob;
    }
  }

  return new Promise((resolve, reject) => {
    try {
      const reader = new FileReader();
      reader.onload = (e) => {
        const rawResult = e.target?.result;
        if (!rawResult) {
          return resolve("");
        }

        const img = new Image();
        img.onload = () => {
          try {
            let w = img.width || 300;
            let h = img.height || 300;

            if (w > h) {
              if (w > maxDim) {
                h = Math.round((h * maxDim) / w);
                w = maxDim;
              }
            } else {
              if (h > maxDim) {
                w = Math.round((w * maxDim) / h);
                h = maxDim;
              }
            }

            const canvas = document.createElement("canvas");
            canvas.width = Math.max(1, w);
            canvas.height = Math.max(1, h);
            const ctx = canvas.getContext("2d");

            if (!ctx) {
              return resolve(rawResult);
            }

            // High-quality image smoothing
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = "high";
            ctx.drawImage(img, 0, 0, w, h);

            // Prefer webp for maximum compression and fidelity
            let dataUrl = canvas.toDataURL("image/webp", quality);
            if (!dataUrl || !dataUrl.startsWith("data:image/webp")) {
              dataUrl = canvas.toDataURL("image/jpeg", quality);
            }

            resolve(dataUrl);
          } catch (canvasErr) {
            console.warn("Canvas compression note, using original image:", canvasErr);
            resolve(rawResult);
          }
        };

        img.onerror = () => {
          resolve(rawResult);
        };

        img.src = rawResult;
      };

      reader.onerror = () => {
        reject(new Error("Could not read image file."));
      };

      reader.readAsDataURL(fileOrBlob);
    } catch (err) {
      reject(err);
    }
  });
}
