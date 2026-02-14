import {
  executeProviderCall,
  parseFiltersFromRequest,
  parseRouteIdentifier,
  validateDetailFilterConsistency
} from "../../shared";

type RouteContext = {
  params: Promise<{ tenant_id: string }> | { tenant_id: string };
};

const resolveParams = async (
  params: RouteContext["params"]
): Promise<{ tenant_id: string }> => {
  return Promise.resolve(params);
};

export const GET = async (request: Request, context: RouteContext): Promise<Response> => {
  const routeParams = await resolveParams(context.params);
  const parsedTenantId = parseRouteIdentifier(routeParams.tenant_id, "tenant_id");
  if (!parsedTenantId.ok) {
    return parsedTenantId.response;
  }

  const parsedFilters = parseFiltersFromRequest(request);
  if (!parsedFilters.ok) {
    return parsedFilters.response;
  }

  const filterMismatch = validateDetailFilterConsistency(
    "tenant_id",
    parsedTenantId.value,
    parsedFilters.filters
  );
  if (filterMismatch) {
    return filterMismatch;
  }

  const filters = {
    ...parsedFilters.filters,
    tenant_id: parsedTenantId.value
  };

  return executeProviderCall((provider) => provider.getTenantDetail(parsedTenantId.value, filters));
};
