export async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      Accept: 'application/json',
      ...(options?.body && !(options.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
      ...(options?.headers ?? {}),
    },
  });

  const contentType = res.headers.get('content-type') || '';
  const rawText = await res.text();

  if (!contentType.includes('application/json')) {
    const trimmed = rawText.trim();
    if (trimmed.startsWith('<!') || trimmed.startsWith('<html')) {
      throw new Error(
        `Server returned an HTML page instead of JSON for ${url} (HTTP ${res.status}). Check that the backend API server is running.`
      );
    }
    throw new Error(`Unexpected response from ${url} (HTTP ${res.status}): ${trimmed.slice(0, 140)}`);
  }

  let parsed: unknown;
  try {
    parsed = rawText ? JSON.parse(rawText) : {};
  } catch {
    throw new Error(`Invalid JSON received from ${url} (HTTP ${res.status}).`);
  }

  if (!res.ok) {
    const errObj = parsed as { error?: string; message?: string };
    throw new Error(errObj.error || errObj.message || `Request failed (${res.status})`);
  }

  return parsed as T;
}
