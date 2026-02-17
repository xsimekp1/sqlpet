const PERF_ENABLED = process.env.NODE_ENV === 'development';

let currentTraceId: string | null = null;

export function getTraceId(): string | null {
  return currentTraceId;
}

export function setTraceId(id: string): void {
  currentTraceId = id;
}

export function generateTraceId(): string {
  return Math.random().toString(36).substring(2, 10);
}

interface PerfFetchOptions extends RequestInit {
  traceId?: string;
  _internal?: boolean;
}

export async function perfFetch(
  url: string,
  options: PerfFetchOptions = {}
): Promise<Response> {
  const startTime = performance.now();
  const method = options.method || 'GET';
  const traceId = options.traceId || currentTraceId || generateTraceId();

  const headers = new Headers(options.headers);
  headers.set('x-trace-id', traceId);

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const org = typeof window !== 'undefined' ? localStorage.getItem('selectedOrg') : null;

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (org) {
    try {
      headers.set('x-organization-id', JSON.parse(org).id);
    } catch {}
  }

  const fetchOptions: RequestInit = {
    ...options,
    headers,
  };

  let response: Response;
  try {
    response = await fetch(url, fetchOptions);
  } catch (error) {
    if (PERF_ENABLED) {
      console.error(
        `%c[PERF]%c ${method} ${url} FAILED`,
        'color: red; font-weight: bold',
        'color: inherit',
        `- error: ${error instanceof Error ? error.message : String(error)}`,
        `- trace_id=${traceId}`
      );
    }
    throw error;
  }

  const endTime = performance.now();
  const duration = endTime - startTime;
  const status = response.status;

  const contentLength = response.headers.get('content-length');
  const bytes = contentLength ? parseInt(contentLength, 10) : 0;

  if (PERF_ENABLED) {
    const color =
      status >= 500
        ? 'red'
        : status >= 400
        ? 'orange'
        : status >= 300
        ? 'yellow'
        : 'green';

    const isSlow = duration > 500;
    const prefix = isSlow ? '%c[PERF SLOW]%c' : '%c[PERF]%c';

    console.log(
      prefix,
      `color: ${color}; font-weight: bold`,
      'color: inherit',
      `${method} ${url}`,
      `- status=${status}`,
      `- duration=${duration.toFixed(1)}ms`,
      `- bytes=${bytes}`,
      `- trace_id=${traceId}`
    );
  }

  currentTraceId = traceId;

  const clonedResponse = response.clone();
  return clonedResponse;
}

export function createApiClient(baseUrl: string = '') {
  const apiUrl = baseUrl || (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000');

  return {
    async get<T>(path: string, options?: PerfFetchOptions): Promise<T> {
      const response = await perfFetch(`${apiUrl}${path}`, {
        ...options,
        method: 'GET',
      });
      return response.json();
    },

    async post<T>(path: string, body?: unknown, options?: PerfFetchOptions): Promise<T> {
      const response = await perfFetch(`${apiUrl}${path}`, {
        ...options,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...options?.headers },
        body: body ? JSON.stringify(body) : undefined,
      });
      return response.json();
    },

    async put<T>(path: string, body?: unknown, options?: PerfFetchOptions): Promise<T> {
      const response = await perfFetch(`${apiUrl}${path}`, {
        ...options,
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...options?.headers },
        body: body ? JSON.stringify(body) : undefined,
      });
      return response.json();
    },

    async patch<T>(path: string, body?: unknown, options?: PerfFetchOptions): Promise<T> {
      const response = await perfFetch(`${apiUrl}${path}`, {
        ...options,
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...options?.headers },
        body: body ? JSON.stringify(body) : undefined,
      });
      return response.json();
    },

    async delete<T>(path: string, options?: PerfFetchOptions): Promise<T> {
      const response = await perfFetch(`${apiUrl}${path}`, {
        ...options,
        method: 'DELETE',
      });
      return response.json();
    },
  };
}
