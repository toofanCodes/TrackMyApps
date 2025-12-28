// Background service worker for local CSV export with reusable sheet
let allJobsData = [];

// Load existing data when extension starts
chrome.runtime.onStartup.addListener(() => {
  console.log('Extension startup - loading existing data...');
  loadExistingData();
});

chrome.runtime.onInstalled.addListener(() => {
  console.log('Extension installed - loading existing data...');
  loadExistingData();
  setupContextMenu();
});

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Background received message:', request.action, request);
  
  try {
    if (request.action === 'saveToSheets') {
      handleSaveToCSV(request.data)
        .then(result => {
          console.log('Save result:', result);
          sendResponse(result || { success: false, error: 'No result from save operation' });
        })
        .catch(error => {
          console.error('Save error:', error);
          sendResponse({ success: false, error: error.message });
        });
      return true; // Keep the message channel open for async response
    }
    
    if (request.action === 'exportAllJobs') {
      exportAllJobsToCSV()
        .then(result => {
          console.log('Export result:', result);
          sendResponse(result || { success: false, error: 'No result from export operation' });
        })
        .catch(error => {
          console.error('Export error:', error);
          sendResponse({ success: false, error: error.message });
        });
      return true;
    }
    
    if (request.action === 'getJobCount') {
      getJobCount()
        .then(result => {
          console.log('Job count result:', result);
          sendResponse(result || { success: false, error: 'No result from job count operation' });
        })
        .catch(error => {
          console.error('Job count error:', error);
          sendResponse({ success: false, error: error.message });
        });
      return true;
    }
    
    if (request.action === 'getAllJobsData') {
      console.log('Returning all jobs data, count:', allJobsData.length);
      sendResponse({ success: true, data: allJobsData || [] });
      return false;
    }
    
    // If we get here, the action wasn't recognized
    console.warn('Unknown message action:', request.action);
    sendResponse({ success: false, error: `Unknown action: ${request.action}` });
    return false;
    
  } catch (error) {
    console.error('Message handler error:', error);
    sendResponse({ success: false, error: error.message || 'Unknown error' });
    return false;
  }
});

// Load existing data from storage
async function loadExistingData() {
  try {
    console.log('[loadExistingData] Loading existing data from storage...');
    const result = await chrome.storage.local.get(['allJobsData']);
    console.log('[loadExistingData] Data read from storage:', result.allJobsData);
    allJobsData = result.allJobsData || [];
    console.log(`[loadExistingData] Loaded ${allJobsData.length} jobs from storage`);
  } catch (error) {
    console.error('[loadExistingData] Error loading existing data:', error);
    allJobsData = [];
  }
}

// Save job data to local storage
async function handleSaveToCSV(jobData) {
  try {
    console.log('[handleSaveToCSV] Saving job data:', jobData);
    // Always add a savedAt ISO string for filtering
    jobData.savedAt = jobData.savedAt || new Date().toISOString();
    jobData.addedDate = new Date().toLocaleString();
    jobData.addedTimestamp = new Date().toISOString();

    // Always read the latest jobs from storage
    console.log('[handleSaveToCSV] Reading allJobsData from storage before saving...');
    const result = await chrome.storage.local.get(['allJobsData']);
    console.log('[handleSaveToCSV] Data read from storage:', result.allJobsData);
    const jobs = result.allJobsData || [];
    console.log(`[handleSaveToCSV] jobs array before push:`, jobs);
    jobs.push(jobData);
    console.log(`[handleSaveToCSV] jobs array after push:`, jobs);

    // Save to storage
    console.log('[handleSaveToCSV] Writing jobs array to storage:', jobs);
    await chrome.storage.local.set({ allJobsData: jobs });
    console.log('[handleSaveToCSV] Successfully saved to storage.');

    // Update in-memory array
    allJobsData = jobs;
    console.log(`[handleSaveToCSV] Updated in-memory allJobsData:`, allJobsData);

    return { 
      success: true, 
      message: `Job saved! Total jobs: ${jobs.length}`,
      jobCount: jobs.length
    };
  } catch (error) {
    console.error('[handleSaveToCSV] Error saving to CSV:', error);
    return { success: false, error: error.message };
  }
}

// Export all jobs to CSV
async function exportAllJobsToCSV() {
  try {
    if (allJobsData.length === 0) {
      return { success: false, error: 'No jobs saved yet' };
    }
    
    // Create CSV content
    const csvContent = createCompleteCSVContent(allJobsData);
    const csvBase64 = btoa(unescape(encodeURIComponent(csvContent)));
    const dataUrl = 'data:text/csv;base64,' + csvBase64;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const filename = `all_jobs_export_${timestamp}.csv`;
    
    await chrome.downloads.download({
      url: dataUrl,
      filename: filename,
      saveAs: true
    });
    
    return { 
      success: true, 
      message: `Exported ${allJobsData.length} jobs to CSV`,
      jobCount: allJobsData.length
    };
  } catch (error) {
    console.error('Error exporting all jobs:', error);
    return { success: false, error: error.message };
  }
}

// Get job count
async function getJobCount() {
  try {
    return { 
      success: true, 
      jobCount: allJobsData.length,
      lastUpdated: allJobsData.length > 0 ? allJobsData[allJobsData.length - 1].addedDate : null
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Create CSV content
function createCompleteCSVContent(allJobs) {
  const headers = [
    'Company',
    'Job Title',
    'Category', 
    'Sponsorship',
    'Job Link',
    'Job Description',
    'Applied Time'
  ];
  const csvRows = [headers.join(',')];
  allJobs.forEach(job => {
    const rowData = [
      escapeCSVField(job.company || ''),
      escapeCSVField(job.jobTitle || ''),
      escapeCSVField(job.category || ''),
      escapeCSVField(job.sponsorship || ''),
      escapeCSVField(job.jobLink || ''),
      escapeCSVField(job.jobDescription || ''),
      escapeCSVField(job.savedAt ? new Date(job.savedAt).toLocaleString() : '')
    ];
    csvRows.push(rowData.join(','));
  });
  
  return csvRows.join('\n');
}

// Escape CSV fields
function escapeCSVField(field) {
  if (field === null || field === undefined) {
    return '""';
  }
  const escaped = String(field).replace(/"/g, '""');
  return `"${escaped}"`;
}

// Setup context menu
function setupContextMenu() {
  chrome.contextMenus.create({
    id: 'saveJobToCSV',
    title: 'Save Job to CSV',
    contexts: ['page']
  });
  
  chrome.contextMenus.create({
    id: 'exportAllJobs',
    title: 'Export All Jobs',
    contexts: ['page']
  });
}

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'saveJobToCSV') {
    // Extract and save job data from the current tab
    chrome.tabs.sendMessage(tab.id, { action: 'extractJobInfo' }, (response) => {
      if (response && response.success) {
        handleSaveToCSV(response.data);
      }
    });
  }
  
  if (info.menuItemId === 'exportAllJobs') {
    exportAllJobsToCSV();
  }
}); 