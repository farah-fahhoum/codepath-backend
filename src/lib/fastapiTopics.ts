/** FastAPI /topic keys — keep in sync with CodePath_AI_fastapi topic_router TOPIC_TAGS */
export const FASTAPI_TOPIC_TAGS = [
  "Basic Programming",
  "Arrays",
  "Frequency",
  "Prefix Sum",
  "Two Pointers",
  "Sliding Window",
  "Sorting",
  "Binary Search",
  "STL",
  "Set / Multiset",
  "Map / Unordered Map",
  "Hashing",
  "Math Basics",
  "Number Theory",
  "Math & Geometry",
  "Greedy Algorithms",
  "Recursion",
  "Backtracking",
  "Recursion & Backtracking",
  "Trees",
  "DFS / BFS",
  "Segment Tree",
  "Dynamic Programming",
  "Bitmask DP",
  "Graphs",
  "Shortest Paths",
  "Game Theory",
  "Advanced Geometry",
  "Advanced Topics",
  "Optimization Techniques",
] as const;

/** DB / roadmap labels that do not match FastAPI keys exactly */
const TOPIC_ALIASES: Record<string, string> = {
  algorithms: "Greedy Algorithms",
  "data structures": "STL",
  math: "Math Basics",
  "advanced algorithms": "Greedy Algorithms",
  "number theory basics": "Math Basics",
  graph: "Graphs",
  graphs: "Graphs",
  dp: "Dynamic Programming",
  "dynamic programming": "Dynamic Programming",
  greedy: "Greedy Algorithms",
  trees: "Trees",
  sorting: "Sorting",
  arrays: "Arrays",
  "recursion & backtracking": "Recursion & Backtracking",
  backtracking: "Recursion & Backtracking",
  recursion: "Recursion & Backtracking",
};

const FASTAPI_TOPIC_SET = new Set<string>(FASTAPI_TOPIC_TAGS);

/**
 * Map a roadmap/DB topic title to a FastAPI /topic key, or null if no match.
 */
export function resolveFastApiTopicName(topic: string): string | null {
  const trimmed = topic.trim();
  if (!trimmed) return null;

  const lower = trimmed.toLowerCase();

  if (TOPIC_ALIASES[lower]) {
    return TOPIC_ALIASES[lower];
  }

  for (const known of FASTAPI_TOPIC_TAGS) {
    if (known.toLowerCase() === lower) {
      return known;
    }
  }

  for (const known of FASTAPI_TOPIC_TAGS) {
    const knownLower = known.toLowerCase();
    if (lower.includes(knownLower) || knownLower.includes(lower)) {
      return known;
    }
  }

  if (lower.includes("graph")) return "Graphs";
  if (lower.includes("dynamic") || /\bdp\b/.test(lower)) {
    return "Dynamic Programming";
  }
  if (lower.includes("tree")) return "Trees";
  if (lower.includes("greedy")) return "Greedy Algorithms";
  if (lower.includes("array")) return "Arrays";
  if (lower.includes("sort")) return "Sorting";
  if (lower.includes("math") || lower.includes("number theory")) {
    return "Math Basics";
  }

  return null;
}

export function isKnownFastApiTopic(topic: string): boolean {
  return FASTAPI_TOPIC_SET.has(topic);
}
