import { Suspense } from "react";
import AdminSetPasswordPage from "@/app/frontend/pages/admin/set-password";

export default function Page() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <AdminSetPasswordPage />
    </Suspense>
  );
}