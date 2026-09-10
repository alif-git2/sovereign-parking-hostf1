import WalletStripeTopupPage from "@/app/frontend/pages/wallet/stripeTopup";

export default async function WalletStripeTopupRoute({ params }) {
  const { topupId } = await params;

  return <WalletStripeTopupPage topupId={topupId} />;
}