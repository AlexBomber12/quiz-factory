PR-PROD-02: Stripe Pricing Module and Intro Offer (Consistent Offers and Tracking)

Read and follow AGENTS.md strictly.

Context
- The product flow already supports paywall and Stripe Checkout Session creation.
- Pricing and offer definitions are currently scattered across UI copy, checkout logic, and analytics metadata.
- We need a single source of truth for offers to keep unit economics explainable and to support future pricing experiments.

Goal
- Introduce a pricing module used by both UI and backend:
  - Create apps/web/src/lib/pricing.ts (or an appropriate shared location).
  - Define an OfferKey enum (string union) and Offer definition:
    - offer_key
    - product_type: single or pack
    - credits_granted (single: 1, pack5: 5, pack10: 10)
    - pricing_variant: intro or base
    - currency: EUR
    - stripe_price_id (read from env vars)
    - display_price_eur (number for UI only)
    - optional UI copy fields (safe, no fake strike-through discounts)
  - Provide helper functions: getOffer(offer_key) and listOffers() for UI.
- Wire the paywall to use OfferKey and the pricing module:
  - Render 3 buttons: single_intro_149, pack5, pack10.
  - Use copy like "Intro price" for the single offer. Do not claim "was €X" unless there is a real price history system (out of scope).
- Wire checkout session creation to accept OfferKey:
  - Validate offer_key strictly server-side; default to single_intro_149.
  - Use the offer stripe_price_id; fail fast with a clear error if the env var is missing.
  - Attach Stripe metadata with: offer_key, product_type, credits_granted, pricing_variant, unit_price_eur, currency, tenant_id, test_id, locale, distinct_id, session_id or attempt_id (use whatever identifier the code already uses for the attempt).
  - Emit analytics event checkout_start with the same properties.
- Update .env.example (only) with required Stripe price env vars:
  - STRIPE_PRICE_SINGLE_INTRO_149_EUR
  - STRIPE_PRICE_PACK5_EUR
  - STRIPE_PRICE_PACK10_EUR
  - If a base price exists in the code, add STRIPE_PRICE_SINGLE_BASE_299_EUR but keep UI focused on intro.

Constraints
- Do not commit secrets.
- Keep currency fixed to EUR.
- Do not change Stripe webhook signature verification and routing.
- Keep all changes scoped to pricing and checkout creation.

Workflow rules
- Create a new branch from main named: pr-prod-02-stripe-pricing
- Implement only what this task requests.
- Run the project test gate per AGENTS.md.

Definition of Done
- Paywall UI renders offers using listOffers() and has no hard-coded prices outside the pricing module.
- Checkout create endpoint requires a valid offer_key and uses stripe_price_id from env vars.
- Stripe Checkout Session metadata includes offer_key, product_type, pricing_variant, credits_granted, unit_price_eur, and currency.
- analytics/events contract remains green and the standard test gate passes.
- .env.example updated with the new non-secret variables.
