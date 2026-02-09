import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import * as bcrypt from "bcryptjs";

async function main() {
  console.log("Clearing existing data...");

  // Delete in reverse dependency order
  await prisma.moduleProblem.deleteMany();
  await prisma.moduleResource.deleteMany();
  await prisma.pathModule.deleteMany();
  await prisma.learningPath.deleteMany();
  await prisma.userSkillAssessment.deleteMany();
  await prisma.favouriteProblem.deleteMany();
  await prisma.userProblemAttempt.deleteMany();
  await prisma.externalSubmission.deleteMany();
  await prisma.profile.deleteMany();
  await prisma.externalAccount.deleteMany();
  await prisma.user.deleteMany();
  await prisma.contactInquery.deleteMany();
  await prisma.contactInfo.deleteMany();
  await prisma.quizQuestion.deleteMany();
  await prisma.skillLevel.deleteMany();
  await prisma.topic.deleteMany();
  await prisma.role.deleteMany();

  console.log("Seeding roles...");
  const adminRole = await prisma.role.create({ data: { title: "Admin" } });
  const menteeRole = await prisma.role.create({ data: { title: "Mentee" } });

  console.log("Seeding users and profiles...");
  const hashedAdmin = await bcrypt.hash("admin123", 10);
  const hashedMentee = await bcrypt.hash("mentee123", 10);

  const admin = await prisma.user.create({
    data: {
      username: "admin",
      email: "admin@codepath.com",
      password: hashedAdmin,
      roleId: adminRole.id,
    },
  });

  const mentee1 = await prisma.user.create({
    data: {
      username: "mentee1",
      email: "mentee1@example.com",
      password: hashedMentee,
      roleId: menteeRole.id,
    },
  });

  const mentee2 = await prisma.user.create({
    data: {
      username: "mentee2",
      email: "mentee2@example.com",
      password: hashedMentee,
      roleId: menteeRole.id,
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

  await prisma.profile.create({
    data: {
      userId: mentee1.id,
      fullName: "Alice Mentee",
      country: "United States",
      phone: "+1987654321",
      bio: "Competitive programming enthusiast",
      problemsSolved: 120,
      rating: 1500,
      accuracy: 75,
    },
  });

  await prisma.profile.create({
    data: {
      userId: mentee2.id,
      fullName: "Bob Learner",
      country: "United Kingdom",
      phone: "+441234567890",
      bio: "Learning algorithms and data structures",
      problemsSolved: 45,
      rating: 1200,
      accuracy: 68,
    },
  });

  console.log("Seeding external accounts...");
  await prisma.externalAccount.create({
    data: {
      userId: mentee1.id,
      platform: "Codeforces",
      handle: "alice_cf",
      lastSynced: new Date(),
      isVerified: true,
    },
  });

  await prisma.externalAccount.create({
    data: {
      userId: mentee2.id,
      platform: "Codeforces",
      handle: "bob_coder",
      isVerified: false,
    },
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

  console.log("Seeding contact inquiries (sample)...");
  await prisma.contactInquery.create({
    data: {
      fullName: "John Doe",
      email: "john@example.com",
      title: "Partnership inquiry",
      message: "I would like to discuss a partnership opportunity.",
    },
  });

  console.log("Seeding quiz questions...");
  await prisma.quizQuestion.createMany({
    data: [
      { questionTitle: "What is the time complexity of binary search?", answer: "O(log n)", score: 10 },
      { questionTitle: "What data structure uses LIFO?", answer: "Stack", score: 5 },
      { questionTitle: "What is the best case for quicksort?", answer: "O(n log n)", score: 10 },
      { questionTitle: "Which algorithm finds shortest path in unweighted graph?", answer: "BFS", score: 10 },
      { questionTitle: "What does DFS stand for?", answer: "Depth First Search", score: 5 },
    ],
  });

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
      targetRatingRange: "1200-1600",
      expectedKnowledge: "DP, graphs, binary search",
    },
  });

  const advanced = await prisma.skillLevel.create({
    data: {
      title: "Advanced",
      description: "Tackling harder contests",
      targetRatingRange: "1600+",
      expectedKnowledge: "Advanced DS, number theory, flows",
    },
  });

  console.log("Seeding user skill assessments...");
  await prisma.userSkillAssessment.create({
    data: {
      userId: mentee1.id,
      assessmentType: "quiz",
      score: 85,
      skillLevelId: intermediate.id,
    },
  });

  await prisma.userSkillAssessment.create({
    data: {
      userId: mentee2.id,
      assessmentType: "quiz",
      score: 60,
      skillLevelId: beginner.id,
    },
  });

  console.log("Seeding topics...");
  const topicAlgo = await prisma.topic.create({
    data: { title: "Algorithms", tags: "sorting,searching", rating: "1200" },
  });
  const topicDS = await prisma.topic.create({
    data: { title: "Data Structures", tags: "arrays,trees,graphs", rating: "1400" },
  });
  const topicMath = await prisma.topic.create({
    data: { title: "Math", tags: "number-theory,combinatorics", rating: "1600" },
  });

  console.log("Seeding learning paths and modules...");
  const pathBeginner = await prisma.learningPath.create({
    data: {
      targetSkillLevelId: beginner.id,
      title: "Beginner Path",
      description: "Get started with competitive programming",
    },
  });

  const pathIntermediate = await prisma.learningPath.create({
    data: {
      targetSkillLevelId: intermediate.id,
      title: "Intermediate Path",
      description: "Level up your problem-solving skills",
    },
  });

  const module1 = await prisma.pathModule.create({
    data: {
      learningPathId: pathBeginner.id,
      topicId: topicAlgo.id,
      moduleOrder: 1,
      title: "Introduction to Sorting",
      description: "Learn basic sorting algorithms",
      estimatedHours: 4,
    },
  });

  const module2 = await prisma.pathModule.create({
    data: {
      learningPathId: pathBeginner.id,
      topicId: topicDS.id,
      moduleOrder: 2,
      title: "Arrays and Strings",
      description: "Master array and string problems",
      estimatedHours: 6,
    },
  });

  await prisma.moduleResource.createMany({
    data: [
      { pathModuleId: module1.id, resourceType: "article", title: "Bubble Sort", description: "Step by step", url: "https://example.com/bubble-sort" },
      { pathModuleId: module1.id, resourceType: "video", title: "Sorting Overview", url: "https://example.com/sorting-video" },
      { pathModuleId: module2.id, resourceType: "article", title: "Array Basics", url: "https://example.com/arrays" },
    ],
  });

  await prisma.moduleProblem.createMany({
    data: [
      { pathModuleId: module1.id, externalProblemId: "1A", platform: "Codeforces" },
      { pathModuleId: module1.id, externalProblemId: "71A", platform: "Codeforces" },
      { pathModuleId: module2.id, externalProblemId: "4A", platform: "Codeforces" },
    ],
  });

  const module3 = await prisma.pathModule.create({
    data: {
      learningPathId: pathIntermediate.id,
      topicId: topicMath.id,
      moduleOrder: 1,
      title: "Number Theory Basics",
      description: "GCD, LCM, primes",
      estimatedHours: 8,
    },
  });

  await prisma.moduleResource.create({
    data: {
      pathModuleId: module3.id,
      resourceType: "article",
      title: "Euclidean Algorithm",
      url: "https://example.com/gcd",
    },
  });

  await prisma.moduleProblem.create({
    data: {
      pathModuleId: module3.id,
      externalProblemId: "230B",
      platform: "Codeforces",
    },
  });

  console.log("Seeding favourite problems and attempts...");
  await prisma.favouriteProblem.create({
    data: {
      userId: mentee1.id,
      externalProblemId: "4A",
      platform: "Codeforces",
    },
  });

  await prisma.userProblemAttempt.create({
    data: {
      userId: mentee1.id,
      externalProblemId: "4A",
      platform: "Codeforces",
      solved: true,
      attemptCount: 2,
      lastAttempt: new Date(),
    },
  });

  await prisma.userProblemAttempt.create({
    data: {
      userId: mentee1.id,
      externalProblemId: "71A",
      platform: "Codeforces",
      solved: true,
      attemptCount: 1,
    },
  });

  console.log("Seed completed successfully.");
  console.log("  Admin: admin@codepath.com / admin123");
  console.log("  Mentee 1: mentee1@example.com / mentee123");
  console.log("  Mentee 2: mentee2@example.com / mentee123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
