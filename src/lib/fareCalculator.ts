export interface PricingConfig {
  base_fare: number;
  per_km_rate: number;
  surge_normal: number;
  surge_peak: number;
  surge_rain: number;
  surge_active: boolean;
  surge_mode: "normal" | "peak" | "rain";
}

/**
 * Calculates the total ride fare using the pricing config from Supabase.
 * Formula: Math.ceil((base_fare + distance_km * per_km_rate) * surge_multiplier)
 * Never hardcodes any values — always driven by pricing_config table.
 */
export function calcFare(distanceKm: number, config: PricingConfig): number {
  const surgeMultiplier =
    config.surge_active
      ? config.surge_mode === "rain"
        ? config.surge_rain
        : config.surge_mode === "peak"
        ? config.surge_peak
        : config.surge_normal
      : config.surge_normal;

  const raw = config.base_fare + distanceKm * config.per_km_rate;
  return Math.ceil(raw * surgeMultiplier);
}

/**
 * Driver earns 80% of the total fare.
 */
export function driverEarnings(totalFare: number): number {
  return Math.floor(totalFare * 0.8);
}
