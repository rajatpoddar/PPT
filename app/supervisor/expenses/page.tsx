import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import SupervisorExpensesClient from "./ExpensesClient";

export default async function SupervisorExpensesPage() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "SUPERVISOR") redirect("/login");

  const assignments = await prisma.supervisorSite.findMany({
    where: { userId: session.user.id },
    include: { site: { select: { id: true, name: true } } },
  });

  const sites = assignments.map((a) => a.site);

  return <SupervisorExpensesClient sites={sites} />;
}
