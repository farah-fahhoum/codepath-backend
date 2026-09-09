import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import * as bcrypt from "bcryptjs";
import * as fs from "fs";
import * as path from "path";
import { parseCsvRows, parsePythonList } from "../src/lib/csv";
import { loadProblemFixtures } from "../src/lib/problemFixtures";
import { loadTopicCatalog } from "../src/lib/topicCatalog";

function problemsetPath(): string {
  const candidates = [
    path.resolve(process.cwd(), "problemset.csv"),
    path.resolve(__dirname, "../problemset.csv"),
    path.resolve(__dirname, "../../../problemset.csv"),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error("problemset.csv not found");
}

async function main() {
  console.log("Clearing existing data...");

  await prisma.contestSubmission.deleteMany();
  await prisma.contestParticipant.deleteMany();
  await prisma.contestProblem.deleteMany();
  await prisma.contest.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.coach.deleteMany();
  await prisma.solutionSnippet.deleteMany();
  await prisma.codePathSubmission.deleteMany();
  await prisma.problemTestCase.deleteMany();
  await prisma.codePathProblem.deleteMany();
  await prisma.moduleProblem.deleteMany();
  await prisma.moduleResource.deleteMany();
  await prisma.userLearningProgress.deleteMany();
  await prisma.pathModule.deleteMany();
  await prisma.learningPath.deleteMany();
  await prisma.userSkillAssessment.deleteMany();
  await prisma.userSkillSnapshot.deleteMany();
  await prisma.favouriteProblem.deleteMany();
  await prisma.userProblemAttempt.deleteMany();
  await prisma.externalSubmission.deleteMany();
  await prisma.userAchievement.deleteMany();
  await prisma.achievement.deleteMany();
  await prisma.profile.deleteMany();
  await prisma.externalAccount.deleteMany();
  await prisma.problem.deleteMany();
  await prisma.user.deleteMany();
  await prisma.contactInquery.deleteMany();
  await prisma.contactInfo.deleteMany();
  await prisma.quizOption.deleteMany();
  await prisma.quizQuestion.deleteMany();
  await prisma.skillLevel.deleteMany();
  await prisma.topic.deleteMany();
  await prisma.role.deleteMany();

  console.log("Seeding roles...");
  const adminRole = await prisma.role.create({ data: { title: "Admin" } });
  await prisma.role.create({ data: { title: "Mentee" } });
  await prisma.role.create({ data: { title: "Coach" } });

  console.log("Seeding skill levels...");
  const beginner = await prisma.skillLevel.create({
    data: {
      title: "Beginner",
      description: "Starting with competitive programming",
      targetRatingRange: "0-1200",
      expectedKnowledge: "Basic syntax, loops, arrays",
    },
  });
  const intermediate = await prisma.skillLevel.create({
    data: {
      title: "Intermediate",
      description: "Comfortable with standard problems",
      targetRatingRange: "1200-1400",
      expectedKnowledge: "DP, graphs, binary search",
    },
  });
  const advanced = await prisma.skillLevel.create({
    data: {
      title: "Advanced",
      description: "Tackling harder contests",
      targetRatingRange: "1400-1600",
      expectedKnowledge: "Advanced DS, number theory, flows",
    },
  });
  const expert = await prisma.skillLevel.create({
    data: {
      title: "Expert",
      description: "Strong contest performance",
      targetRatingRange: "1600-1900",
      expectedKnowledge: "Complex algorithms and contest strategy",
    },
  });
  const master = await prisma.skillLevel.create({
    data: {
      title: "Master",
      description: "Top-tier competitive programming",
      targetRatingRange: "1900+",
      expectedKnowledge: "Advanced contest techniques",
    },
  });

  console.log("Seeding topics...");
  const topicCatalog = loadTopicCatalog();
  await prisma.topic.createMany({ data: topicCatalog });

  const topicsByTitle = new Map(
    (
      await prisma.topic.findMany({
        select: { id: true, title: true },
      })
    ).map((topic) => [topic.title, topic.id]),
  );

  const topicId = (title: string) => {
    const id = topicsByTitle.get(title);
    if (id == null) {
      throw new Error(`Seed topic not found: ${title}`);
    }
    return id;
  };

  console.log("Seeding default roadmaps (one per skill level)...");
  const skillLevelPaths: Array<{
    skillLevelId: number;
    title: string;
    description: string;
    topicTitle: string;
    moduleTitle: string;
  }> = [
    {
      skillLevelId: beginner.id,
      title: "Beginner Path",
      description: "Get started with competitive programming",
      topicTitle: "Sorting",
      moduleTitle: "Introduction to Sorting",
    },
    {
      skillLevelId: intermediate.id,
      title: "Intermediate Path",
      description: "Level up your problem-solving skills",
      topicTitle: "Arrays",
      moduleTitle: "Arrays and Two Pointers",
    },
    {
      skillLevelId: advanced.id,
      title: "Advanced Path",
      description: "Tackle harder contest problems",
      topicTitle: "Number Theory",
      moduleTitle: "Number Theory Basics",
    },
    {
      skillLevelId: expert.id,
      title: "Expert Path",
      description: "Advanced contest preparation",
      topicTitle: "Dynamic Programming",
      moduleTitle: "Dynamic Programming Foundations",
    },
    {
      skillLevelId: master.id,
      title: "Master Path",
      description: "Top-tier contest training",
      topicTitle: "Segment Tree",
      moduleTitle: "Advanced Data Structures",
    },
  ];

  for (const pathDef of skillLevelPaths) {
    const learningPath = await prisma.learningPath.create({
      data: {
        targetSkillLevelId: pathDef.skillLevelId,
        title: pathDef.title,
        description: pathDef.description,
      },
    });
    await prisma.pathModule.create({
      data: {
        learningPathId: learningPath.id,
        topicId: topicId(pathDef.topicTitle),
        moduleOrder: 1,
        title: pathDef.moduleTitle,
        description: pathDef.description,
        estimatedHours: 6,
      },
    });
  }

  console.log("Seeding achievements...");
  await prisma.achievement.createMany({
    data: [
      {
        name: "First Problem Solved",
        description: "Solve your first coding problem.",
        achievementType: "Milestone",
        iconUrl: "first_problem_solved",
      },
      {
        name: "Ten Problems Solved",
        description: "Solve ten coding problems.",
        achievementType: "Milestone",
        iconUrl: "ten_problems_solved",
      },
      {
        name: "First Module Completed",
        description: "Complete all problems in one roadmap module.",
        achievementType: "Module",
        iconUrl: "first_module_completed",
      },
      {
        name: "Roadmap Starter",
        description: "Activate your first roadmap.",
        achievementType: "Roadmap",
        iconUrl: "roadmap_starter",
      },
    ],
    skipDuplicates: true,
  });

  console.log("Seeding contact info...");
  await prisma.contactInfo.create({
    data: {
      email: "info@codepath.com",
      phone: "+96394413524",
      facebook: "https://facebook.com/codepath",
      instagram: "https://instagram.com/codepath",
      youtube: "https://youtube.com/codepath",
    },
  });

  console.log("Seeding quiz questions...");
  const quizQuestions = [
    {
      questionTitle: "Binary Search Implementation",
      score: 10,
      options: [
        { optionText: "Linear scan through the array", orderIndex: 0, isCorrect: false },
        { optionText: "Divide the search interval in half each step", orderIndex: 1, isCorrect: true },
        { optionText: "Sort the array on every query", orderIndex: 2, isCorrect: false },
        { optionText: "Use a hash map for every lookup", orderIndex: 3, isCorrect: false },
        { optionText: "Compare only the first and last elements", orderIndex: 4, isCorrect: false },
        { optionText: "Recursively swap adjacent elements", orderIndex: 5, isCorrect: false },
      ],
    },
    {
      questionTitle: "What is the time complexity of binary search?",
      score: 10,
      options: [
        { optionText: "O(n)", orderIndex: 0, isCorrect: false },
        { optionText: "O(log n)", orderIndex: 1, isCorrect: true },
        { optionText: "O(n log n)", orderIndex: 2, isCorrect: false },
        { optionText: "O(1)", orderIndex: 3, isCorrect: false },
        { optionText: "O(n^2)", orderIndex: 4, isCorrect: false },
        { optionText: "O(sqrt(n))", orderIndex: 5, isCorrect: false },
      ],
    },
    {
      questionTitle: "What data structure uses LIFO?",
      score: 5,
      options: [
        { optionText: "Queue", orderIndex: 0, isCorrect: false },
        { optionText: "Stack", orderIndex: 1, isCorrect: true },
        { optionText: "Deque", orderIndex: 2, isCorrect: false },
        { optionText: "Heap", orderIndex: 3, isCorrect: false },
        { optionText: "Priority Queue", orderIndex: 4, isCorrect: false },
        { optionText: "Linked List", orderIndex: 5, isCorrect: false },
      ],
    },
    {
      questionTitle: "What is the best case for quicksort?",
      score: 10,
      options: [
        { optionText: "O(n)", orderIndex: 0, isCorrect: false },
        { optionText: "O(n log n)", orderIndex: 1, isCorrect: true },
        { optionText: "O(n^2)", orderIndex: 2, isCorrect: false },
        { optionText: "O(log n)", orderIndex: 3, isCorrect: false },
        { optionText: "O(1)", orderIndex: 4, isCorrect: false },
        { optionText: "O(n^3)", orderIndex: 5, isCorrect: false },
      ],
    },
    {
      questionTitle: "Which algorithm finds shortest path in unweighted graph?",
      score: 10,
      options: [
        { optionText: "DFS", orderIndex: 0, isCorrect: false },
        { optionText: "BFS", orderIndex: 1, isCorrect: true },
        { optionText: "Dijkstra", orderIndex: 2, isCorrect: false },
        { optionText: "Bellman-Ford", orderIndex: 3, isCorrect: false },
        { optionText: "Floyd-Warshall", orderIndex: 4, isCorrect: false },
        { optionText: "Kruskal", orderIndex: 5, isCorrect: false },
      ],
    },
    {
      questionTitle: "What does DFS stand for?",
      score: 5,
      options: [
        { optionText: "Depth First Search", orderIndex: 0, isCorrect: true },
        { optionText: "Depth Final Search", orderIndex: 1, isCorrect: false },
        { optionText: "Data First Search", orderIndex: 2, isCorrect: false },
        { optionText: "Directed Flow Search", orderIndex: 3, isCorrect: false },
        { optionText: "Dynamic Fast Search", orderIndex: 4, isCorrect: false },
        { optionText: "Divide For Search", orderIndex: 5, isCorrect: false },
      ],
    },
    {
      questionTitle: "Which traversal visits nodes level by level?",
      score: 8,
      options: [
        { optionText: "Preorder traversal", orderIndex: 0, isCorrect: false },
        { optionText: "Inorder traversal", orderIndex: 1, isCorrect: false },
        { optionText: "Level-order traversal", orderIndex: 2, isCorrect: true },
        { optionText: "Postorder traversal", orderIndex: 3, isCorrect: false },
        { optionText: "Euler tour", orderIndex: 4, isCorrect: false },
        { optionText: "Topological sort", orderIndex: 5, isCorrect: false },
      ],
    },
    {
      questionTitle: "What is the space complexity of merge sort?",
      score: 8,
      options: [
        { optionText: "O(1)", orderIndex: 0, isCorrect: false },
        { optionText: "O(log n)", orderIndex: 1, isCorrect: false },
        { optionText: "O(n)", orderIndex: 2, isCorrect: true },
        { optionText: "O(n log n)", orderIndex: 3, isCorrect: false },
        { optionText: "O(n^2)", orderIndex: 4, isCorrect: false },
        { optionText: "O(sqrt(n))", orderIndex: 5, isCorrect: false },
      ],
    },
  ];

  for (const question of quizQuestions) {
    await prisma.quizQuestion.create({
      data: {
        questionTitle: question.questionTitle,
        score: question.score,
        options: { create: question.options },
      },
    });
  }

  console.log("Seeding admin user...");
  const hashedAdmin = await bcrypt.hash("admin123", 10);
  const admin = await prisma.user.create({
    data: {
      username: "admin",
      email: "admin@codepath.com",
      password: hashedAdmin,
      roleId: adminRole.id,
    },
  });
  await prisma.profile.create({
    data: {
      userId: admin.id,
      fullName: "Admin User",
      country: "United States",
      phone: "+1234567890",
      bio: "Platform administrator",
    },
  });

  console.log("Seeding problems from problemset.csv...");
  const csvText = fs.readFileSync(problemsetPath(), "utf-8");
  const csvRows = parseCsvRows(csvText);
  const problems: Array<{
    externalProblemId: string;
    contestId: number;
    index: string;
    rating: number;
    tags: string;
  }> = [];

  for (const row of csvRows) {
    if (!row || row.length < 3) continue;
    const [problemId, rating, tags] = row;
    if (!problemId || problemId === "problem_id") continue;

    const match = problemId.match(/^(\d+)_([A-Z]+)$/i);
    if (!match) continue;

    const contestId = parseInt(match[1], 10);
    const index = match[2].toUpperCase();
    const parsedRating = parseInt(rating, 10);
    if (Number.isNaN(contestId) || Number.isNaN(parsedRating)) continue;

    problems.push({
      externalProblemId: `${contestId}${index}`,
      contestId,
      index,
      rating: parsedRating,
      tags: JSON.stringify(parsePythonList(tags)),
    });
  }

  const CHUNK_SIZE = 1000;
  for (let i = 0; i < problems.length; i += CHUNK_SIZE) {
    const chunk = problems.slice(i, i + CHUNK_SIZE);
    await prisma.problem.createMany({ data: chunk, skipDuplicates: true });
  }
  console.log(`  Seeded ${problems.length} problems.`);

  console.log("Seeding CodePath problems from fixtures...");
  const fixtures = loadProblemFixtures();
  const seededSlugs: string[] = [];

  for (const fixture of fixtures) {
    const problem = await prisma.codePathProblem.create({
      data: {
        slug: fixture.slug,
        title: fixture.title,
        statement: fixture.statement,
        inputDescription: fixture.inputDescription,
        outputDescription: fixture.outputDescription,
        constraints: fixture.constraints ?? null,
        rating: fixture.rating,
        tags: JSON.stringify(fixture.tags),
        timeLimitMs: fixture.timeLimitMs ?? 2000,
        memoryLimitMb: fixture.memoryLimitMb ?? 256,
        status: fixture.status ?? "PUBLISHED",
        createdByUserId: admin.id,
        testCases: {
          create: fixture.testCases.map((tc) => ({
            input: tc.input,
            expectedOutput: tc.expectedOutput,
            isSample: tc.isSample,
            sortOrder: tc.sortOrder,
          })),
        },
      },
    });
    seededSlugs.push(problem.slug);
  }

  console.log(`  Seeded ${seededSlugs.length} CodePath problems from fixtures.`);

  console.log("Seed completed successfully.");
  console.log("  Admin: admin@codepath.com / admin123");
  console.log("  No mentees seeded — register a new account from the frontend.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
