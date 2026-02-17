import { QueryClient, QueryKey } from '@tanstack/react-query';

const PERF_ENABLED = process.env.NODE_ENV === 'development';
const RAPID_REFETCH_THRESHOLD_MS = 300;
const queryKeyTimestamps = new Map<string, number[]>();

function getQueryKeyString(key: QueryKey): string {
  return JSON.stringify(key);
}

function logDuplicateQuery(key: QueryKey, event: string) {
  if (!PERF_ENABLED) return;

  const keyStr = getQueryKeyString(key);
  const now = Date.now();
  const timestamps = queryKeyTimestamps.get(keyStr) || [];

  timestamps.push(now);
  queryKeyTimestamps.set(keyStr, timestamps);

  if (timestamps.length >= 2) {
    const lastTimestamp = timestamps[timestamps.length - 2];
    const diff = now - lastTimestamp;

    if (diff < RAPID_REFETCH_THRESHOLD_MS) {
      console.warn(
        `%c[PERF]%c Duplicate/Rapid Query: ${event}`,
        'color: orange; font-weight: bold',
        'color: inherit',
        `- key: ${keyStr.slice(0, 80)}...`,
        `- diff: ${diff}ms`,
        `- count: ${timestamps.length}`
      );
    }
  }

  const oneMinuteAgo = now - 60000;
  const recentTimestamps = timestamps.filter(t => t > oneMinuteAgo);
  queryKeyTimestamps.set(keyStr, recentTimestamps);

  if (recentTimestamps.length > 10) {
    console.warn(
      `%c[PERF]%c High Query Frequency: ${event}`,
      'color: red; font-weight: bold',
      'color: inherit',
      `- key: ${keyStr.slice(0, 80)}...`,
      `- requests in last minute: ${recentTimestamps.length}`
    );
  }
}

export const perfQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
      refetchOnWindowFocus: false,
      queryKeyHashFn: (key) => {
        const result = JSON.stringify(key);
        logDuplicateQuery(key, 'queryKey');
        return result;
      },
    },
    mutations: {
      onSuccess: () => {
        if (PERF_ENABLED) {
          console.log('%c[PERF]%c Mutation completed', 'color: green; font-weight: bold', 'color: inherit');
        }
      },
      onError: (error) => {
        if (PERF_ENABLED) {
          console.error(
            '%c[PERF]%c Mutation failed',
            'color: red; font-weight: bold',
            'color: inherit',
            `- error: ${error}`
          );
        }
      },
    },
  },
});

if (PERF_ENABLED && typeof window !== 'undefined') {
  console.log('%c[PERF]%c Performance monitoring enabled', 'color: cyan; font-weight: bold', 'color: inherit');
}
