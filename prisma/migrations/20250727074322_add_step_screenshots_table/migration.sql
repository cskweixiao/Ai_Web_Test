-- CreateTable
CREATE TABLE `step_screenshots` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `run_id` VARCHAR(255) NOT NULL,
    `test_case_id` INTEGER NULL,
    `step_index` VARCHAR(50) NOT NULL,
    `step_description` TEXT NULL,
    `status` ENUM('success', 'failed', 'error', 'completed') NOT NULL,
    `file_path` VARCHAR(1024) NOT NULL,
    `file_name` VARCHAR(255) NOT NULL,
    `file_size` BIGINT NULL,
    `mime_type` VARCHAR(100) NULL DEFAULT 'image/png',
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `file_exists` BOOLEAN NOT NULL DEFAULT true,

    INDEX `idx_run_id`(`run_id`),
    INDEX `idx_test_case_id`(`test_case_id`),
    INDEX `idx_created_at`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `step_screenshots` ADD CONSTRAINT `step_screenshots_test_case_id_fkey` FOREIGN KEY (`test_case_id`) REFERENCES `test_cases`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
