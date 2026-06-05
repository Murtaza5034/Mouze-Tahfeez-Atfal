package com.mauze.tahfeez;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.plugins.PushNotifications;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(PushNotifications.class);
        super.onCreate(savedInstanceState);
    }
}
