import type { LogContext } from "@/lib/logger";

export const requestContext = (request: Request): LogContext => {
  return {
    method: request.method,
    url: request.url
  };
};
