/**
 * Migration Utilities for Job Info Saver
 * 
 * Run these functions in the browser console on preview.html
 * BEFORE and AFTER the v3 migration to verify data integrity.
 */

/**
 * Backup all jobs to a JSON file
 * Run this BEFORE any migration to save your data
 */
async function backupAllJobs() {
    try {
        const jobs = await db.getAllJobs();
        const backup = {
            version: 2,
            timestamp: new Date().toISOString(),
            count: jobs.length,
            jobs: jobs
        };

        const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `jobs_backup_v2_${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        console.log(`✅ Backed up ${jobs.length} jobs to file`);
        console.log('Save this file before proceeding with migration!');
        return jobs;
    } catch (error) {
        console.error('❌ Backup failed:', error);
        throw error;
    }
}

/**
 * Verify migration integrity
 * @param {Array} backupJobs - Jobs from backup (before migration)
 * @param {Array} migratedJobs - Jobs after migration
 * @returns {boolean} - true if all tests pass
 */
function verifyMigration(backupJobs, migratedJobs) {
    const errors = [];

    console.log('\n=== MIGRATION VERIFICATION ===\n');

    // 1. Count check
    if (backupJobs.length !== migratedJobs.length) {
        errors.push(`❌ Count mismatch: ${backupJobs.length} → ${migratedJobs.length}`);
    } else {
        console.log(`✅ Count preserved: ${migratedJobs.length} jobs`);
    }

    // 2. All have jobId
    const missingJobId = migratedJobs.filter(j => !j.jobId);
    if (missingJobId.length > 0) {
        errors.push(`❌ ${missingJobId.length} jobs missing jobId`);
        missingJobId.slice(0, 5).forEach(j => {
            errors.push(`   - id=${j.id}, company="${j.company}"`);
        });
    } else {
        console.log(`✅ All jobs have jobId`);
    }

    // 3. All jobIds are unique
    const jobIds = migratedJobs.map(j => j.jobId).filter(Boolean);
    const uniqueJobIds = new Set(jobIds);
    if (uniqueJobIds.size !== jobIds.length) {
        const duplicates = jobIds.length - uniqueJobIds.size;
        errors.push(`❌ Duplicate jobIds found: ${duplicates} duplicates`);
    } else {
        console.log(`✅ All ${jobIds.length} jobIds are unique`);
    }

    // 4. All jobIds are valid UUIDs
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const invalidUuids = migratedJobs.filter(j => j.jobId && !uuidRegex.test(j.jobId));
    if (invalidUuids.length > 0) {
        errors.push(`❌ ${invalidUuids.length} jobs have invalid UUID format`);
    } else {
        console.log(`✅ All jobIds are valid UUID v4 format`);
    }

    // 5. FULL DATA INTEGRITY CHECK - Compare every field of every job
    const fieldsToCheck = [
        'company', 'jobTitle', 'category', 'sponsorship', 'status',
        'jobLink', 'jobDescription', 'savedAt', 'qAndA'
    ];

    let integrityErrors = 0;
    const missingJobs = [];
    const fieldMismatches = [];

    for (const backup of backupJobs) {
        // Find corresponding migrated job by original id
        const migrated = migratedJobs.find(m => m.id === backup.id);

        if (!migrated) {
            missingJobs.push(backup);
            integrityErrors++;
            continue;
        }

        // Check every field
        for (const field of fieldsToCheck) {
            const backupVal = backup[field];
            const migratedVal = migrated[field];

            // Handle undefined vs null vs empty string
            const backupNorm = backupVal === undefined || backupVal === null ? '' : backupVal;
            const migratedNorm = migratedVal === undefined || migratedVal === null ? '' : migratedVal;

            if (backupNorm !== migratedNorm) {
                fieldMismatches.push({
                    id: backup.id,
                    company: backup.company,
                    field: field,
                    before: backupVal,
                    after: migratedVal
                });
                integrityErrors++;
            }
        }
    }

    if (missingJobs.length > 0) {
        errors.push(`❌ ${missingJobs.length} jobs not found after migration:`);
        missingJobs.slice(0, 5).forEach(j => {
            errors.push(`   - id=${j.id}, company="${j.company}", title="${j.jobTitle}"`);
        });
    }

    if (fieldMismatches.length > 0) {
        errors.push(`❌ ${fieldMismatches.length} field mismatches found:`);
        fieldMismatches.slice(0, 10).forEach(m => {
            errors.push(`   - id=${m.id} (${m.company}): ${m.field} changed`);
        });
    }

    if (integrityErrors === 0) {
        console.log(`✅ All ${backupJobs.length} jobs passed full data integrity check`);
        console.log(`   Checked fields: ${fieldsToCheck.join(', ')}`);
    }

    // Summary
    console.log('\n=== VERIFICATION SUMMARY ===');
    if (errors.length === 0) {
        console.log('🎉 ALL TESTS PASSED - Migration successful!');
        console.log(`   Total jobs: ${migratedJobs.length}`);
        console.log(`   All have unique jobId: YES`);
        console.log(`   Data integrity: VERIFIED`);
        return true;
    } else {
        console.log(`⚠️ ${errors.length} ERRORS FOUND:\n`);
        errors.forEach(e => console.log(e));
        console.log('\n❌ MIGRATION VERIFICATION FAILED');
        console.log('Consider restoring from backup.');
        return false;
    }
}

/**
 * Restore jobs from a backup file
 * Use this if migration fails verification
 * @param {Object} backupData - Parsed backup JSON
 */
async function restoreFromBackup(backupData) {
    if (!backupData || !backupData.jobs || !Array.isArray(backupData.jobs)) {
        console.error('❌ Invalid backup data');
        return false;
    }

    const confirmMsg = `This will replace ALL current jobs with ${backupData.jobs.length} jobs from backup. Continue?`;
    if (!confirm(confirmMsg)) {
        console.log('Restore cancelled');
        return false;
    }

    try {
        await db.clearAllJobs();
        await db.addJobs(backupData.jobs);
        console.log(`✅ Restored ${backupData.jobs.length} jobs from backup`);
        console.log('Reload the page to see changes.');
        return true;
    } catch (error) {
        console.error('❌ Restore failed:', error);
        throw error;
    }
}

// Make functions available globally
window.backupAllJobs = backupAllJobs;
window.verifyMigration = verifyMigration;
window.restoreFromBackup = restoreFromBackup;

console.log('Migration utilities loaded. Available functions:');
console.log('  - backupAllJobs() : Download all jobs as JSON backup');
console.log('  - verifyMigration(backup, migrated) : Verify migration integrity');
console.log('  - restoreFromBackup(backupData) : Restore from backup if needed');
