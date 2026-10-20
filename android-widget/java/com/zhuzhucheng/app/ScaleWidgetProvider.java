package com.zhuzhucheng.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.widget.RemoteViews;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

public class ScaleWidgetProvider extends AppWidgetProvider {

    public static final String ACTION_DELTA = "com.zhuzhucheng.app.action.DELTA";
    public static final String EXTRA_DELTA = "delta";

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        for (int id : ids) render(context, manager, id);
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent != null && ACTION_DELTA.equals(intent.getAction())) {
            ZzcStore.addDelta(context, intent.getDoubleExtra(EXTRA_DELTA, 0d));
            updateAll(context);
        }
        super.onReceive(context, intent);
    }

    public static void updateAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        ComponentName name = new ComponentName(context, ScaleWidgetProvider.class);
        int[] ids = manager.getAppWidgetIds(name);
        for (int id : ids) render(context, manager, id);
    }

    private static void render(Context context, AppWidgetManager manager, int widgetId) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_scale);
        SharedPreferences sp = ZzcStore.sp(context);
        float jin = sp.getFloat(ZzcStore.KEY_JIN, 0f);
        long ts = sp.getLong(ZzcStore.KEY_TS, 0L);

        if (jin > 0f) {
            views.setTextViewText(R.id.widget_value, fmtJin(jin));
            views.setTextViewText(R.id.widget_date,
                    new SimpleDateFormat("M月d日 HH:mm", Locale.CHINA).format(new Date(ts)));
        } else {
            views.setTextViewText(R.id.widget_value, "—");
            views.setTextViewText(R.id.widget_date, "打开一次猪猪称，之后就能在桌面直接记");
        }

        views.setOnClickPendingIntent(R.id.btn_d1, deltaIntent(context, -1d, 1));
        views.setOnClickPendingIntent(R.id.btn_d2, deltaIntent(context, -0.1d, 2));
        views.setOnClickPendingIntent(R.id.btn_same, deltaIntent(context, 0d, 5));
        views.setOnClickPendingIntent(R.id.btn_d3, deltaIntent(context, 0.1d, 3));
        views.setOnClickPendingIntent(R.id.btn_d4, deltaIntent(context, 1d, 4));

        Intent open = new Intent(context, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        views.setOnClickPendingIntent(R.id.widget_body,
                PendingIntent.getActivity(context, 10, open, pendingFlags()));

        manager.updateAppWidget(widgetId, views);
    }

    private static PendingIntent deltaIntent(Context context, double delta, int requestCode) {
        Intent intent = new Intent(context, ScaleWidgetProvider.class);
        intent.setAction(ACTION_DELTA);
        intent.putExtra(EXTRA_DELTA, delta);
        return PendingIntent.getBroadcast(context, requestCode, intent, pendingFlags());
    }

    private static int pendingFlags() {
        return PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
    }

    private static String fmtJin(float v) {
        boolean oneDecimal = Math.abs(v * 10d - Math.rint(v * 10d)) < 0.01d;
        return String.format(Locale.US, oneDecimal ? "%.1f" : "%.2f", v);
    }
}
