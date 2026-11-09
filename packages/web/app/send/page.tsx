import type { Metadata } from "next";
import { NearSendPage } from "@/components/near/NearSendPage";
import { NearWalletProvider } from "@/components/near/NearWalletProvider";

// The script nonce is per request, so this page must be rendered for each one.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Send a gift",
  description: "Send an allowlisted NEAR Testnet token with an encrypted note and a private claim link.",
};

export default function Send() {
  return (
    <NearWalletProvider>
      <NearSendPage />
    </NearWalletProvider>
  );
}
