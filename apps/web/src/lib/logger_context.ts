import type { LogContext } from "@/lib/logger";

export const requestContext = (request: Request): LogContext => {
  const pathname = new URL(request.url).pathname;

  return {
    method: request.method,
    url: pathname
  };
};
