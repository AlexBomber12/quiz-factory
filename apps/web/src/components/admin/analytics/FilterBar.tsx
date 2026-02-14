"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { getDefaultAnalyticsDateRange, resolveAnalyticsDateRange } from "../../../lib/admin/analytics_dates";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";

const LOCALE_OPTIONS = ["all", "en", "es", "pt-BR"] as const;
const DEVICE_OPTIONS = ["all", "desktop", "mobile", "tablet"] as const;

type LocaleOption = (typeof LOCALE_OPTIONS)[number];
type DeviceOption = (typeof DEVICE_OPTIONS)[number];

type FilterState = {
  start: string;
  end: string;
  tenant_id: string;
  test_id: string;
  locale: LocaleOption;
  device_type: DeviceOption;
  utm_source: string;
};

const isLocaleOption = (value: string | null): value is LocaleOption => {
  return value !== null && LOCALE_OPTIONS.includes(value as LocaleOption);
};

const isDeviceOption = (value: string | null): value is DeviceOption => {
  return value !== null && DEVICE_OPTIONS.includes(value as DeviceOption);
};

const buildDefaultState = (): FilterState => {
  const defaults = getDefaultAnalyticsDateRange();
  return {
    start: defaults.start,
    end: defaults.end,
    tenant_id: "",
    test_id: "",
    locale: "all",
    device_type: "all",
    utm_source: ""
  };
};

const readFilterStateFromQuery = (queryString: string): FilterState => {
  const params = new URLSearchParams(queryString);
  const range = resolveAnalyticsDateRange({
    start: params.get("start"),
    end: params.get("end")
  });
  const localeValue = params.get("locale");
  const deviceTypeValue = params.get("device_type");

  return {
    start: range.start,
    end: range.end,
    tenant_id: params.get("tenant_id") ?? "",
    test_id: params.get("test_id") ?? "",
    locale: isLocaleOption(localeValue) ? localeValue : "all",
    device_type: isDeviceOption(deviceTypeValue) ? deviceTypeValue : "all",
    utm_source: params.get("utm_source") ?? ""
  };
};

const setOrDelete = (params: URLSearchParams, key: string, value: string): void => {
  const normalized = value.trim();
  if (normalized) {
    params.set(key, normalized);
    return;
  }

  params.delete(key);
};

export default function AdminAnalyticsFilterBar() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryString = searchParams.toString();
  const [filters, setFilters] = useState<FilterState>(() => readFilterStateFromQuery(queryString));

  useEffect(() => {
    setFilters(readFilterStateFromQuery(queryString));
  }, [queryString]);

  const applyFilters = () => {
    const next = new URLSearchParams(searchParams.toString());
    const range = resolveAnalyticsDateRange({
      start: filters.start,
      end: filters.end
    });

    next.set("start", range.start);
    next.set("end", range.end);
    setOrDelete(next, "tenant_id", filters.tenant_id);
    setOrDelete(next, "test_id", filters.test_id);
    next.set("locale", filters.locale);
    next.set("device_type", filters.device_type);
    setOrDelete(next, "utm_source", filters.utm_source);

    const nextQuery = next.toString();
    router.push(nextQuery ? `${pathname}?${nextQuery}` : pathname);
  };

  return (
    <form
      className="grid gap-3 md:grid-cols-2 xl:grid-cols-4"
      onSubmit={(event) => {
        event.preventDefault();
        applyFilters();
      }}
    >
      <label className="space-y-1">
        <span className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">
          start
        </span>
        <Input
          onChange={(event) => {
            setFilters((current) => ({
              ...current,
              start: event.currentTarget.value
            }));
          }}
          type="date"
          value={filters.start}
        />
      </label>

      <label className="space-y-1">
        <span className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">
          end
        </span>
        <Input
          onChange={(event) => {
            setFilters((current) => ({
              ...current,
              end: event.currentTarget.value
            }));
          }}
          type="date"
          value={filters.end}
        />
      </label>

      <label className="space-y-1">
        <span className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">
          tenant_id
        </span>
        <Input
          onChange={(event) => {
            setFilters((current) => ({
              ...current,
              tenant_id: event.currentTarget.value
            }));
          }}
          placeholder="tenant-..."
          type="text"
          value={filters.tenant_id}
        />
      </label>

      <label className="space-y-1">
        <span className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">
          test_id
        </span>
        <Input
          onChange={(event) => {
            setFilters((current) => ({
              ...current,
              test_id: event.currentTarget.value
            }));
          }}
          placeholder="test-..."
          type="text"
          value={filters.test_id}
        />
      </label>

      <label className="space-y-1">
        <span className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">
          locale
        </span>
        <select
          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          onChange={(event) => {
            setFilters((current) => ({
              ...current,
              locale: event.currentTarget.value as LocaleOption
            }));
          }}
          value={filters.locale}
        >
          {LOCALE_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>

      <label className="space-y-1">
        <span className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">
          device_type
        </span>
        <select
          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          onChange={(event) => {
            setFilters((current) => ({
              ...current,
              device_type: event.currentTarget.value as DeviceOption
            }));
          }}
          value={filters.device_type}
        >
          {DEVICE_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>

      <label className="space-y-1">
        <span className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">
          utm_source
        </span>
        <Input
          onChange={(event) => {
            setFilters((current) => ({
              ...current,
              utm_source: event.currentTarget.value
            }));
          }}
          placeholder="meta, google, newsletter..."
          type="text"
          value={filters.utm_source}
        />
      </label>

      <div className="flex items-end gap-2">
        <Button type="submit" variant="secondary">
          Apply
        </Button>
        <Button
          onClick={() => {
            setFilters(buildDefaultState());
            router.push(pathname);
          }}
          type="button"
          variant="outline"
        >
          Reset
        </Button>
      </div>
    </form>
  );
}
