import * as fs from "fs";
import * as path from "path";

export interface TopicCatalogEntry {
  title: string;
  tags: string;
  rating: string;
}

export function loadTopicCatalog(): TopicCatalogEntry[] {
  const candidates = [
    path.resolve(process.cwd(), "fixtures/topics.json"),
    path.resolve(__dirname, "../../fixtures/topics.json"),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      const raw = fs.readFileSync(candidate, "utf-8");
      return JSON.parse(raw) as TopicCatalogEntry[];
    }
  }

  throw new Error("fixtures/topics.json not found");
}
