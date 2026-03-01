const { withAndroidManifest, withMainActivity } = require('@expo/config-plugins');

// Custom plugin to configure Android for TV (Fire TV, Shield TV)
const withAndroidTV = (config) => {
  // Modify AndroidManifest.xml
  config = withAndroidManifest(config, async (config) => {
    const manifest = config.modResults.manifest;
    
    // Add uses-feature for TV compatibility
    if (!manifest['uses-feature']) {
      manifest['uses-feature'] = [];
    }
    
    const tvFeatures = [
      { $: { 'android:name': 'android.software.leanback', 'android:required': 'false' } },
      { $: { 'android:name': 'android.hardware.touchscreen', 'android:required': 'false' } },
      { $: { 'android:name': 'android.hardware.faketouch', 'android:required': 'false' } },
      { $: { 'android:name': 'android.hardware.telephony', 'android:required': 'false' } },
      { $: { 'android:name': 'android.hardware.camera', 'android:required': 'false' } },
      { $: { 'android:name': 'android.hardware.nfc', 'android:required': 'false' } },
      { $: { 'android:name': 'android.hardware.location.gps', 'android:required': 'false' } },
      { $: { 'android:name': 'android.hardware.microphone', 'android:required': 'false' } },
    ];
    
    // Add TV features
    tvFeatures.forEach((feature) => {
      const exists = manifest['uses-feature'].some(
        (f) => f.$['android:name'] === feature.$['android:name']
      );
      if (!exists) {
        manifest['uses-feature'].push(feature);
      }
    });
    
    // Find MainActivity
    const application = manifest.application[0];
    const mainActivity = application.activity.find(
      (activity) => activity.$['android:name'] === '.MainActivity'
    );
    
    if (mainActivity) {
      // Remove portrait orientation lock - allow landscape on TV
      mainActivity.$['android:screenOrientation'] = 'unspecified';
      
      // Add extra config changes for TV
      mainActivity.$['android:configChanges'] = 
        'keyboard|keyboardHidden|orientation|screenSize|screenLayout|uiMode|smallestScreenSize';
      mainActivity.$['android:resizeableActivity'] = 'true';
      
      // Add LEANBACK_LAUNCHER intent filter for Android TV
      if (!mainActivity['intent-filter']) {
        mainActivity['intent-filter'] = [];
      }
      
      const hasLeanback = mainActivity['intent-filter'].some((filter) =>
        filter.category?.some((cat) => cat.$['android:name'] === 'android.intent.category.LEANBACK_LAUNCHER')
      );
      
      if (!hasLeanback) {
        mainActivity['intent-filter'].push({
          action: [{ $: { 'android:name': 'android.intent.action.MAIN' } }],
          category: [{ $: { 'android:name': 'android.intent.category.LEANBACK_LAUNCHER' } }],
        });
      }
    }
    
    // Add banner to application for TV launcher
    application.$['android:banner'] = '@mipmap/ic_launcher';
    
    return config;
  });

  return config;
};

module.exports = withAndroidTV;
