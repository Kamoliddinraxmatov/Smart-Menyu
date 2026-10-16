package uz.smartmenyu.app;

import android.app.Activity;
import android.app.KeyguardManager;
import android.content.Context;
import android.os.Build;
import android.os.Bundle;
import android.view.WindowManager;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    public static volatile boolean visible = false;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(KitchenPlugin.class);
        super.onCreate(savedInstanceState);
        boolean kitchen = getSharedPreferences(KitchenService.PREFS, Context.MODE_PRIVATE).getBoolean("active", false);
        applyKitchenWindow(this, kitchen);
    }

    @Override
    public void onResume() {
        super.onResume();
        visible = true;
        if (getSharedPreferences(KitchenService.PREFS, Context.MODE_PRIVATE).getBoolean("active", false)) {
            applyKitchenWindow(this, true);
            KitchenService.start(this); // tizim xizmatni to'xtatgan bo'lsa, qayta yoqiladi
        }
    }

    @Override
    public void onPause() {
        visible = false;
        super.onPause();
    }

    // Oshxona rejimi: ekran o'chmaydi, qulflangan ekran ustida ham ochiladi va o'zi yonadi
    public static void applyKitchenWindow(Activity a, boolean on) {
        int flags = WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON;
        if (Build.VERSION.SDK_INT >= 27) {
            a.setShowWhenLocked(on);
            a.setTurnScreenOn(on);
        } else {
            flags |= WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON | WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD;
        }
        if (on) a.getWindow().addFlags(flags); else a.getWindow().clearFlags(flags);
        if (on && Build.VERSION.SDK_INT >= 26) {
            KeyguardManager km = (KeyguardManager) a.getSystemService(Context.KEYGUARD_SERVICE);
            if (km != null && km.isKeyguardLocked() && !km.isKeyguardSecure()) km.requestDismissKeyguard(a, null);
        }
    }
}
