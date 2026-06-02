import { redirect } from "next/navigation";

// The app has no public landing page in v1 — send everyone to the dashboard,
// which itself bounces to /signin when there's no session.
export default function Home() {
  redirect("/dashboard");
}
