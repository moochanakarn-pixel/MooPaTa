-- DropIndex
DROP INDEX `Food_userId_barcode_idx` ON `Food`;

-- CreateIndex
CREATE UNIQUE INDEX `Food_userId_barcode_key` ON `Food`(`userId`, `barcode`);
