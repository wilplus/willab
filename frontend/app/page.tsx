import { redirect } from "next/navigation";
import { getSession } from "@/lib/supabase";

export default async function Home() {
  const session = await getSession();
  if (session) redirect("/homework");
  redirect("/login");
}
