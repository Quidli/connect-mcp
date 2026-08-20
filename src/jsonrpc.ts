export function getJsonRpcMethod(body: unknown): string | undefined {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return undefined;
  }
  const method = (body as { method?: unknown }).method;
  return typeof method === 'string' ? method : undefined;
}

export function getJsonRpcToolName(body: unknown): string | undefined {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return undefined;
  }
  const params = (body as { params?: { name?: unknown } }).params;
  return typeof params?.name === 'string' ? params.name : undefined;
}
