import { AuditDashboard } from "@/components/audit-dashboard";
import { PrivateBetaGate } from "@/components/private-beta-gate";
import { getBetaUser, googleAuthConfigured } from "@/lib/auth";

export default async function Home() {
  const betaUser = await getBetaUser();
  if (!betaUser) return <PrivateBetaGate configured={googleAuthConfigured()} />;
  return <AuditDashboard />;
}
