/*
  Warnings:

  - A unique constraint covering the columns `[userId,platform]` on the table `ExternalAccount` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
WITH ranked AS (
  SELECT
    id,
    MIN(id) OVER (PARTITION BY "userId", "platform") AS keep_id
  FROM "ExternalAccount"
)
UPDATE "ExternalSubmission" submission
SET "externalAccountId" = ranked.keep_id::text
FROM ranked
WHERE submission."externalAccountId" = ranked.id::text
  AND ranked.id <> ranked.keep_id;

DELETE FROM "ExternalAccount" account
USING (
  SELECT id
  FROM (
    SELECT
      id,
      MIN(id) OVER (PARTITION BY "userId", "platform") AS keep_id
    FROM "ExternalAccount"
  ) ranked
  WHERE id <> keep_id
) duplicates
WHERE account.id = duplicates.id;

CREATE UNIQUE INDEX "ExternalAccount_userId_platform_key" ON "ExternalAccount"("userId", "platform");
