export const SESSION_COOKIE_NAME = "qf_session_id";
export const DISTINCT_COOKIE_NAME = "qf_distinct_id";
export const UTM_COOKIE_NAME = "qf_utm";
export const CLICK_COOKIE_NAME = "qf_click";

export const UTM_FIELDS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term"
] as const;

export const CLICK_ID_FIELDS = ["fbclid", "gclid", "ttclid"] as const;

export type UtmField = (typeof UTM_FIELDS)[number];
export type ClickIdField = (typeof CLICK_ID_FIELDS)[number];
