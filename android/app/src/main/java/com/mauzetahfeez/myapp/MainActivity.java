package com.mauzetahfeez.myapp;

import android.app.DownloadManager;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.view.KeyEvent;
import android.webkit.CookieManager;
import android.webkit.DownloadListener;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.URLUtil;
import android.widget.Toast;

import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.BridgeActivity;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

public class MainActivity extends BridgeActivity {

    private static final int STORAGE_PERMISSION_REQUEST_CODE = 1001;

    private WebView webView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Get the WebView reference once bridge is ready
        getBridge().getWebView().post(() -> {
            webView = getBridge().getWebView();
            if (webView != null) {
                configureWebView();
            }
        });

        // Set up download listener on the Capacitor WebView
        setupDownloadListener();
    }

    /** Request storage permission at runtime (for Android < 11) */
    public void requestStoragePermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            // Android 11+: MANAGE_EXTERNAL_STORAGE is granted via system settings
            // We just guide users to enable it; not needed for DownloadManager
            return;
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            if (ContextCompat.checkSelfPermission(this, android.Manifest.permission.WRITE_EXTERNAL_STORAGE)
                    != PackageManager.PERMISSION_GRANTED) {
                ActivityCompat.requestPermissions(
                        this,
                        new String[]{android.Manifest.permission.WRITE_EXTERNAL_STORAGE,
                                     android.Manifest.permission.READ_EXTERNAL_STORAGE},
                        STORAGE_PERMISSION_REQUEST_CODE
                );
            }
        }
    }

    /**
     * JavaScript interface exposed as "MauzeDownloader" in the WebView.
     * Called from downloadUtils.js on Android native to save files via DownloadManager
     * into Mauze Tahfeez/<Subfolder>/ directory.
     */
    private class MauzeDownloadInterface {
        @JavascriptInterface
        public void download(String base64Data, String fileName) {
            try {
                byte[] fileBytes = Base64.decode(base64Data, Base64.DEFAULT);
                String subfolder = getMauzeSubfolder(fileName);

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    // Android 10+: Use MediaStore API (no storage permission needed)
                    ContentValues values = new ContentValues();
                    values.put(MediaStore.Downloads.DISPLAY_NAME, fileName);
                    values.put(MediaStore.Downloads.MIME_TYPE, getMimeType(fileName));
                    values.put(MediaStore.Downloads.RELATIVE_PATH,
                            "Mauze Tahfeez/" + subfolder);

                    Uri uri = getContentResolver().insert(
                            MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                    if (uri != null) {
                        try (OutputStream os = getContentResolver().openOutputStream(uri)) {
                            os.write(fileBytes);
                        }
                        runOnUiThread(() ->
                            Toast.makeText(MainActivity.this,
                                    "Saved to Mauze Tahfeez/" + subfolder + "/",
                                    Toast.LENGTH_SHORT).show()
                        );
                    }
                } else {
                    // Android 9 and below: direct file write
                    if (ContextCompat.checkSelfPermission(MainActivity.this,
                            android.Manifest.permission.WRITE_EXTERNAL_STORAGE)
                            != PackageManager.PERMISSION_GRANTED) {
                        requestStoragePermission();
                        runOnUiThread(() ->
                            Toast.makeText(MainActivity.this,
                                    "Storage permission needed. Please try again after granting.",
                                    Toast.LENGTH_LONG).show()
                        );
                        return;
                    }

                    File downloadsDir = Environment.getExternalStoragePublicDirectory(
                            Environment.DIRECTORY_DOWNLOADS);
                    File mauzeDir = new File(downloadsDir, "Mauze Tahfeez/" + subfolder);
                    mauzeDir.mkdirs();
                    File destFile = new File(mauzeDir, fileName);
                    try (FileOutputStream fos = new FileOutputStream(destFile)) {
                        fos.write(fileBytes);
                    }

                    Intent intent = new Intent(Intent.ACTION_MEDIA_SCANNER_SCAN_FILE);
                    intent.setData(Uri.fromFile(destFile));
                    sendBroadcast(intent);

                    runOnUiThread(() ->
                        Toast.makeText(MainActivity.this,
                                "Saved to Mauze Tahfeez/" + subfolder + "/",
                                Toast.LENGTH_SHORT).show()
                    );
                }
            } catch (Exception e) {
                e.printStackTrace();
                runOnUiThread(() ->
                    Toast.makeText(MainActivity.this,
                            "Download failed: " + e.getMessage(),
                            Toast.LENGTH_LONG).show()
                );
            }
        }
    }

    private void configureWebView() {
        WebSettings settings = webView.getSettings();

        // Enable hardware acceleration for smoother rendering
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        }

        // Enable DOM storage for local caching
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);

        // Enable application cache for offline support (removed in API 34+)

        // Optimize rendering performance
        settings.setRenderPriority(WebSettings.RenderPriority.HIGH);
        settings.setLayoutAlgorithm(WebSettings.LayoutAlgorithm.NARROW_COLUMNS);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);

        // Enable JavaScript (required for Capacitor)
        settings.setJavaScriptEnabled(true);
        settings.setJavaScriptCanOpenWindowsAutomatically(true);

        // Enable third-party cookies for authentication
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true);
        }

        // Optimize image loading
        settings.setLoadsImagesAutomatically(true);
        settings.setBlockNetworkImage(false);

        // Enable smooth scrolling (removed in newer API levels)

        // Disable file access restrictions for download functionality
        settings.setAllowFileAccess(true);
        settings.setAllowFileAccessFromFileURLs(true);
        settings.setAllowUniversalAccessFromFileURLs(true);

        // Expose a JavaScript interface for native file downloads via DownloadManager
        // This saves files directly to Mauze Tahfeez/<Subfolder>/ without needing
        // runtime storage permissions (DownloadManager is a system service).
        webView.addJavascriptInterface(new MauzeDownloadInterface(), "MauzeDownloader");
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        // Handle Android back button - go back in WebView history
        if (keyCode == KeyEvent.KEYCODE_BACK) {
            if (webView != null && webView.canGoBack()) {
                webView.goBack();
                return true;
            }
        }
        return super.onKeyDown(keyCode, event);
    }

    private void setupDownloadListener() {
        // Capacitor stores the WebView in its bridge — get it once the bridge is ready
        WebView webView = getBridge().getWebView();

        if (webView == null) {
            // Bridge WebView might not be available immediately; retry after layout
            webView.post(this::attachDownloadListener);
        } else {
            attachDownloadListener();
        }
    }

    /** Determine the subfolder name based on file extension */
    private static String getMauzeSubfolder(String fileName) {
        String lower = fileName.toLowerCase();
        if (lower.endsWith(".pdf")) return "PDF";
        if (lower.endsWith(".csv")) return "CSV";
        if (lower.endsWith(".png") || lower.endsWith(".jpg") || lower.endsWith(".jpeg")
            || lower.endsWith(".gif") || lower.endsWith(".webp")) return "Images";
        if (lower.endsWith(".zip") || lower.endsWith(".rar") || lower.endsWith(".7z")) return "Archives";
        return "Other";
    }

    /** Map file extension to MIME type for MediaStore */
    private static String getMimeType(String fileName) {
        String lower = fileName.toLowerCase();
        if (lower.endsWith(".pdf")) return "application/pdf";
        if (lower.endsWith(".csv")) return "text/csv";
        if (lower.endsWith(".png")) return "image/png";
        if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
        if (lower.endsWith(".gif")) return "image/gif";
        if (lower.endsWith(".webp")) return "image/webp";
        if (lower.endsWith(".zip")) return "application/zip";
        if (lower.endsWith(".rar")) return "application/x-rar-compressed";
        if (lower.endsWith(".7z")) return "application/x-7z-compressed";
        return "application/octet-stream";
    }

    private void attachDownloadListener() {
        WebView webView = getBridge().getWebView();
        if (webView == null) return;

        webView.setDownloadListener(new DownloadListener() {
            @Override
            public void onDownloadStart(String url, String userAgent, String contentDisposition,
                                        String mimeType, long contentLength) {

                // Determine a human-readable file name from Content-Disposition or URL
                String fileName = guessFileName(url, contentDisposition, mimeType);

                // Build destination: Mauze Tahfeez/<Subfolder>/filename.ext
                String subfolder = getMauzeSubfolder(fileName);
                String relativePath = "Mauze Tahfeez/" + subfolder + "/" + fileName;

                // Use Android DownloadManager — the most reliable cross-version approach
                // DownloadManager.Request.setDestinationInExternalPublicDir() handles
                // creating the directory tree automatically.
                try {
                    DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));

                    // Set title and description for the download notification
                    request.setTitle(fileName);
                    request.setDescription("Saving to Mauze Tahfeez/" + subfolder + "/");

                    // Allow downloading over mobile and WiFi
                    request.setAllowedOverMetered(true);
                    request.setAllowedOverRoaming(true);

                    // Show download notification
                    request.setNotificationVisibility(
                            DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);

                    // Save to public Downloads/Mauze Tahfeez/<Subfolder>/filename.ext
                    // DownloadManager automatically creates the directory structure, so
                    // this works on all Android versions.
                    request.setDestinationInExternalPublicDir(
                            Environment.DIRECTORY_DOWNLOADS,
                            relativePath
                    );

                    // Copy cookies from the WebView so authenticated downloads work
                    String cookies = CookieManager.getInstance().getCookie(url);
                    if (cookies != null && !cookies.isEmpty()) {
                        request.addRequestHeader("Cookie", cookies);
                    }

                    // Set the User-Agent from the WebView
                    request.addRequestHeader("User-Agent", userAgent);

                    // Handle MIME type
                    if (mimeType != null && !mimeType.isEmpty()) {
                        request.setMimeType(mimeType);
                    }

                    // Enqueue the download
                    DownloadManager dm = (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
                    if (dm != null) {
                        dm.enqueue(request);

                        // Show a toast so the user knows the download started
                        runOnUiThread(new Runnable() {
                            @Override
                            public void run() {
                                Toast.makeText(
                                        MainActivity.this,
                                        "Downloading to Mauze Tahfeez/" + subfolder + "/",
                                        Toast.LENGTH_SHORT
                                ).show();
                            }
                        });
                    }
                } catch (Exception e) {
                    // If DownloadManager fails (e.g. for blob: or data: URLs), fall back to opening in browser
                    runOnUiThread(new Runnable() {
                        @Override
                        public void run() {
                            Toast.makeText(
                                    MainActivity.this,
                                    "Download started in browser...",
                                    Toast.LENGTH_SHORT
                            ).show();
                        }
                    });

                    Intent intent = new Intent(
                            Intent.ACTION_VIEW, Uri.parse(url));
                    startActivity(intent);
                }
            }
        });
    }

    /**
     * Guesses the file name from the URL and Content-Disposition header.
     * Handles common patterns like:
     *   - Content-Disposition: attachment; filename="report.pdf"
     *   - Content-Disposition: inline; filename*=UTF-8''report%20(1).pdf
     *   - URL ending in /path/to/file.pdf
     */
    private static String guessFileName(String url, String contentDisposition, String mimeType) {
        // First try Android's built-in URLUtil which handles most Content-Disposition patterns
        String fileName = URLUtil.guessFileName(url, contentDisposition, mimeType);

        // Clean up any problematic characters in the filename
        if (fileName != null) {
            // Remove path separators that might have slipped through
            fileName = fileName.replaceAll("[/\\\\:*?\"<>|]", "_");
        }

        return fileName;
    }
}
