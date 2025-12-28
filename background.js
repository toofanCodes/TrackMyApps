// Background service worker for Job Info Saver
importScripts('libs/db.js');

// --- MIGRATION LOGIC ---
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('Extension installed/updated:', details.reason);

  // 1. Setup Context Menu
  setupContextMenu();

  // 2. Setup Scheduled Export (Default 5 PM)
  setupScheduledExport();

  // 3. Migrate Data from chrome.storage.local to IndexedDB
  await migrateDataToIndexedDB();
});

chrome.runtime.onStartup.addListener(() => {
  console.log('Extension startup');
  setupScheduledExport(); // Ensure alarm is set
});

async function migrateDataToIndexedDB() {
  try {
    console.log('[Migration] Checking for legacy data...');
    const result = await chrome.storage.local.get(['allJobsData', 'dailyJobsData']);
    const legacyJobs = result.allJobsData || [];
    const dailyJobs = result.dailyJobsData || [];

    // Combine unique jobs
    const allLegacyJobs = [...legacyJobs, ...dailyJobs];

    if (allLegacyJobs.length > 0) {
      console.log(`[Migration] Found ${allLegacyJobs.length} legacy jobs. Migrating to IndexedDB...`);

      // Open DB and bulk add
      await self.db.open();
      const result = await self.db.addJobs(allLegacyJobs);

      console.log(`[Migration] Successfully migrated ${result.added} jobs.`);

      // Clear legacy storage to free up space
      await chrome.storage.local.remove(['allJobsData', 'dailyJobsData']);
      console.log('[Migration] Legacy storage cleared.');
    } else {
      console.log('[Migration] No legacy data found.');
    }
  } catch (error) {
    console.error('[Migration] Error migrating data:', error);
  }
}

// --- MESSAGE HANDLING ---
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Background received message:', request.action);

  if (request.action === 'saveJob') {
    handleSaveJob(request.data)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Async response
  }

  if (request.action === 'saveToSheets') {
    // Legacy support or if we keep the name 'saveToSheets' for the button
    handleSaveJob(request.data)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.action === 'manualExport') {
    performDailyExport('Manual Export')
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.action === 'getJobHistory') {
    self.db.getJobsByCompany(request.companyName)
      .then(jobs => sendResponse({ success: true, jobs: jobs }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
});

// --- JOB HANDLING ---
async function handleSaveJob(jobData) {
  try {
    // Add metadata
    if (!jobData.savedAt) jobData.savedAt = new Date().toISOString();
    if (!jobData.status) jobData.status = 'Applied';
    jobData.addedDate = new Date().toLocaleString();
    jobData.addedTimestamp = new Date().toISOString();

    // Save to IndexedDB
    await self.db.addJob(jobData);

    // Get count for response
    const allJobs = await self.db.getAllJobs();

    // Broadcast update to all views (preview page, popup, etc.)
    chrome.runtime.sendMessage({ action: 'jobsUpdated' }).catch(() => {
      // Ignore error if no receivers (e.g. popup closed, no preview open)
    });

    return {
      success: true,
      message: `Job saved! Total jobs: ${allJobs.length}`,
      jobCount: allJobs.length
    };
  } catch (error) {
    console.error('Error saving job:', error);
    return { success: false, error: error.message };
  }
}

// --- SCHEDULER & EXPORT ---
async function setupScheduledExport() {
  try {
    const result = await chrome.storage.local.get(['exportTime']);
    const exportTime = result.exportTime || '17:00'; // Default 5 PM

    // Clear existing
    await chrome.alarms.clear('dailyExport');

    // Parse time
    const [hours, minutes] = exportTime.split(':').map(Number);
    const now = new Date();
    const exportDate = new Date();
    exportDate.setHours(hours, minutes, 0, 0);

    // If passed, schedule for tomorrow
    if (exportDate <= now) {
      exportDate.setDate(exportDate.getDate() + 1);
    }

    const delayInMinutes = (exportDate.getTime() - now.getTime()) / (1000 * 60);

    await chrome.alarms.create('dailyExport', {
      delayInMinutes: delayInMinutes,
      periodInMinutes: 24 * 60 // Daily
    });

    console.log(`[Scheduler] Daily export set for ${exportTime} (${delayInMinutes.toFixed(1)} mins)`);
  } catch (error) {
    console.error('[Scheduler] Error setting up:', error);
  }
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'dailyExport') {
    console.log('[Scheduler] Alarm triggered. Performing export...');
    performDailyExport('Scheduled Export');
  }
});

async function performDailyExport(trigger = 'Scheduled Export') {
  try {
    // Get all jobs
    const allJobs = await self.db.getAllJobs();

    if (allJobs.length === 0) {
      console.log('No jobs to export.');
      return { success: true, message: 'No jobs to export', jobCount: 0 };
    }

    // Create CSV
    const csvContent = createCSVContent(allJobs);
    const csvBase64 = btoa(unescape(encodeURIComponent(csvContent)));
    const dataUrl = 'data:text/csv;base64,' + csvBase64;

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const filename = `job_saver_backup_${timestamp}.csv`;

    // Download
    await chrome.downloads.download({
      url: dataUrl,
      filename: filename,
      saveAs: false // Auto-save to default folder
    });

    // Log history
    const exportRecord = {
      date: new Date().toLocaleDateString(),
      time: new Date().toLocaleTimeString(),
      jobCount: allJobs.length,
      trigger: trigger
    };

    // Update history in local storage (keep history lightweight in local storage)
    const result = await chrome.storage.local.get(['exportHistory']);
    let history = result.exportHistory || [];
    history.unshift(exportRecord);
    if (history.length > 10) history = history.slice(0, 10);
    await chrome.storage.local.set({ exportHistory: history });

    return { success: true, message: `Exported ${allJobs.length} jobs`, jobCount: allJobs.length };
  } catch (error) {
    console.error('Error performing export:', error);
    return { success: false, error: error.message };
  }
}

function createCSVContent(jobs) {
  const headers = [
    'Company', 'Job Title', 'Category', 'Sponsorship',
    'Job Link', 'Job Description', 'Applied Time'
  ];

  const rows = jobs.map(job => [
    escapeCSVField(job.company),
    escapeCSVField(job.jobTitle),
    escapeCSVField(job.category),
    escapeCSVField(job.sponsorship),
    escapeCSVField(job.jobLink || job.siteLink),
    escapeCSVField(job.jobDescription),
    escapeCSVField(job.savedAt ? new Date(job.savedAt).toLocaleString() : '')
  ]);

  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
}

function escapeCSVField(field) {
  if (field === null || field === undefined) return '""';
  const escaped = String(field).replace(/"/g, '""');
  return `"${escaped}"`;
}

// --- CONTEXT MENU ---
function setupContextMenu() {
  chrome.contextMenus.create({
    id: 'saveJob',
    title: 'Save Job to DB',
    contexts: ['page']
  });

  chrome.contextMenus.create({
    id: 'manualExport',
    title: 'Backup Jobs Now',
    contexts: ['page']
  });
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'saveJob') {
    chrome.tabs.sendMessage(tab.id, { action: 'extractJobInfo' }, (response) => {
      if (response && response.success) {
        handleSaveJob(response.data);
      }
    });
  }
  if (info.menuItemId === 'manualExport') {
    performDailyExport('Manual Context Menu');
  }
});