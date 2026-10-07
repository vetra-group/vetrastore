import { cmsMode } from "@/lib/cms/auth";
import { demoEnabled } from "@/lib/demo";
import { paymentsConfigured } from "@/lib/payments/orders";
import { chooseDefaultProvider, listAvailableProviders, type PaymentProviderId } from "@/lib/payments/providers";

/** Public copy and checkout controls must agree with the server payment gate. */
export function checkoutPaymentOptions(): { providers: PaymentProviderId[]; defaultProvider: PaymentProviderId | null } {
  if (demoEnabled || cmsMode() !== "configured" || !paymentsConfigured()) return { providers: [], defaultProvider: null };
  const providers = listAvailableProviders().map((provider) => provider.id);
  const preferred = chooseDefaultProvider()?.id;
  return { providers, defaultProvider: preferred && providers.includes(preferred) ? preferred : providers[0] ?? null };
}
