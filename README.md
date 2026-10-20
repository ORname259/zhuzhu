# 猪猪称

只记一斤的体重记录。纯本地存储，不联网，无账号、无提醒、无社交。

## 目录

```
www/                 网页本体（Capacitor 的 webDir）
  index.html         主界面：记一斤 / 趋势 / 记录 / 我的
  quick.html         快捷录入页，只有一个数字键盘
  js/store.js        localStorage 数据层
  js/stats.js        统计、目标推算、周/月小结
  js/chart.js        Canvas 折线图 + 7 日均线
  js/app.js          主界面渲染与交互
  js/bridge.js       与原生小组件同步
android-widget/      桌面小组件的原生源码（Java / 布局 / 资源）
scripts/inject-android.sh   把上面的源码注入生成的安卓工程
assets/              @capacitor/assets 用的 1024 图标与开屏图
design/              原始小猪图
tools/               图标生成脚本、假 DOM 测试脚本
```

## 本地预览

直接用浏览器打开 `www/index.html` 就行（`file://` 可跑，数据存在本机）。
想测离线和服务缓存，用任意静态服务器指向 `www/`。

## 打 APK

推到 GitHub 后，Actions 会自动跑 `.github/workflows/build-android.yml`，
也可以在 Actions 页面手动点「运行工作流」。产物是 `zhuzhucheng-debug-apk`。

下载注意：Artifacts 下来是个 zip，解压得到 `app-debug.apk`，
传到手机上要把文件名改成以 `.apk` 结尾再安装；覆盖安装前建议先卸载旧的，
否则桌面图标可能还是系统缓存的旧图。

小组件：手机上先打开一次 App 记一笔，然后长按桌面空白处 →
小组件 → 找「猪猪称 · 记一斤」拖到桌面。之后点 -1 / -0.1 / 记一次 / +0.1 / +1
就能直接记，不用打开 App；下次进 App 会自动合并进记录。
