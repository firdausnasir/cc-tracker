import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { signupAction } from "@/app/actions/auth";
import { CredentialForm } from "@/components/credential-form";

export default async function SignupPage() {
  const session = await auth();

  if (session?.user) {
    redirect("/dashboard");
  }

  return <CredentialForm mode="signup" action={signupAction} />;
}
