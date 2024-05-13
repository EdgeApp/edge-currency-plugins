package app.edge.reactnative.currencyplugins;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import java.util.HashMap;
import java.util.Map;

public class EdgeCurrencyPluginsModule extends ReactContextBaseJavaModule {
  EdgeCurrencyPluginsModule(ReactApplicationContext context) {
    super(context);
  }

  @Override
  public Map<String, Object> getConstants() {
    final Map<String, Object> constants = new HashMap<>();
    constants.put(
        "sourceUri",
        "file:///android_asset/edge-currency-plugins/edge-currency-plugins.js");
    return constants;
  }

  @Override
  public String getName() {
    return "EdgeCurrencyPluginsModule";
  }
}
