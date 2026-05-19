import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import SupervisorPaymentsClient from "./PaymentsClient";

export default async function SupervisorPaymentsPage() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "SUPERVISOR") redirect("/login");

  // Get supervisor's assigned sites
  const assignments = await prisma.supervisorSite.findMany({
    where: { userId: session.user.id },
    include: { site: { select: { id: true, name: true } } },
  });

  const sites = assignments.map((a) => a.site);

  return <SupervisorPaymentsClient sites={sites} />;
}
