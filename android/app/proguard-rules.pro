# ============================================
# ProGuard / R8 Rules for Capacitor Android AAB
# ============================================

# ============================================
# Capacitor Core & Bridge
# ============================================

# Keep the Capacitor bridge and ALL plugins (prevents "Plugin not implemented" errors)
-keep public class * extends com.getcapacitor.Plugin
-keep public class * extends com.getcapacitor.Plugin$* { *; }
-keep class com.getcapacitor.** { *; }
-keepclassmembers class * {
    @com.getcapacitor.annotation.CapacitorPlugin <methods>;
    @com.getcapacitor.PluginCallback <methods>;
    @com.getcapacitor.annotation.CapacitorCallback <methods>;
}
-keepattributes JavascriptInterface
-keepattributes *Annotation*

# Keep JavaScript interface methods used by the Capacitor WebView bridge
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Keep Capacitor's internal reflection-based class loading
-keep class * extends com.getcapacitor.Plugin {
    public <methods>;
}

# ============================================
# Capacitor Push Notifications Plugin
# ============================================
-keep class com.getcapacitor.pushnotifications.** { *; }
-keep class com.google.firebase.messaging.** { *; }

# ============================================
# Capawesome App Update Plugin
# ============================================
-keep class io.capawesome.capacitor.plugins.appupdate.** { *; }

# ============================================
# Firebase / Google Play Services
# ============================================
-keep class com.google.firebase.** { *; }
-keep class com.google.android.gms.** { *; }
-dontwarn com.google.firebase.ktx.Firebase
-dontwarn com.google.android.gms.**
-dontwarn com.google.firebase.iid.FirebaseInstanceId

# Firebase Messaging notification and data handling
-keep class com.google.firebase.messaging.** { *; }

# ============================================
# OkHttp (used internally by Capacitor for HTTP requests)
# ============================================
-keep class okhttp3.** { *; }
-keep interface okhttp3.** { *; }
-dontwarn okhttp3.**
-dontwarn okio.**
-keep class okio.** { *; }
-keep class okio.internal.** { *; }

# ============================================
# AndroidX Core & WebKit (needed for WebView functionality)
# ============================================
-keep class androidx.core.** { *; }
-keep class androidx.webkit.** { *; }
-keep class androidx.activity.** { *; }
-keep class androidx.fragment.** { *; }
-keep class androidx.lifecycle.** { *; }
-dontwarn androidx.webkit.**

# ============================================
# General Android / AndroidX Rules
# ============================================
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
-keep class * extends androidx.lifecycle.ViewModel { *; }
-keep class * implements android.os.Parcelable { *; }
-keep class * implements java.io.Serializable { *; }

# ============================================
# Suppress Known Warnings
# ============================================
-dontwarn com.getcapacitor.android.R$id
-dontwarn com.getcapacitor.android.R$layout
-dontwarn javax.annotation.**
-dontwarn org.codehaus.mojo.animal_sniffer.**

# ============================================
# Keep enums (used by Capacitor plugin annotations)
# ============================================
-keepclassmembers enum * {
    public static **[] values();
    public static ** valueOf(java.lang.String);
}

# ============================================
# Native method declarations
# ============================================
-keepclasseswithmembernames class * {
    native <methods>;
}
