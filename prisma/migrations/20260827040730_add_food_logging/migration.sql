-- CreateTable
CREATE TABLE `Food` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `caloriesPer100g` DOUBLE NOT NULL,
    `proteinPer100g` DOUBLE NOT NULL,
    `carbPer100g` DOUBLE NOT NULL,
    `fatPer100g` DOUBLE NOT NULL,
    `barcode` VARCHAR(191) NULL,
    `source` ENUM('CATALOG', 'BARCODE', 'CUSTOM') NOT NULL DEFAULT 'CUSTOM',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `userId` VARCHAR(191) NOT NULL,

    INDEX `Food_userId_idx`(`userId`),
    INDEX `Food_userId_barcode_idx`(`userId`, `barcode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FoodLog` (
    `id` VARCHAR(191) NOT NULL,
    `grams` DOUBLE NOT NULL,
    `loggedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `mealType` ENUM('BREAKFAST', 'LUNCH', 'DINNER', 'SNACK') NULL,
    `userId` VARCHAR(191) NOT NULL,
    `foodId` VARCHAR(191) NOT NULL,

    INDEX `FoodLog_userId_loggedAt_idx`(`userId`, `loggedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Food` ADD CONSTRAINT `Food_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FoodLog` ADD CONSTRAINT `FoodLog_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FoodLog` ADD CONSTRAINT `FoodLog_foodId_fkey` FOREIGN KEY (`foodId`) REFERENCES `Food`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
