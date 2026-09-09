import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { loadTopicCatalog } from "../src/lib/topicCatalog";

async function main() {
  const catalog = loadTopicCatalog();
  let created = 0;
  let skipped = 0;

  for (const entry of catalog) {
    const existing = await prisma.topic.findFirst({
      where: { title: { equals: entry.title, mode: "insensitive" } },
    });

    if (existing) {
      skipped += 1;
      continue;
    }

    await prisma.topic.create({ data: entry });
    created += 1;
  }

  console.log(`Topics seed complete: ${created} created, ${skipped} already existed.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
