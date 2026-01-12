export const SESSION_COOKIE_NAME = "qf_session_id";
export const UTM_COOKIE_NAME = "qf_utm";

export const UTM_FIELDS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term"
] as const;

export type UtmField = (typeof UTM_FIELDS)[number];
