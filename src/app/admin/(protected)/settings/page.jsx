import AdminSettingsPage from "@/app/frontend/pages/admin/settings";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin Settings",
};

export default function SettingsPage() {
  return <AdminSettingsPage />;
}