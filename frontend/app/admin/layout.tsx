import { AuthGuard } from "@/components/AuthGuard";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-gray-900">Admin</h1>
        {children}
      </div>
    </AuthGuard>
  );
}
