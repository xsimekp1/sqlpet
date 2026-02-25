import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface State {
  hasError: boolean;
}

export class MapErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  State
> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <View style={styles.fallback}>
            <Text style={styles.text}>🗺️ Mapa není dostupná</Text>
          </View>
        )
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  fallback: {
    height: 260,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  text: { color: '#9CA3AF', fontSize: 14 },
});
