const { withAndroidManifest } = require('@expo/config-plugins');

const ADMOB_APP_ID = 'ca-app-pub-3769855629143605~9438574844';
const META_KEY = 'com.google.android.gms.ads.APPLICATION_ID';

/**
 * Adds the AdMob Application ID meta-data to AndroidManifest.xml.
 * This replaces the built-in react-native-google-mobile-ads config plugin
 * which has compatibility issues with some EAS build environments.
 */
module.exports = function withAdMob(config) {
  return withAndroidManifest(config, function (config) {
    var manifest = config.modResults;
    var application = manifest.manifest.application[0];
    if (!application['meta-data']) {
      application['meta-data'] = [];
    }
    var existing = application['meta-data'].find(function (item) {
      return item.$ && item.$['android:name'] === META_KEY;
    });
    if (existing) {
      existing.$['android:value'] = ADMOB_APP_ID;
    } else {
      application['meta-data'].push({
        $: {
          'android:name': META_KEY,
          'android:value': ADMOB_APP_ID,
        },
      });
    }
    return config;
  });
};
