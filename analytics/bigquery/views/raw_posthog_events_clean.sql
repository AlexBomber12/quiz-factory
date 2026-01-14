-- Clean PostHog events view for analytics staging.
create or replace view raw_posthog.events_clean as
select
  uuid,
  event,
  properties,
  distinct_id,
  timestamp
from raw_posthog.events;
