import "dotenv/config";
import { backfillSkillSnapshotsForAllMentees } from "../src/services/assessment.service";
import { prisma } from "../src/lib/prisma";

async function main() {
  const count = await backfillSkillSnapshotsForAllMentees();
  console.log(`Backfilled skill snapshots for ${count} mentee(s).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
