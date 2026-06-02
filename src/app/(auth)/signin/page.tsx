import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { signinAction } from "@/app/actions/auth";
import { CredentialForm } from "@/components/credential-form";

export default async function SigninPage() {
  const session = await auth();

  if (session?.user) {
    redirect("/dashboard");
  }

  return <CredentialForm mode="signin" action={signinAction} />;
}
