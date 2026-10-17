# Restoran ilovasining Android loyihasiga oshxona xizmatini qo'shadi (CI'da "npx cap add android"dan keyin).
# Ishlatish: python3 tools/patch-android.py app/android
import sys, shutil, glob, os

root = sys.argv[1]
java = os.path.join(root, "app/src/main/java/uz/smartmenyu/app")
for f in glob.glob("app/native/*.java"):
    shutil.copy(f, java)

man = os.path.join(root, "app/src/main/AndroidManifest.xml")
s = open(man).read()
perms = [
    "android.permission.WAKE_LOCK",
    "android.permission.FOREGROUND_SERVICE",
    "android.permission.FOREGROUND_SERVICE_SPECIAL_USE",
    "android.permission.POST_NOTIFICATIONS",
    "android.permission.USE_FULL_SCREEN_INTENT",
    "android.permission.RECEIVE_BOOT_COMPLETED",
    "android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS",
    "android.permission.ACCESS_WIFI_STATE",
    "android.permission.DISABLE_KEYGUARD",
    "android.permission.VIBRATE",
    "android.permission.REQUEST_INSTALL_PACKAGES",
]
add = "".join(f'    <uses-permission android:name="{p}" />\n' for p in perms if p not in s)
s = s.replace("<application", add + "\n    <application", 1)
comp = '''
        <service android:name=".KitchenService" android:exported="false" android:foregroundServiceType="specialUse">
            <property android:name="android.app.PROPERTY_SPECIAL_USE_FGS_SUBTYPE" android:value="Restoran oshxonasi: yangi buyurtma signali" />
        </service>
        <receiver android:name=".BootReceiver" android:exported="true">
            <intent-filter><action android:name="android.intent.action.BOOT_COMPLETED" /></intent-filter>
        </receiver>
    </application>'''
assert "</application>" in s
s = s.replace("</application>", comp.replace("\n    </application>", "\n</application>"), 1)
if "androidx.core.content.FileProvider" not in s:
    s = s.replace("</application>", '''    <provider android:name="androidx.core.content.FileProvider" android:authorities="${applicationId}.fileprovider" android:exported="false" android:grantUriPermissions="true">
            <meta-data android:name="android.support.FILE_PROVIDER_PATHS" android:resource="@xml/file_paths" />
        </provider>
</application>''', 1)
open(man, "w").write(s)
assert ".KitchenService" in s

gr = os.path.join(root, "app/build.gradle")
g = open(gr).read()
dep = "    implementation 'org.eclipse.paho:org.eclipse.paho.client.mqttv3:1.2.5'\n"
if "paho" not in g:
    g = g.replace("dependencies {", "dependencies {\n" + dep, 1)
open(gr, "w").write(g)

# Ilovani o'zi yangilashi uchun (UpdaterPlugin): versiya raqami = CI ishga tushish raqami (release tegi v1.0.N bilan bir xil)
import re
run = os.environ.get("GITHUB_RUN_NUMBER")
if run:
    g = re.sub(r"versionCode \d+", "versionCode " + run, g)
    g = re.sub(r'versionName "[^"]*"', 'versionName "1.0.' + run + '"', g)
    assert "versionCode " + run in g
open(gr, "w").write(g)
# Yuklab olingan APK keshda turadi: FileProvider kesh papkasini ham bera olishi kerak
fp = os.path.join(root, "app/src/main/res/xml/file_paths.xml")
x = open(fp).read() if os.path.exists(fp) else '<?xml version="1.0" encoding="utf-8"?>\n<paths xmlns:android="http://schemas.android.com/apk/res/android">\n</paths>\n'
if "<cache-path" not in x:
    x = x.replace("</paths>", '    <cache-path name="sm_cache" path="." />\n</paths>')
os.makedirs(os.path.dirname(fp), exist_ok=True)
open(fp, "w").write(x)
print("oshxona xizmati va yangilanish qo'shildi")
