/*
  Warnings:

  - You are about to drop the column `wheyReminderSentAt` on the `Activity` table. All the data in the column will be lost.
  - You are about to drop the column `lastWaterReminderSentAt` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `lastWeeklySummarySentAt` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `waterReminderEnd` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `waterReminderIntervalMin` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `waterReminderStart` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `weeklySummaryEnabled` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `wheyReminderEnabled` on the `User` table. All the data in the column will be lost.
  - You are about to drop the `PushSubscription` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `PushSubscription` DROP FOREIGN KEY `PushSubscription_userId_fkey`;

-- AlterTable
ALTER TABLE `Activity` DROP COLUMN `wheyReminderSentAt`;

-- AlterTable
ALTER TABLE `User` DROP COLUMN `lastWaterReminderSentAt`,
    DROP COLUMN `lastWeeklySummarySentAt`,
    DROP COLUMN `waterReminderEnd`,
    DROP COLUMN `waterReminderIntervalMin`,
    DROP COLUMN `waterReminderStart`,
    DROP COLUMN `weeklySummaryEnabled`,
    DROP COLUMN `wheyReminderEnabled`;

-- DropTable
DROP TABLE `PushSubscription`;
