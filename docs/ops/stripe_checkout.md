Stripe checkout

Required environment variables
- STRIPE_SECRET_KEY: server key used to create Stripe Checkout Sessions.
- STRIPE_WEBHOOK_SECRET: signing secret used to verify Stripe webhooks.

Local testing with Stripe test mode
- Enable test mode in the Stripe dashboard.
- Set STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET to the test values in your local environment.
- Run `stripe listen --forward-to http://localhost:3000/api/stripe/webhook` to receive webhooks.
- Complete a checkout from the paywall to validate the full flow.

Revenue recognition
- All revenue recognition is derived from Stripe webhook facts.
