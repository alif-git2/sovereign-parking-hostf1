import WalletPayPalTopupPage from "@/app/frontend/pages/wallet/paypalTopup";

export default async function WalletPayPalTopupRoute({ params }) {
  const { topupId } = await params;

  return <WalletPayPalTopupPage topupId={topupId} />;
}