import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { BannerAd, BannerAdSize } from 'react-native-google-mobile-ads';

// Production Ad Unit IDs — registered in AdMob console under publisher ca-app-pub-3769855629143605
// App ID: ca-app-pub-3769855629143605~9438574844
const PROD_AD_UNIT_ID = Platform.select({
  android: 'ca-app-pub-3769855629143605/4294059376',
  ios: 'ca-app-pub-3769855629143605/4294059376',
}) ?? '';

// Google-provided test banner ID (safe for debug/development builds)
const TEST_AD_UNIT_ID = 'ca-app-pub-3940256099942544/6300978111';

interface AdBannerProps {
  isPremiumUser?: boolean;
}

export function AdBanner({ isPremiumUser = false }: AdBannerProps) {
  if (isPremiumUser) return null;

  const adUnitId =
    process.env.EXPO_PUBLIC_AD_MODE === 'production' ? PROD_AD_UNIT_ID : TEST_AD_UNIT_ID;

  return (
    <View style={styles.container}>
      <BannerAd
        unitId={adUnitId}
        size={BannerAdSize.ADAPTIVE_BANNER}
        requestOptions={{ requestNonPersonalizedAdsOnly: true }}
        onAdLoaded={() => console.log('[AdBanner] loaded')}
        onAdFailedToLoad={(error) =>
          console.warn('[AdBanner] failed to load:', error.code, error.message)
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
});
