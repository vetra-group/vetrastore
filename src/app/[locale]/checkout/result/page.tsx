import { notFound } from "next/navigation";
import type { Metadata } from "next";
import PaymentResult from "@/components/commerce/PaymentResult";
import { paymentCheckoutCopy } from "@/content/payment-checkout";
import { isLocale } from "@/lib/i18n";

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ order?: string | string[] }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return { title: paymentCheckoutCopy[locale].resultTitle, robots: { index: false, follow: false } };
}

export default async function PaymentResultPage({ params, searchParams }: Props) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();
  return <PaymentResult locale={locale} orderId={typeof query.order === "string" ? query.order : ""} />;
}
