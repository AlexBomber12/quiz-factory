import {
  executeProviderCall,
  parseFiltersFromRequest,
  parseRouteIdentifier,
  validateDetailFilterConsistency
} from "../../shared";

type RouteContext = {
  params: Promise<{ test_id: string }> | { test_id: string };
};

const resolveParams = async (
  params: RouteContext["params"]
): Promise<{ test_id: string }> => {
  return Promise.resolve(params);
};

export const GET = async (request: Request, context: RouteContext): Promise<Response> => {
  const routeParams = await resolveParams(context.params);
  const parsedTestId = parseRouteIdentifier(routeParams.test_id, "test_id");
  if (!parsedTestId.ok) {
    return parsedTestId.response;
  }

  const parsedFilters = parseFiltersFromRequest(request);
  if (!parsedFilters.ok) {
    return parsedFilters.response;
  }

  const filterMismatch = validateDetailFilterConsistency(
    "test_id",
    parsedTestId.value,
    parsedFilters.filters
  );
  if (filterMismatch) {
    return filterMismatch;
  }

  const filters = {
    ...parsedFilters.filters,
    test_id: parsedTestId.value
  };

  return executeProviderCall((provider) => provider.getTestDetail(parsedTestId.value, filters));
};
