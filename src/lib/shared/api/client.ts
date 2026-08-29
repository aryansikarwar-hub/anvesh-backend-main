import {
  IDEMPOTENCY_HEADER,
  REQUEST_ID_HEADER,
  type ApiResponse,
  type ErrorCode,
} from '../../types';

export class ApiError extends Error {
  constructor(
    readonly code: ErrorCode | 'NETWORK_ERROR',
    message: string,
    readonly status: number,
    readonly details?: Record<string, unknown>,
    readonly requestId?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** Field-level messages produced by the server's Zod validation. */
  get fieldErrors(): Record<string, string[]> {
    const fields = this.details?.fields;
    return typeof fields === 'object' && fields !== null
      ? (fields as Record<string, string[]>)
      : {};
  }
}

export interface ApiClientOptions {
  baseUrl: string;
  /** Returns the current access token, or null when signed out. */
  getAccessToken?: () => string | null;
  /** Called once on a 401 so the caller can refresh and retry. */
  onUnauthorized?: () => Promise<string | null>;
  portal?: string;
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  idempotencyKey?: string;
  signal?: AbortSignal;
  /** Cookie policy. Defaults to 'include' so the refresh cookie travels. */
  credentials?: 'include' | 'omit' | 'same-origin';
}

/**
 * The single HTTP client used by all three portals.
 *
 * It understands the API envelope, so callers get `data` directly and every
 * failure arrives as an ApiError carrying the server's error code and the
 * request id — which is what makes a user-reported problem traceable.
 */
export class ApiClient {
  constructor(private readonly options: ApiClientOptions) {}

  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const response = await this.send(path, options);

    if (response.status === 401 && this.options.onUnauthorized) {
      const refreshed = await this.options.onUnauthorized();
      if (refreshed) {
        const retry = await this.send(path, options, refreshed);
        return this.unwrap<T>(retry);
      }
    }

    return this.unwrap<T>(response);
  }

  get<T>(path: string, query?: RequestOptions['query'], signal?: AbortSignal): Promise<T> {
    return this.request<T>(path, { method: 'GET', ...(query ? { query } : {}), ...(signal ? { signal } : {}) });
  }

  post<T>(path: string, body?: unknown, extra: Partial<RequestOptions> = {}): Promise<T> {
    return this.request<T>(path, { method: 'POST', body, ...extra });
  }

  patch<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, { method: 'PATCH', body });
  }

  put<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, { method: 'PUT', body });
  }

  delete<T>(path: string): Promise<T> {
    return this.request<T>(path, { method: 'DELETE' });
  }

  private buildUrl(path: string, query?: RequestOptions['query']): string {
    const url = new URL(`${this.options.baseUrl.replace(/\/$/, '')}${path}`);
    for (const [key, value] of Object.entries(query ?? {})) {
      if (value === undefined || value === null || value === '') continue;
      url.searchParams.set(key, String(value));
    }
    return url.toString();
  }

  private async send(
    path: string,
    options: RequestOptions,
    overrideToken?: string,
  ): Promise<Response> {
    const token = overrideToken ?? this.options.getAccessToken?.() ?? null;
    const headers: Record<string, string> = { accept: 'application/json' };
    if (options.body !== undefined) headers['content-type'] = 'application/json';
    if (token) headers.authorization = `Bearer ${token}`;
    if (this.options.portal) headers['x-anvesh-portal'] = this.options.portal;
    if (options.idempotencyKey) headers[IDEMPOTENCY_HEADER] = options.idempotencyKey;

    try {
      return await fetch(this.buildUrl(path, options.query), {
        method: options.method ?? 'GET',
        headers,
        credentials: (options.credentials ?? 'include') as RequestInit['credentials'],
        ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
        ...(options.signal ? { signal: options.signal } : {}),
      });
    } catch (error) {
      throw new ApiError(
        'NETWORK_ERROR',
        'Could not reach Anvesh. Check your connection and try again.',
        0,
        { cause: error instanceof Error ? error.message : String(error) },
      );
    }
  }

  private async unwrap<T>(response: Response): Promise<T> {
    const requestId = response.headers.get(REQUEST_ID_HEADER) ?? undefined;
    if (response.status === 204) return undefined as T;

    let payload: ApiResponse<T> | null = null;
    try {
      payload = (await response.json()) as ApiResponse<T>;
    } catch {
      throw new ApiError(
        'NETWORK_ERROR',
        'The server sent a response we could not read.',
        response.status,
        undefined,
        requestId,
      );
    }

    if (payload && payload.success) return payload.data;

    const error = payload?.error;
    throw new ApiError(
      error?.code ?? 'INTERNAL_ERROR',
      error?.message ?? 'Something went wrong.',
      response.status,
      error?.details,
      payload?.meta?.requestId ?? requestId,
    );
  }
}
