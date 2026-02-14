import { executeProviderCall, parseFiltersFromRequest } from "../shared";

export const GET = async (request: Request): Promise<Response> => {
  const parsed = parseFiltersFromRequest(request);
  if (!parsed.ok) {
    return parsed.response;
  }

  return executeProviderCall((provider) => provider.getDistribution(parsed.filters));
};
