package com.zhuzhucheng.app;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * 桌面小组件与 WebView 共用的本地镜像。
 * 小组件改的是镜像 + 待合并队列，App 打开时把队列并进去，再把最新状态推回来。
 */
public class ZzcStore {

    public static final String PREFS = "zzc";
    public static final String KEY_JIN = "lastJin";
    public static final String KEY_TS = "lastTs";
    public static final String KEY_PENDING = "pending";

    public static SharedPreferences sp(Context c) {
        return c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    public static void saveMirror(Context c, double jin, long ts) {
        sp(c).edit().putFloat(KEY_JIN, (float) jin).putLong(KEY_TS, ts).apply();
    }

    public static double lastJin(Context c) {
        return sp(c).getFloat(KEY_JIN, 0f);
    }

    public static long lastTs(Context c) {
        return sp(c).getLong(KEY_TS, 0L);
    }

    /** 小组件上的 +/- 微调：不打开 App 直接记一条，进待合并队列 */
    public static void addDelta(Context c, double delta) {
        SharedPreferences p = sp(c);
        float cur = p.getFloat(KEY_JIN, 0f);
        if (cur <= 0f) return;
        double next = Math.round((cur + delta) * 100d) / 100d;
        if (next < 15d || next > 1000d) return;
        long ts = System.currentTimeMillis();
        try {
            JSONArray arr = new JSONArray(p.getString(KEY_PENDING, "[]"));
            JSONObject o = new JSONObject();
            o.put("jin", next);
            o.put("ts", ts);
            o.put("note", delta == 0d ? "桌面小组件 · 和上次一样" : "桌面小组件");
            arr.put(o);
            if (arr.length() > 200) {
                JSONArray trimmed = new JSONArray();
                for (int i = arr.length() - 200; i < arr.length(); i++) trimmed.put(arr.get(i));
                arr = trimmed;
            }
            p.edit().putString(KEY_PENDING, arr.toString())
                    .putFloat(KEY_JIN, (float) next)
                    .putLong(KEY_TS, ts)
                    .apply();
        } catch (Exception ignored) {
        }
    }

    public static String drainPending(Context c) {
        SharedPreferences p = sp(c);
        String raw = p.getString(KEY_PENDING, "[]");
        p.edit().remove(KEY_PENDING).apply();
        return raw;
    }
}
