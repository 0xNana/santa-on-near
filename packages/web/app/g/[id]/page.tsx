import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NearClaimPage } from "@/components/near/NearClaimPage";
import { NearWalletProvider } from "@/components/near/NearWalletProvider";

// The script nonce is per request, so this page must be rendered for each one.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "A gift for you",
  description: "Someone sent you a private NEAR Testnet token gift.",
  robots: { index: false, follow: false },
  // A page's own openGraph and twitter objects replace the layout's whole object, so the shared
  // type, site name and card size are repeated here.
  openGraph: { type: "website", siteName: "Santa", title: "A gift for you" },
  twitter: { card: "summary_large_image", title: "A gift for you" },
};

const GIFT_ID = /^[1-9][0-9]{0,19}$/;

export default async function GiftPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!GIFT_ID.test(id)) notFound();
  return (
    <NearWalletProvider>
      <NearClaimPage giftId={id} />
    </NearWalletProvider>
  );
}
