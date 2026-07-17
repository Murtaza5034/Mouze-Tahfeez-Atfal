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
import android.provider.DocumentsContract;
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

import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.BridgeActivity;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

public class MainActivity extends BridgeActivity {

    private static final int STORAGE_PERMISSION_REQUEST_CODE = 1001;

    private WebView webView;
    private ActivityResultLauncher<Intent> storageAccessLauncher;
    private SharedPreferences prefs;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        prefs = getSharedPreferences("mauze_prefs", MODE_PRIVATE);

        storageAccessLauncher = registerForActivityResult(
            new ActivityResultContracts.StartActivityForResult(),
            result -> {
                if (result.getResultCode() == RESULT_OK && result.getData() != null) {
                    Uri treeUri = result.getData().getData();
                    if (treeUri != null) {
                        getContentResolver().takePersistableUriPermission(treeUri,
                            Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
                        prefs.edit().putString("save_location_uri", treeUri.toString()).apply();
                        runOnUiThread(() ->
                            Toast.makeText(MainActivity.this, "Save folder set!", Toast.LENGTH_SHORT).show()
                        );
                        notifyJsStorageReady(true);
                        return;
                    }
                }
                notifyJsStorageReady(false);
            }
        );

        super.onCreate(savedInstanceState);

        getBridge().getWebView().post(() -> {
            webView = getBridge().getWebView();
            if (webView != null) {
                configureWebView();
            }
        });

        setupDownloadListener();
    }

    private void notifyJsStorageReady(boolean success) {
        if (webView != null) {
            webView.evaluateJavascript(
                "javascript:(function(){if(window.__mauzeStorageCb){window.__mauzeStorageCb(" + success + ");window.__mauzeStorageCb=null;}})()",
                null
            );
        }
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
        public void download(String base64Data, String fileName) {
            try {
                byte[] fileBytes = Base64.decode(base64Data, Base64.DEFAULT);
                String subfolder = getMauzeSubfolder(fileName);
                String savedUri = prefs.getString("save_location_uri", null);

                if (savedUri != null) {
                    saveViaSAF(Uri.parse(savedUri), fileBytes, fileName, subfolder);
                } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    saveViaMediaStore(fileBytes, fileName, subfolder);
                } else {
                    saveViaDirectFile(fileBytes, fileName, subfolder);
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

        @JavascriptInterface
        public void requestStorageAccess() {
            Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION
                          | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
            storageAccessLauncher.launch(intent);
        }

        @JavascriptInterface
        public boolean isStorageAccessGranted() {
            return prefs.getString("save_location_uri", null) != null;
        }

        @JavascriptInterface
        public String getSaveLocationPath() {
            String uri = prefs.getString("save_location_uri", "");
            return uri.isEmpty() ? "Not set" : uri;
        }

        private void saveViaSAF(Uri treeUri, byte[] fileBytes,
                                String fileName, String subfolder) throws Exception {
            Uri mauzeDir = ensureSubfolder(treeUri, "Mauze Tahfeez");
            if (mauzeDir == null) {
                runOnUiThread(() -> Toast.makeText(MainActivity.this,
                        "Could not create save folder. Please re-select.",
                        Toast.LENGTH_LONG).show());
                prefs.edit().remove("save_location_uri").apply();
                notifyJsStorageReady(false);
                return;
            }
            Uri subDir = ensureSubfolder(mauzeDir, subfolder);
            if (subDir == null) subDir = mauzeDir;

            String mimeType = getMimeType(fileName);
            Uri fileUri = DocumentsContract.createDocument(
                    getContentResolver(), subDir, mimeType, fileName);
            if (fileUri == null) {
                String base = fileName.contains(".")
                    ? fileName.substring(0, fileName.lastIndexOf('.'))
                    : fileName;
                String ext = fileName.contains(".")
                    ? fileName.substring(fileName.lastIndexOf('.'))
                    : "";
                fileUri = DocumentsContract.createDocument(
                    getContentResolver(), subDir, mimeType,
                    base + "_" + System.currentTimeMillis() + ext);
            }
            if (fileUri != null) {
                try (OutputStream os = getContentResolver().openOutputStream(fileUri)) {
                    os.write(fileBytes);
                }
                runOnUiThread(() ->
                    Toast.makeText(MainActivity.this,
                            "Saved to your folder/" + subfolder + "/",
                            Toast.LENGTH_SHORT).show()
                );
            }
        }

        private Uri ensureSubfolder(Uri parentUri, String name) throws Exception {
            Uri childrenUri = DocumentsContract.buildChildDocumentsUriUsingTree(
                    parentUri, DocumentsContract.getTreeDocumentId(parentUri));
            try (android.database.Cursor c = getContentResolver().query(childrenUri,
                    new String[]{
                        DocumentsContract.Document.COLUMN_DOCUMENT_ID,
                        DocumentsContract.Document.COLUMN_DISPLAY_NAME,
                        DocumentsContract.Document.COLUMN_MIME_TYPE
                    }, null, null, null)) {
                while (c != null && c.moveToNext()) {
                    String mime = c.getString(2);
                    String displayName = c.getString(1);
                    if (DocumentsContract.Document.MIME_TYPE_DIR.equals(mime)
                            && name.equals(displayName)) {
                        String docId = c.getString(0);
                        return DocumentsContract.buildDocumentUriUsingTree(
                                parentUri, docId);
                    }
                }
            } catch (Exception ignored) {}
            return DocumentsContract.createDocument(
                    getContentResolver(), parentUri,
                    DocumentsContract.Document.MIME_TYPE_DIR, name);
        }

        private void saveViaMediaStore(byte[] fileBytes, String fileName,
                                       String subfolder) throws Exception {
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
        }

        private void saveViaDirectFile(byte[] fileBytes, String fileName,
                                       String subfolder) throws Exception {
            if (ContextCompat.checkSelfPermission(MainActivity.this,
                    android.Manifest.permission.WRITE_EXTERNAL_STORAGE)
                    != PackageManager.PERMISSION_GRANTED) {
                requestStoragePermission();
                runOnUiThread(() ->
                    Toast.makeText(MainActivity.this,
                            "Storage permission needed. Please try again.",
                            Toast.LENGTH_LONG).show()
                );
                return;
            }
            File downloadsDir = Environment.getExternalStoragePublicDirectory(
                    Environment.DIRECTORY_DOWNLOADS);
            File mauzeDir = new File(downloadsDir,
                    "Mauze Tahfeez/" + subfolder);
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

                    request.setDestinationInExternalPublicDir(
                            Environment.DIRECTORY_DOWNLOADS,
                            relativePath
                    );

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
