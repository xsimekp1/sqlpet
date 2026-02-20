'use client';

import { useCallback, useEffect, useRef } from 'react';
import { toast } from 'sonner';

export interface ShortcutHintConfig {
  actionKey: string;
  shortcut: string;
  label: string;
  message?: string;
  threshold?: number;
  windowMs?: number;
}

const STORAGE_KEY = 'shortcut_hints_enabled';

interface ActionState {
  count: number;
  lastClick: number;
  hintShown: boolean;
}

export function useShortcutHint(config: ShortcutHintConfig) {
  const {
    actionKey,
    shortcut,
    label,
    message,
    threshold = 3,
    windowMs = 60000, // 1 minute window
  } = config;

  const stateRef = useRef<ActionState | null>(null);

  // Load state from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(`shortcut_hint_${actionKey}`);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as ActionState;
        // Reset if window has passed
        const now = Date.now();
        if (now - parsed.lastClick > windowMs) {
          stateRef.current = { count: 0, lastClick: now, hintShown: false };
        } else {
          stateRef.current = parsed;
        }
      } catch {
        stateRef.current = { count: 0, lastClick: Date.now(), hintShown: false };
      }
    } else {
      stateRef.current = { count: 0, lastClick: Date.now(), hintShown: false };
    }
  }, [actionKey, windowMs]);

  const isEnabled = useCallback(() => {
    const enabled = localStorage.getItem(STORAGE_KEY);
    return enabled !== 'false'; // Default to enabled
  }, []);

  const trackClick = useCallback(() => {
    if (!isEnabled() || !stateRef.current) return;

    const now = Date.now();
    const state = stateRef.current;

    // Reset if window has passed
    if (now - state.lastClick > windowMs) {
      state.count = 0;
      state.hintShown = false;
    }

    state.count++;
    state.lastClick = now;

    // Save to localStorage
    localStorage.setItem(`shortcut_hint_${actionKey}`, JSON.stringify(state));

    // Show hint if threshold reached and not shown yet
    if (state.count >= threshold && !state.hintShown) {
      state.hintShown = true;
      localStorage.setItem(`shortcut_hint_${actionKey}`, JSON.stringify(state));
      
      const toastMessage = message || `Používáte ${label} často. Zkuste ${shortcut} pro rychlejší přístup.`;
      toast.info(toastMessage, {
        duration: 5000,
        id: `shortcut-hint-${actionKey}`,
      });
    }
  }, [actionKey, shortcut, label, message, threshold, windowMs, isEnabled]);

  return { trackClick, isEnabled };
}

export function getShortcutHintsEnabled(): boolean {
  const enabled = localStorage.getItem(STORAGE_KEY);
  return enabled !== 'false';
}

export function setShortcutHintsEnabled(enabled: boolean): void {
  localStorage.setItem(STORAGE_KEY, enabled.toString());
}
