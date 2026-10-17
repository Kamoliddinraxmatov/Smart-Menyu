package uz.smartmenyu.app;

import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

// Ilovani o'zi yangilash (js/update.js chaqiradi).
// check: GitHub'dagi oxirgi versiyani o'rnatilgan versiya bilan solishtiradi.
// install: yangi APK'ni yuklab oladi va Android'ning "Yangilash" oynasini ochadi (odam bitta tugma bosadi).
@CapacitorPlugin(name = "Updater")
public class UpdaterPlugin extends Plugin {
    static final String LATEST = "https://api.github.com/repos/Kamoliddinraxmatov/Smart-Menyu/releases/latest";
    static final String APK = "https://github.com/Kamoliddinraxmatov/Smart-Menyu/releases/download/%s/SmartMenyu.apk";

    private long current() {
        try {
            Context ctx = getContext();
            PackageInfo p = ctx.getPackageManager().getPackageInfo(ctx.getPackageName(), 0);
            return Build.VERSION.SDK_INT >= 28 ? p.getLongVersionCode() : p.versionCode;
        } catch (Exception e) {
            return 0;
        }
    }

    @PluginMethod
    public void check(PluginCall call) {
        new Thread(() -> {
            try {
                HttpURLConnection c = (HttpURLConnection) new URL(LATEST).openConnection();
                c.setConnectTimeout(15000);
                c.setReadTimeout(15000);
                c.setRequestProperty("Accept", "application/vnd.github+json");
                ByteArrayOutputStream buf = new ByteArrayOutputStream();
                try (InputStream in = c.getInputStream()) {
                    byte[] b = new byte[8192];
                    int n;
                    while ((n = in.read(b)) > 0) buf.write(b, 0, n);
                }
                String tag = new JSONObject(buf.toString("UTF-8")).getString("tag_name");
                Matcher m = Pattern.compile("(\\d+)$").matcher(tag);
                long latest = m.find() ? Long.parseLong(m.group(1)) : 0;
                JSObject r = new JSObject();
                r.put("current", current());
                r.put("latest", latest);
                r.put("tag", tag);
                r.put("update", latest > current() && current() > 1);
                call.resolve(r);
            } catch (Exception e) {
                call.reject("Tekshirib bo'lmadi: " + e.getMessage());
            }
        }).start();
    }

    @PluginMethod
    public void install(PluginCall call) {
        Context ctx = getContext();
        // Android 8+: "Noma'lum ilovalarni o'rnatish" ruxsati bir marta beriladi
        if (Build.VERSION.SDK_INT >= 26 && !ctx.getPackageManager().canRequestPackageInstalls()) {
            Intent i = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + ctx.getPackageName()));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            ctx.startActivity(i);
            JSObject r = new JSObject();
            r.put("needPermission", true);
            call.resolve(r);
            return;
        }
        String tag = call.getString("tag", "");
        new Thread(() -> {
            try {
                File dir = new File(ctx.getCacheDir(), "update");
                dir.mkdirs();
                File f = new File(dir, "SmartMenyu.apk");
                HttpURLConnection c = (HttpURLConnection) new URL(String.format(APK, tag)).openConnection();
                c.setConnectTimeout(20000);
                c.setReadTimeout(30000);
                c.setInstanceFollowRedirects(true);
                long total = c.getContentLength();
                long got = 0;
                int last = -1;
                try (InputStream in = c.getInputStream(); OutputStream out = new FileOutputStream(f)) {
                    byte[] b = new byte[65536];
                    int n;
                    while ((n = in.read(b)) > 0) {
                        out.write(b, 0, n);
                        got += n;
                        int pct = total > 0 ? (int) (got * 100 / total) : 0;
                        if (pct != last) {
                            last = pct;
                            JSObject p = new JSObject();
                            p.put("percent", pct);
                            notifyListeners("progress", p);
                        }
                    }
                }
                if (total > 0 && got < total) throw new Exception("fayl to'liq yuklanmadi");
                Uri uri = FileProvider.getUriForFile(ctx, ctx.getPackageName() + ".fileprovider", f);
                Intent i = new Intent(Intent.ACTION_VIEW);
                i.setDataAndType(uri, "application/vnd.android.package-archive");
                i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
                ctx.startActivity(i);
                call.resolve(new JSObject());
            } catch (Exception e) {
                call.reject("Yuklab bo'lmadi: " + e.getMessage());
            }
        }).start();
    }
}
