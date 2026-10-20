#!/usr/bin/env bash
# 把桌面小组件的原生文件注入到 cap add android 生成的工程里
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PKG="com.zhuzhucheng.app"
PKG_PATH="${PKG//.//}"
ANDROID="$ROOT/android"
JAVA_DIR="$ANDROID/app/src/main/java/$PKG_PATH"
MAIN="$ANDROID/app/src/main"

[ -d "$ANDROID" ] || { echo "!! 没有 android/ 目录，先跑 npx cap add android"; exit 1; }
mkdir -p "$JAVA_DIR"

echo "→ 拷贝 Java 源码"
cp -v "$ROOT/android-widget/java/$PKG_PATH/"*.java "$JAVA_DIR/"

echo "→ 拷贝资源"
cp -rv "$ROOT/android-widget/res/." "$MAIN/res/"

MANIFEST="$MAIN/AndroidManifest.xml"
if grep -q "ScaleWidgetProvider" "$MANIFEST"; then
  echo "→ receiver 已存在，跳过"
else
  echo "→ 注入 receiver"
  python3 - "$MANIFEST" <<'PY'
import sys
BLOCK = '''        <receiver
            android:name="com.zhuzhucheng.app.ScaleWidgetProvider"
            android:exported="false"
            android:label="@string/widget_label">
            <intent-filter>
                <action android:name="android.appwidget.action.APPWIDGET_UPDATE" />
            </intent-filter>
            <meta-data
                android:name="android.appwidget.provider"
                android:resource="@xml/scale_widget_info" />
        </receiver>

    </application>'''
path = sys.argv[1]
with open(path, encoding='utf-8') as fh:
    text = fh.read()
if '</application>' not in text:
    sys.exit('!! AndroidManifest.xml 里找不到 </application>')
with open(path, 'w', encoding='utf-8') as fh:
    fh.write(text.replace('</application>', BLOCK, 1))
print('   manifest patched')
PY
fi

echo "→ 校验"
grep -q "ScaleWidgetProvider" "$MANIFEST" || { echo "!! receiver 未注入"; exit 1; }
for f in ZzcStore ScaleBridgePlugin ScaleWidgetProvider MainActivity; do
  [ -f "$JAVA_DIR/$f.java" ] || { echo "!! 缺 $f.java"; exit 1; }
done
[ -f "$MAIN/res/layout/widget_scale.xml" ] || { echo "!! 缺 widget_scale.xml"; exit 1; }
[ -f "$MAIN/res/xml/scale_widget_info.xml" ] || { echo "!! 缺 scale_widget_info.xml"; exit 1; }
grep -q "registerPlugin(ScaleBridgePlugin" "$JAVA_DIR/MainActivity.java" || { echo "!! MainActivity 未注册插件"; exit 1; }
echo "OK 原生文件注入完成"
