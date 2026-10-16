package uz.smartmenyu.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ServiceInfo;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.net.wifi.WifiManager;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;

import androidx.core.app.NotificationCompat;

import org.eclipse.paho.client.mqttv3.IMqttDeliveryToken;
import org.eclipse.paho.client.mqttv3.MqttAsyncClient;
import org.eclipse.paho.client.mqttv3.MqttCallbackExtended;
import org.eclipse.paho.client.mqttv3.MqttConnectOptions;
import org.eclipse.paho.client.mqttv3.MqttMessage;
import org.eclipse.paho.client.mqttv3.persist.MemoryPersistence;

import java.util.HashSet;
import java.util.Set;

import javax.net.ssl.SSLSocketFactory;

// Oshxona planshetining doimiy xizmati: ekran o'chiq yoki qulflangan bo'lsa ham serverdagi buyurtmalarni tinglaydi.
// Yangi buyurtma kelsa: ekran yonadi, ilova ochiladi, signal chalinadi va bildirishnoma chiqadi.
// Buyurtma mazmuni shifrlangan; xizmat faqat yangi buyurtma raqami paydo bo'lganini ko'radi, mazmunni ilova o'zi ochadi.
public class KitchenService extends Service {
    public static final String PREFS = "kitchen";
    private static final String CH_RUN = "kitchen_run";
    private static final String CH_ORDER = "kitchen_order_v1";
    private static final int ID_RUN = 1;
    private static final int ID_ORDER = 2;

    private MqttAsyncClient client;
    private PowerManager.WakeLock cpuLock;
    private WifiManager.WifiLock wifiLock;
    private final Set<String> seen = new HashSet<>();
    private boolean synced = false; // birinchi ulanishdagi eski buyurtmalar signal bermaydi
    private final Handler main = new Handler(Looper.getMainLooper());

    public static void start(Context ctx) {
        Intent i = new Intent(ctx, KitchenService.class);
        if (Build.VERSION.SDK_INT >= 26) ctx.startForegroundService(i); else ctx.startService(i);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        channels();
        Notification n = new NotificationCompat.Builder(this, CH_RUN)
                .setSmallIcon(android.R.drawable.ic_popup_reminder)
                .setContentTitle("Smart Menyu: oshxona")
                .setContentText("Yangi buyurtmalar kutilmoqda")
                .setOngoing(true)
                .setContentIntent(openApp())
                .build();
        if (Build.VERSION.SDK_INT >= 34) startForeground(ID_RUN, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
        else startForeground(ID_RUN, n);

        SharedPreferences p = getSharedPreferences(PREFS, MODE_PRIVATE);
        if (!p.getBoolean("active", false)) { stopSelf(); return START_NOT_STICKY; }
        locks();
        connect(p);
        return START_STICKY;
    }

    private void locks() {
        if (cpuLock == null) {
            PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
            cpuLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "smartmenyu:kitchen");
            cpuLock.setReferenceCounted(false);
            cpuLock.acquire();
        }
        if (wifiLock == null) {
            WifiManager wm = (WifiManager) getApplicationContext().getSystemService(WIFI_SERVICE);
            if (wm != null) {
                wifiLock = wm.createWifiLock(WifiManager.WIFI_MODE_FULL_HIGH_PERF, "smartmenyu:kitchen");
                wifiLock.setReferenceCounted(false);
                wifiLock.acquire();
            }
        }
    }

    private void connect(SharedPreferences p) {
        final String url = p.getString("url", "");
        final String topic = p.getString("topic", "");
        if (url.isEmpty() || topic.isEmpty()) return;
        disconnect();
        seen.clear();
        synced = false;
        try {
            client = new MqttAsyncClient(url, "menyu_kds_" + Long.toHexString(System.nanoTime()), new MemoryPersistence());
            MqttConnectOptions o = new MqttConnectOptions();
            o.setCleanSession(true);
            o.setAutomaticReconnect(true);
            o.setKeepAliveInterval(30);
            o.setConnectionTimeout(15);
            o.setMaxReconnectDelay(15000);
            String user = p.getString("user", "");
            if (!user.isEmpty()) { o.setUserName(user); o.setPassword(p.getString("pass", "").toCharArray()); }
            if (url.startsWith("wss") || url.startsWith("ssl")) o.setSocketFactory(SSLSocketFactory.getDefault());
            client.setCallback(new MqttCallbackExtended() {
                @Override public void connectComplete(boolean reconnect, String serverURI) {
                    try { client.subscribe(topic, 1); } catch (Exception ignored) {}
                    if (!synced) main.postDelayed(() -> synced = true, 4000);
                }
                @Override public void connectionLost(Throwable cause) {}
                @Override public void messageArrived(String t, MqttMessage m) { onOrder(t, m); }
                @Override public void deliveryComplete(IMqttDeliveryToken token) {}
            });
            client.connect(o);
        } catch (Exception e) {
            main.postDelayed(() -> connect(getSharedPreferences(PREFS, MODE_PRIVATE)), 10000);
        }
    }

    private void onOrder(String topic, MqttMessage m) {
        if (m.getPayload() == null || m.getPayload().length == 0) return; // buyurtma o'chirildi
        String id = topic.substring(topic.lastIndexOf('/') + 1);
        boolean isNew = seen.add(id);
        // Eski (saqlangan) buyurtmalar faqat birinchi ulanishda e'tiborsiz qoladi; keyin har yangi raqam signal beradi
        if (isNew && synced) main.post(this::alert);
    }

    // Yangi buyurtma: ekranni yoqish, ilovani oldinga chiqarish, signal
    private void alert() {
        PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
        boolean screenOn = pm.isInteractive();
        if (screenOn && MainActivity.visible) return; // ilova ekranda: signalni sahifaning o'zi beradi

        @SuppressWarnings("deprecation")
        PowerManager.WakeLock wake = pm.newWakeLock(PowerManager.SCREEN_BRIGHT_WAKE_LOCK | PowerManager.ACQUIRE_CAUSES_WAKEUP | PowerManager.ON_AFTER_RELEASE, "smartmenyu:wake");
        wake.acquire(20000);

        SharedPreferences p = getSharedPreferences(PREFS, MODE_PRIVATE);
        PendingIntent open = openApp();
        NotificationCompat.Builder b = new NotificationCompat.Builder(this, CH_ORDER)
                .setSmallIcon(android.R.drawable.ic_popup_reminder)
                .setContentTitle("🔔 Yangi buyurtma")
                .setContentText(p.getString("title", "Oshxona") + ": oshxona ekranini oching")
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setCategory(NotificationCompat.CATEGORY_ALARM)
                .setAutoCancel(true)
                .setContentIntent(open)
                .setFullScreenIntent(open, true)
                .setVibrate(new long[]{0, 400, 200, 400});
        if (p.getBoolean("sound", true)) b.setSound(sound());
        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        nm.notify(ID_ORDER, b.build());

        try { startActivity(new Intent(this, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT)); } catch (Exception ignored) {}
        main.postDelayed(() -> nm.cancel(ID_ORDER), 60000);
    }

    private Uri sound() {
        Uri u = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
        return u != null ? u : RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
    }

    private PendingIntent openApp() {
        Intent i = new Intent(this, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT);
        int f = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0);
        return PendingIntent.getActivity(this, 0, i, f);
    }

    private void channels() {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        NotificationChannel run = new NotificationChannel(CH_RUN, "Oshxona xizmati", NotificationManager.IMPORTANCE_LOW);
        nm.createNotificationChannel(run);
        NotificationChannel ord = new NotificationChannel(CH_ORDER, "Yangi buyurtmalar", NotificationManager.IMPORTANCE_HIGH);
        ord.setSound(sound(), new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_NOTIFICATION_EVENT).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build());
        ord.enableVibration(true);
        ord.setVibrationPattern(new long[]{0, 400, 200, 400});
        ord.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        ord.setBypassDnd(true);
        nm.createNotificationChannel(ord);
    }

    private void disconnect() {
        if (client == null) return;
        try { client.disconnectForcibly(1000, 1000); } catch (Exception ignored) {}
        try { client.close(true); } catch (Exception ignored) {}
        client = null;
    }

    @Override
    public void onDestroy() {
        disconnect();
        if (cpuLock != null && cpuLock.isHeld()) cpuLock.release();
        if (wifiLock != null && wifiLock.isHeld()) wifiLock.release();
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }
}
