package com.mauzetahfeez.myapp;

import android.app.DownloadManager;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
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
    private SharedPreferences prefs;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        prefs = getSharedPreferences("mauze_prefs", MODE_PRIVATE);

        super.onCreate(savedInstanceState);

        getBridge().getWebView().post(() -> {
            webView = getBridge().getWebView();
            if (webView != null) {
                configureWebView();
            }
        });

        setupDownloadListener();
    }

    public void requestStoragePermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
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

    private class MauzeDownloadInterface {
        @JavascriptInterface
        public boolean download(String base64Data, String fileName) {
            try {
                byte[] fileBytes = Base64.decode(base64Data, Base64.DEFAULT);
                String subfolder = getMauzeSubfolder(fileName);

                boolean saved = saveViaMediaStore(fileBytes, fileName, subfolder);

                if (!saved) {
                    saved = saveViaDirectFile(fileBytes, fileName, subfolder);
                }

                if (!saved) {
                    saved = saveViaLegacyFile(fileBytes, fileName, subfolder);
                }

                if (saved) {
                    return true;
                } else {
                    runOnUiThread(() ->
                        Toast.makeText(MainActivity.this,
                                "Download failed. Please check storage permissions.",
                                Toast.LENGTH_LONG).show()
                    );
                    return false;
                }
            } catch (Exception e) {
                e.printStackTrace();
                runOnUiThread(() ->
                    Toast.makeText(MainActivity.this,
                            "Download error: " + e.getMessage(),
                            Toast.LENGTH_LONG).show()
                );
                return false;
            }
        }

        @JavascriptInterface
        public String downloadAndGetPath(String base64Data, String fileName) {
            boolean ok = download(base64Data, fileName);
            if (ok) {
                String subfolder = getMauzeSubfolder(fileName);
                return "Mauze Tahfeez/" + subfolder + "/" + fileName;
            }
            return "";
        }

        @JavascriptInterface
        public void requestStorageAccess() {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
                requestStoragePermission();
            }
        }

        @JavascriptInterface
        public boolean isStorageAccessGranted() {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                return true;
            }
            return ContextCompat.checkSelfPermission(MainActivity.this,
                    android.Manifest.permission.WRITE_EXTERNAL_STORAGE)
                    == PackageManager.PERMISSION_GRANTED;
        }

        @JavascriptInterface
        public String getSaveLocationPath() {
            return "Mauze Tahfeez/";
        }

        private boolean saveViaMediaStore(byte[] fileBytes, String fileName,
                                          String subfolder) {
            try {
                ContentValues values = new ContentValues();
                values.put(MediaStore.Downloads.DISPLAY_NAME, fileName);
                values.put(MediaStore.Downloads.MIME_TYPE, getMimeType(fileName));
                String relativePath = "Mauze Tahfeez/" + subfolder;
                values.put(MediaStore.Downloads.RELATIVE_PATH, relativePath);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    Uri uri = getContentResolver().insert(
                            MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                    if (uri != null) {
                        try (OutputStream os = getContentResolver().openOutputStream(uri)) {
                            if (os != null) {
                                os.write(fileBytes);
                                os.flush();
                            }
                        }
                        runOnUiThread(() ->
                            Toast.makeText(MainActivity.this,
                                    "Saved to " + relativePath + "/",
                                    Toast.LENGTH_SHORT).show()
                        );
                        return true;
                    }
                }
            } catch (Exception ignored) {}
            return false;
        }

        private boolean saveViaDirectFile(byte[] fileBytes, String fileName,
                                          String subfolder) {
            try {
                File downloadsDir = Environment.getExternalStoragePublicDirectory(
                        Environment.DIRECTORY_DOWNLOADS);
                File mauzeDir = new File(downloadsDir, "Mauze Tahfeez/" + subfolder);
                if (!mauzeDir.exists()) {
                    mauzeDir.mkdirs();
                }
                File destFile = new File(mauzeDir, fileName);
                try (FileOutputStream fos = new FileOutputStream(destFile)) {
                    fos.write(fileBytes);
                    fos.flush();
                }
                Intent intent = new Intent(Intent.ACTION_MEDIA_SCANNER_SCAN_FILE);
                intent.setData(Uri.fromFile(destFile));
                sendBroadcast(intent);
                runOnUiThread(() ->
                    Toast.makeText(MainActivity.this,
                            "Saved to Mauze Tahfeez/" + subfolder + "/",
                            Toast.LENGTH_SHORT).show()
                );
                return true;
            } catch (Exception ignored) {
                return false;
            }
        }

        private boolean saveViaLegacyFile(byte[] fileBytes, String fileName,
                                          String subfolder) {
            try {
                if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
                    if (ContextCompat.checkSelfPermission(MainActivity.this,
                            android.Manifest.permission.WRITE_EXTERNAL_STORAGE)
                            != PackageManager.PERMISSION_GRANTED) {
                        requestStoragePermission();
                        return false;
                    }
                }
                File downloadsDir = Environment.getExternalStoragePublicDirectory(
                        Environment.DIRECTORY_DOWNLOADS);
                File mauzeDir = new File(downloadsDir, "Mauze Tahfeez/" + subfolder);
                if (!mauzeDir.exists()) {
                    mauzeDir.mkdirs();
                }
                File destFile = new File(mauzeDir, fileName);
                try (FileOutputStream fos = new FileOutputStream(destFile)) {
                    fos.write(fileBytes);
                    fos.flush();
                }
                Intent intent = new Intent(Intent.ACTION_MEDIA_SCANNER_SCAN_FILE);
                intent.setData(Uri.fromFile(destFile));
                sendBroadcast(intent);
                runOnUiThread(() ->
                    Toast.makeText(MainActivity.this,
                            "Saved to Mauze Tahfeez/" + subfolder + "/",
                            Toast.LENGTH_SHORT).show()
                );
                return true;
            } catch (Exception ignored) {
                return false;
            }
        }
    }

    private void configureWebView() {
        WebSettings settings = webView.getSettings();

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        }

        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);

        settings.setRenderPriority(WebSettings.RenderPriority.HIGH);
        settings.setLayoutAlgorithm(WebSettings.LayoutAlgorithm.NARROW_COLUMNS);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);

        settings.setJavaScriptEnabled(true);
        settings.setJavaScriptCanOpenWindowsAutomatically(true);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true);
        }

        settings.setLoadsImagesAutomatically(true);
        settings.setBlockNetworkImage(false);

        settings.setAllowFileAccess(true);
        settings.setAllowFileAccessFromFileURLs(true);
        settings.setAllowUniversalAccessFromFileURLs(true);

        webView.addJavascriptInterface(
                new MauzeDownloadInterface(), "MauzeDownloader");
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_BACK) {
            if (webView != null && webView.canGoBack()) {
                webView.goBack();
                return true;
            }
        }
        return super.onKeyDown(keyCode, event);
    }

    private void setupDownloadListener() {
        WebView webView = getBridge().getWebView();

        if (webView == null) {
            webView.post(this::attachDownloadListener);
        } else {
            attachDownloadListener();
        }
    }

    private static String getMauzeSubfolder(String fileName) {
        String lower = fileName.toLowerCase();
        if (lower.endsWith(".pdf")) return "PDF";
        if (lower.endsWith(".csv")) return "CSV";
        if (lower.endsWith(".png") || lower.endsWith(".jpg")
            || lower.endsWith(".jpeg") || lower.endsWith(".gif")
            || lower.endsWith(".webp")) return "Images";
        if (lower.endsWith(".zip") || lower.endsWith(".rar")
            || lower.endsWith(".7z")) return "Archives";
        return "Other";
    }

    private static String getMimeType(String fileName) {
        String lower = fileName.toLowerCase();
        if (lower.endsWith(".pdf")) return "application/pdf";
        if (lower.endsWith(".csv")) return "text/csv";
        if (lower.endsWith(".png")) return "image/png";
        if (lower.endsWith(".jpg") || lower.endsWith(".jpeg"))
            return "image/jpeg";
        if (lower.endsWith(".gif")) return "image/gif";
        if (lower.endsWith(".webp")) return "image/webp";
        if (lower.endsWith(".zip")) return "application/zip";
        if (lower.endsWith(".rar"))
            return "application/x-rar-compressed";
        if (lower.endsWith(".7z"))
            return "application/x-7z-compressed";
        return "application/octet-stream";
    }

    private void attachDownloadListener() {
        WebView webView = getBridge().getWebView();
        if (webView == null) return;

        webView.setDownloadListener(new DownloadListener() {
            @Override
            public void onDownloadStart(String url, String userAgent,
                    String contentDisposition, String mimeType,
                    long contentLength) {

                String fileName = guessFileName(
                        url, contentDisposition, mimeType);

                String subfolder = getMauzeSubfolder(fileName);
                String relativePath = "Mauze Tahfeez/"
                        + subfolder + "/" + fileName;

                try {
                    DownloadManager.Request request =
                            new DownloadManager.Request(Uri.parse(url));

                    request.setTitle(fileName);
                    request.setDescription(
                            "Saving to Mauze Tahfeez/" + subfolder + "/");

                    request.setAllowedOverMetered(true);
                    request.setAllowedOverRoaming(true);

                    request.setNotificationVisibility(
                            DownloadManager.Request
                                    .VISIBILITY_VISIBLE_NOTIFY_COMPLETED);

                    if (Build.VERSION.SDK_INT >= 30) {
                        ContentValues values = new ContentValues();
                        values.put(MediaStore.Downloads.DISPLAY_NAME, fileName);
                        values.put(MediaStore.Downloads.MIME_TYPE,
                                mimeType != null ? mimeType : getMimeType(fileName));
                        values.put(MediaStore.Downloads.RELATIVE_PATH,
                                "Mauze Tahfeez/" + subfolder);
                        Uri destUri = getContentResolver().insert(
                                MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                        if (destUri != null) {
                            request.setDestinationUri(destUri);
                        } else {
                            request.setDestinationInExternalPublicDir(
                                    Environment.DIRECTORY_DOWNLOADS,
                                    relativePath);
                        }
                    } else {
                        request.setDestinationInExternalPublicDir(
                                Environment.DIRECTORY_DOWNLOADS,
                                relativePath);
                    }

                    String cookies =
                            CookieManager.getInstance().getCookie(url);
                    if (cookies != null && !cookies.isEmpty()) {
                        request.addRequestHeader("Cookie", cookies);
                    }

                    request.addRequestHeader("User-Agent", userAgent);

                    if (mimeType != null && !mimeType.isEmpty()) {
                        request.setMimeType(mimeType);
                    }

                    DownloadManager dm = (DownloadManager)
                            getSystemService(Context.DOWNLOAD_SERVICE);
                    if (dm != null) {
                        dm.enqueue(request);

                        runOnUiThread(() ->
                            Toast.makeText(MainActivity.this,
                                    "Downloading to Mauze Tahfeez/"
                                            + subfolder + "/",
                                    Toast.LENGTH_SHORT).show()
                        );
                    }
                } catch (Exception e) {
                    runOnUiThread(() ->
                        Toast.makeText(MainActivity.this,
                                "Download started in browser...",
                                Toast.LENGTH_SHORT).show()
                    );

                    Intent intent = new Intent(
                            Intent.ACTION_VIEW, Uri.parse(url));
                    startActivity(intent);
                }
            }
        });
    }

    private static String guessFileName(String url,
            String contentDisposition, String mimeType) {
        String fileName = URLUtil.guessFileName(
                url, contentDisposition, mimeType);

        if (fileName != null) {
            fileName = fileName.replaceAll("[/\\\\:*?\"<>|]", "_");
        }

        return fileName;
    }
}
