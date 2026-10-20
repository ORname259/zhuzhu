package com.zhuzhucheng.app;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "ScaleBridge")
public class ScaleBridgePlugin extends Plugin {

    /** 取出小组件产生的待合并记录，取完即清空 */
    @PluginMethod
    public void pullPending(PluginCall call) {
        String raw = ZzcStore.drainPending(getContext());
        JSObject ret = new JSObject();
        ret.put("records", raw == null ? "[]" : raw);
        call.resolve(ret);
    }

    /** App 每次存盘后把最新体重推给原生，小组件据此显示 */
    @PluginMethod
    public void pushState(PluginCall call) {
        String jinStr = call.getString("jin");
        String tsStr = call.getString("ts");
        if (jinStr != null && tsStr != null) {
            try {
                double jin = Double.parseDouble(jinStr);
                long ts = (long) Double.parseDouble(tsStr);
                if (jin >= 15 && jin <= 1000) {
                    ZzcStore.saveMirror(getContext(), jin, ts);
                    ScaleWidgetProvider.updateAll(getContext());
                }
            } catch (NumberFormatException ignored) {
            }
        }
        call.resolve();
    }

    /** 回到前台时刷新小组件显示 */
    @PluginMethod
    public void refreshWidget(PluginCall call) {
        ScaleWidgetProvider.updateAll(getContext());
        call.resolve();
    }
}
