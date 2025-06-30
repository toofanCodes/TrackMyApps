// Background service worker with daily scheduling and Excel export
let dailyJobsData = [];
let exportHistory = [];
const MAX_HISTORY = 3; // Keep last 3 exports

// Load existing data when extension starts
chrome.runtime.onStartup.addListener(() => {
  loadExistingData();
  setupScheduledExport();
});

chrome.runtime.onInstalled.addListener(() => {
  loadExistingData();
  setupContextMenu();
  setupScheduledExport();
});

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'saveJob') {
    handleSaveJob(request.data)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
  
  if (request.action === 'manualExport') {
    manualExport()
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
  
  if (request.action === 'setExportTime') {
    setExportTime(request.time)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
  
  if (request.action === 'getExportTime') {
    getExportTime()
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
  
  if (request.action === 'getJobCount') {
    getJobCount()
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
  
  if (request.action === 'getExportHistory') {
    getExportHistory()
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
});

async function loadExistingData() {
  try {
    const result = await chrome.storage.local.get(['dailyJobsData', 'exportHistory', 'exportTime']);
    dailyJobsData = result.dailyJobsData || [];
    exportHistory = result.exportHistory || [];
    
    // Set default export time if not set (5 PM)
    if (!result.exportTime) {
      await chrome.storage.local.set({ exportTime: '17:00' });
    }
    
    console.log(`Loaded ${dailyJobsData.length} jobs for today`);
  } catch (error) {
    console.error('Error loading existing data:', error);
    dailyJobsData = [];
    exportHistory = [];
  }
}

async function handleSaveJob(jobData) {
  try {
    // Add timestamp for when this job was saved
    jobData.savedAt = new Date().toISOString();
    jobData.savedDate = new Date().toLocaleDateString();
    jobData.savedTime = new Date().toLocaleTimeString();
    
    // Add to today's jobs
    dailyJobsData.push(jobData);
    
    // Save to storage
    await chrome.storage.local.set({ dailyJobsData: dailyJobsData });
    
    return { 
      success: true, 
      message: `Job saved! Total jobs today: ${dailyJobsData.length}`,
      jobCount: dailyJobsData.length
    };
  } catch (error) {
    console.error('Error saving job:', error);
    return { success: false, error: error.message };
  }
}

async function setupScheduledExport() {
  try {
    const result = await chrome.storage.local.get(['exportTime']);
    const exportTime = result.exportTime || '17:00';
    
    // Clear existing alarm
    await chrome.alarms.clear('dailyExport');
    
    // Set new alarm for daily export
    const [hours, minutes] = exportTime.split(':').map(Number);
    const now = new Date();
    const exportDate = new Date();
    exportDate.setHours(hours, minutes, 0, 0);
    
    // If today's export time has passed, schedule for tomorrow
    if (exportDate <= now) {
      exportDate.setDate(exportDate.getDate() + 1);
    }
    
    const delayInMinutes = (exportDate.getTime() - now.getTime()) / (1000 * 60);
    
    await chrome.alarms.create('dailyExport', {
      delayInMinutes: delayInMinutes,
      periodInMinutes: 24 * 60 // Repeat every 24 hours
    });
    
    console.log(`Scheduled daily export for ${exportTime} (${delayInMinutes.toFixed(1)} minutes from now)`);
  } catch (error) {
    console.error('Error setting up scheduled export:', error);
  }
}

async function setExportTime(time) {
  try {
    await chrome.storage.local.set({ exportTime: time });
    await setupScheduledExport();
    return { success: true, message: `Export time set to ${time}` };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function getExportTime() {
  try {
    const result = await chrome.storage.local.get(['exportTime']);
    return { success: true, exportTime: result.exportTime || '17:00' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function manualExport() {
  return await performDailyExport('Manual Export');
}

async function performDailyExport(trigger = 'Scheduled Export') {
  try {
    if (dailyJobsData.length === 0) {
      console.log('No jobs to export today');
      return { success: true, message: 'No jobs to export today', jobCount: 0 };
    }
    
    // Create Excel content
    const excelContent = createExcelContent(dailyJobsData);
    
    // Generate filename with date
    const today = new Date().toISOString().split('T')[0];
    const filename = `jobs/${today}_jobs.xlsx`;
    
    // Convert to base64 data URL for download (Manifest V3 compatible)
    const csvBase64 = btoa(unescape(encodeURIComponent(excelContent)));
    const dataUrl = 'data:text/csv;base64,' + csvBase64;
    
    await chrome.downloads.download({
      url: dataUrl,
      filename: filename,
      saveAs: false
    });
    
    // Add to export history
    const exportRecord = {
      date: today,
      time: new Date().toLocaleTimeString(),
      jobCount: dailyJobsData.length,
      trigger: trigger
    };
    
    exportHistory.unshift(exportRecord);
    
    // Keep only last 3 exports
    if (exportHistory.length > MAX_HISTORY) {
      exportHistory = exportHistory.slice(0, MAX_HISTORY);
    }
    
    // Clear today's data after export
    dailyJobsData = [];
    
    // Save updated data
    await chrome.storage.local.set({ 
      dailyJobsData: dailyJobsData,
      exportHistory: exportHistory 
    });
    
    console.log(`Exported ${exportRecord.jobCount} jobs for ${today}`);
    
    return { 
      success: true, 
      message: `Exported ${exportRecord.jobCount} jobs for ${today}`,
      jobCount: exportRecord.jobCount,
      filename: filename
    };
  } catch (error) {
    console.error('Error performing daily export:', error);
    return { success: false, error: error.message };
  }
}

function createExcelContent(jobs) {
  // Create a simple Excel-like structure using XML
  const workbook = {
    sheets: [{
      name: 'Jobs',
      rows: [
        // Header row
        ['URL', 'Date/Time Saved', 'Company Name', 'Job Description', 'Full Page Content'],
        // Data rows
        ...jobs.map(job => [
          job.siteLink || '',
          `${job.savedDate} ${job.savedTime}`,
          job.company || '',
          job.jobDescription || '',
          job.fullPageContent || ''
        ])
      ]
    }]
  };
  
  // For now, we'll create a CSV that Excel can open
  // In a full implementation, you'd use a library like SheetJS to create proper Excel files
  const csvContent = workbook.sheets[0].rows.map(row => 
    row.map(field => escapeCSVField(field)).join(',')
  ).join('\n');
  
  return csvContent;
}

function escapeCSVField(field) {
  if (field === null || field === undefined) {
    return '""';
  }
  const escaped = String(field).replace(/"/g, '""');
  return `"${escaped}"`;
}

async function getJobCount() {
  try {
    return { 
      success: true, 
      jobCount: dailyJobsData.length,
      lastSaved: dailyJobsData.length > 0 ? dailyJobsData[dailyJobsData.length - 1].savedTime : null
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function getExportHistory() {
  try {
    return { 
      success: true, 
      exportHistory: exportHistory
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function setupContextMenu() {
  chrome.contextMenus.create({
    id: 'saveJob',
    title: 'Save Job for Daily Export',
    contexts: ['page']
  });
  
  chrome.contextMenus.create({
    id: 'manualExport',
    title: 'Export Jobs Now',
    contexts: ['page']
  });
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'saveJob') {
    // Extract and save job data from the current tab
    chrome.tabs.sendMessage(tab.id, { action: 'extractJobInfo' }, (response) => {
      if (response && response.success) {
        handleSaveJob(response.data);
      }
    });
  }
  
  if (info.menuItemId === 'manualExport') {
    manualExport();
  }
});

// Handle scheduled alarms
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'dailyExport') {
    console.log('Daily export alarm triggered');
    performDailyExport('Scheduled Export');
  }
}); 