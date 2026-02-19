import { env } from "@/lib/env";

export const OFFER_KEYS = ["single_intro_149", "pack5", "pack10", "single_base_299"] as const;

export type OfferKey = (typeof OFFER_KEYS)[number];

export type ProductType = "single" | "pack_5" | "pack_10";
export type PricingVariant = "intro" | "base";
export type Currency = "EUR";

type OfferConfig = {
  offer_key: OfferKey;
  product_type: ProductType;
  credits_granted: number;
  pricing_variant: PricingVariant;
  currency: Currency;
  stripe_price_env_var:
    | "STRIPE_PRICE_SINGLE_INTRO_149_EUR"
    | "STRIPE_PRICE_PACK5_EUR"
    | "STRIPE_PRICE_PACK10_EUR"
    | "STRIPE_PRICE_SINGLE_BASE_299_EUR";
  display_price_eur: number;
  ui: {
    label: string;
    badge?: string;
    description?: string;
  };
};

export type Offer = OfferConfig & {
  stripe_price_id: string | null;
};

export const DEFAULT_OFFER_KEY: OfferKey = "single_intro_149";

const OFFER_KEY_SET = new Set<OfferKey>(OFFER_KEYS);

const OFFER_CONFIGS: Record<OfferKey, OfferConfig> = {
  single_intro_149: {
    offer_key: "single_intro_149",
    product_type: "single",
    credits_granted: 1,
    pricing_variant: "intro",
    currency: "EUR",
    stripe_price_env_var: "STRIPE_PRICE_SINGLE_INTRO_149_EUR",
    display_price_eur: 1.49,
    ui: {
      label: "Single report",
      badge: "Intro price"
    }
  },
  pack5: {
    offer_key: "pack5",
    product_type: "pack_5",
    credits_granted: 5,
    pricing_variant: "base",
    currency: "EUR",
    stripe_price_env_var: "STRIPE_PRICE_PACK5_EUR",
    display_price_eur: 4.99,
    ui: {
      label: "Pack 5 reports"
    }
  },
  pack10: {
    offer_key: "pack10",
    product_type: "pack_10",
    credits_granted: 10,
    pricing_variant: "base",
    currency: "EUR",
    stripe_price_env_var: "STRIPE_PRICE_PACK10_EUR",
    display_price_eur: 7.99,
    ui: {
      label: "Pack 10 reports"
    }
  },
  single_base_299: {
    offer_key: "single_base_299",
    product_type: "single",
    credits_granted: 1,
    pricing_variant: "base",
    currency: "EUR",
    stripe_price_env_var: "STRIPE_PRICE_SINGLE_BASE_299_EUR",
    display_price_eur: 2.99,
    ui: {
      label: "Single report"
    }
  }
};

const getStripePriceId = (envVarName: OfferConfig["stripe_price_env_var"]): string | null => {
  const value = env[envVarName];
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export const isOfferKey = (value: string | null | undefined): value is OfferKey => {
  if (!value) {
    return false;
  }

  return OFFER_KEY_SET.has(value as OfferKey);
};

export const getOffer = (offerKey: OfferKey): Offer => {
  const config = OFFER_CONFIGS[offerKey];
  const stripePriceId = getStripePriceId(config.stripe_price_env_var);

  return {
    ...config,
    stripe_price_id: stripePriceId
  };
};

const DEFAULT_LIST_OFFER_KEYS: ReadonlyArray<OfferKey> = [
  "single_intro_149",
  "pack5",
  "pack10"
];

export const listOffers = (): Offer[] => {
  return DEFAULT_LIST_OFFER_KEYS.map((offerKey) => getOffer(offerKey));
};

export const requireStripePriceId = (offer: Offer): string => {
  if (offer.stripe_price_id) {
    return offer.stripe_price_id;
  }

  throw new Error(
    `Missing Stripe price id for offer ${offer.offer_key}. Set ${offer.stripe_price_env_var}.`
  );
};
