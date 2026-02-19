import {
  DEFAULT_EVENT_BODY_BYTES,
  DEFAULT_EVENT_RATE_LIMIT,
  assertAllowedHost,
  assertAllowedHostAsync,
  assertAllowedMethod,
  assertAllowedOrigin,
  assertAllowedOriginAsync,
  assertMaxBodyBytes,
  rateLimit,
  type RateLimitOptions
} from "./request_guards";

export type GuardedRouteOptions = {
  methods: string[];
  rateLimit?: RateLimitOptions;
  maxBodyBytes?: number;
  requireHost?: boolean;
  requireOrigin?: boolean;
  async?: boolean;
};

export type GuardedHandler = (request: Request) => Promise<Response>;

export function withApiGuards(
  handler: GuardedHandler,
  options: GuardedRouteOptions
): (request: Request) => Promise<Response> {
  const methods = options.methods;
  const rateLimitOptions = options.rateLimit ?? DEFAULT_EVENT_RATE_LIMIT;
  const maxBodyBytes = options.maxBodyBytes ?? DEFAULT_EVENT_BODY_BYTES;
  const requireHost = options.requireHost ?? true;
  const requireOrigin = options.requireOrigin ?? true;
  const useAsyncGuards = options.async ?? true;

  return async (request: Request): Promise<Response> => {
    const methodResponse = assertAllowedMethod(request, methods);
    if (methodResponse) {
      return methodResponse;
    }

    if (requireHost) {
      const hostResponse = useAsyncGuards
        ? await assertAllowedHostAsync(request)
        : assertAllowedHost(request);
      if (hostResponse) {
        return hostResponse;
      }
    }

    if (requireOrigin) {
      const originResponse = useAsyncGuards
        ? await assertAllowedOriginAsync(request)
        : assertAllowedOrigin(request);
      if (originResponse) {
        return originResponse;
      }
    }

    const rateLimitResponse = rateLimit(request, rateLimitOptions);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const bodyResponse = await assertMaxBodyBytes(request, maxBodyBytes);
    if (bodyResponse) {
      return bodyResponse;
    }

    return handler(request);
  };
}
