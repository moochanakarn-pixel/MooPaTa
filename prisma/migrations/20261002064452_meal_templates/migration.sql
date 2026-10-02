-- CreateTable
CREATE TABLE `MealTemplate` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `userId` VARCHAR(191) NOT NULL,

    INDEX `MealTemplate_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MealTemplateItem` (
    `id` VARCHAR(191) NOT NULL,
    `grams` DOUBLE NOT NULL,
    `order` INTEGER NOT NULL,
    `templateId` VARCHAR(191) NOT NULL,
    `foodId` VARCHAR(191) NOT NULL,

    INDEX `MealTemplateItem_templateId_idx`(`templateId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `MealTemplate` ADD CONSTRAINT `MealTemplate_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MealTemplateItem` ADD CONSTRAINT `MealTemplateItem_templateId_fkey` FOREIGN KEY (`templateId`) REFERENCES `MealTemplate`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MealTemplateItem` ADD CONSTRAINT `MealTemplateItem_foodId_fkey` FOREIGN KEY (`foodId`) REFERENCES `Food`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
