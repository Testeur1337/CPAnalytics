import { prisma } from "./prisma";

export async function getOrCreateCurrentCampaign() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const startsAt = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const endsAt = new Date(year, month, 0, 23, 59, 59, 999);

  const campaign = await prisma.$transaction(async (tx) => {
    let current = await tx.campaign.findUnique({
      where: { year_month: { year, month } }
    });

    if (!current) {
      current = await tx.campaign.create({
        data: {
          year,
          month,
          name: `${year}-${String(month).padStart(2, "0")}`,
          goalUSD: 400,
          startsAt,
          endsAt,
          isActive: true
        }
      });
    }

    await tx.campaign.updateMany({
      where: { id: { not: current.id }, isActive: true },
      data: { isActive: false }
    });

    if (!current.isActive) {
      current = await tx.campaign.update({
        where: { id: current.id },
        data: { isActive: true }
      });
    }

    return current;
  });

  return campaign;
}
