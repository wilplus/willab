import { AuthGuard } from "@/components/AuthGuard";

export default function HomeworkLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthGuard>{children}</AuthGuard>;
}
