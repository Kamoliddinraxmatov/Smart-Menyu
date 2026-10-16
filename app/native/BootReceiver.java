package uz.smartmenyu.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

// Planshet qayta yoqilganda oshxona xizmati o'zi ishga tushadi
public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context ctx, Intent intent) {
        if (!Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())) return;
        if (ctx.getSharedPreferences(KitchenService.PREFS, Context.MODE_PRIVATE).getBoolean("active", false)) {
            try { KitchenService.start(ctx); } catch (Exception ignored) {}
        }
    }
}
