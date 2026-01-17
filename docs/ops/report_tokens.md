Report tokens

Purpose
- RESULT_COOKIE stores the computed test result and is issued after scoring.
- REPORT_TOKEN stores the paid report entitlement and is issued after checkout confirmation.

Token lifetimes
- RESULT_COOKIE is a session cookie with no explicit TTL.
- REPORT_TOKEN expires after 24 hours and is stored as an httpOnly cookie.

Required environment variables
- RESULT_COOKIE_SECRET: signing secret for RESULT_COOKIE.
- REPORT_TOKEN_SECRET: signing secret for REPORT_TOKEN.
