import { AuditDashboard } from "@/components/audit-dashboard";
import { SignInGate } from "@/components/sign-in-gate";
import { getAuthenticatedUser, googleAuthConfigured } from "@/lib/auth";

export default async function Home() {
  const authenticatedUser = await getAuthenticatedUser();
  if (!authenticatedUser) return <SignInGate configured={googleAuthConfigured()} />;
  return <AuditDashboard userId={authenticatedUser.id} />;
}
