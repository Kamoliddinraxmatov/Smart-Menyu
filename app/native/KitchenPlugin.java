package uz.smartmenyu.app;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

// Oshxona rejimi: sahifa JavaScript'idan chaqiriladi (js/kitchen.js).
// start: xizmatni yoqadi (buyurtmalarni ekran o'chiq bo'lsa ham tinglaydi), ekran o'chmaydi.
// stop: oshxona ekranidan chiqilganda xizmatni o'chiradi.
@CapacitorPlugin(name = "Kitchen")
public class KitchenPlugin extends Plugin {

    @PluginMethod
    public void start(PluginCall call) {
        Context ctx = getContext();
        SharedPreferences.Editor e = ctx.getSharedPreferences(KitchenService.PREFS, Context.MODE_PRIVATE).edit();
        e.putBoolean("active", true);
        e.putString("url", call.getString("url", ""));
        e.putString("topic", call.getString("topic", ""));
        e.putString("user", call.getString("user", ""));
        e.putString("pass", call.getString("pass", ""));
        e.putString("title", call.getString("title", "Oshxona"));
        e.putBoolean("sound", call.getBoolean("sound", true));
        e.apply();

        askPermissions();
        KitchenService.start(ctx);
        getActivity().runOnUiThread(() -> MainActivity.applyKitchenWindow(getActivity(), true));
        call.resolve();
    }

    @PluginMethod
    public void stop(PluginCall call) {
        Context ctx = getContext();
        ctx.getSharedPreferences(KitchenService.PREFS, Context.MODE_PRIVATE).edit().putBoolean("active", false).apply();
        ctx.stopService(new Intent(ctx, KitchenService.class));
        getActivity().runOnUiThread(() -> MainActivity.applyKitchenWindow(getActivity(), false));
        call.resolve();
    }

    // Bildirishnoma ruxsati (Android 13+) va batareya tejash rejimidan chiqarish (bir marta so'raladi)
    private void askPermissions() {
        Context ctx = getContext();
        if (Build.VERSION.SDK_INT >= 33 && ctx.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            getActivity().requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 7101);
        }
        SharedPreferences p = ctx.getSharedPreferences(KitchenService.PREFS, Context.MODE_PRIVATE);
        if (Build.VERSION.SDK_INT >= 23 && !p.getBoolean("askedBattery", false)) {
            p.edit().putBoolean("askedBattery", true).apply();
            PowerManager pm = (PowerManager) ctx.getSystemService(Context.POWER_SERVICE);
            if (pm != null && !pm.isIgnoringBatteryOptimizations(ctx.getPackageName())) {
                try {
                    Intent i = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:" + ctx.getPackageName()));
                    getActivity().startActivity(i);
                } catch (Exception ignored) {}
            }
        }
    }
}
