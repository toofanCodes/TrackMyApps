// Background service worker for handling Google Sheets integration
let accessToken = null;
let spreadsheetId = null;

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'saveToSheets') {
    handleSaveToSheets(request.data)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Keep the message channel open for async response
  }
});

async function handleSaveToSheets(jobData) {
  try {
    // Check if we have stored credentials
    const credentials = await getStoredCredentials();
    
    if (!credentials.accessToken) {
      // Need to authenticate first
      return { success: false, error: 'Please authenticate with Google first' };
    }
    
    if (!credentials.spreadsheetId) {
      // Create a new spreadsheet
      const newSpreadsheetId = await createNewSpreadsheet(credentials.accessToken);
      await storeSpreadsheetId(newSpreadsheetId);
      credentials.spreadsheetId = newSpreadsheetId;
    }
    
    // Save the job data to the spreadsheet
    await appendJobData(credentials.accessToken, credentials.spreadsheetId, jobData);
    
    return { success: true };
  } catch (error) {
    console.error('Error saving to sheets:', error);
    return { success: false, error: error.message };
  }
}

async function getStoredCredentials() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['accessToken', 'spreadsheetId'], (result) => {
      resolve({
        accessToken: result.accessToken || null,
        spreadsheetId: result.spreadsheetId || null
      });
    });
  });
}

async function storeAccessToken(token) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ accessToken: token }, resolve);
  });
}

async function storeSpreadsheetId(id) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ spreadsheetId: id }, resolve);
  });
}

async function createNewSpreadsheet(accessToken) {
  const response = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      properties: {
        title: 'Job Applications - ' + new Date().toLocaleDateString()
      },
      sheets: [{
        properties: {
          title: 'Job Data',
          gridProperties: {
            rowCount: 1000,
            columnCount: 8
          }
        }
      }]
    })
  });
  
  if (!response.ok) {
    throw new Error('Failed to create spreadsheet');
  }
  
  const data = await response.json();
  return data.spreadsheetId;
}

async function appendJobData(accessToken, spreadsheetId, jobData) {
  const values = [
    [
      jobData.jobTitle || '',
      jobData.company || '',
      jobData.location || '',
      jobData.jobDescription || '',
      jobData.salary || '',
      jobData.siteLink || '',
      jobData.dateTime || new Date().toISOString(),
      new Date().toLocaleString()
    ]
  ];
  
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/A1:append?valueInputOption=USER_ENTERED`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        values: values
      })
    }
  );
  
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Failed to append data: ${errorData.error?.message || 'Unknown error'}`);
  }
  
  return response.json();
}

// Handle OAuth flow
chrome.runtime.onInstalled.addListener(() => {
  // Set up OAuth flow when extension is installed
  setupOAuth();
});

function setupOAuth() {
  // This would typically involve opening an OAuth popup
  // For now, we'll provide instructions for manual setup
  console.log('Extension installed. Please set up Google Sheets API credentials.');
}

// Alternative: Export to CSV for local storage
async function exportToCSV(jobData) {
  const csvContent = [
    'Job Title,Company,Location,Job Description,Salary,Site Link,Date Time,Added Date',
    `"${jobData.jobTitle || ''}","${jobData.company || ''}","${jobData.location || ''}","${jobData.jobDescription || ''}","${jobData.salary || ''}","${jobData.siteLink || ''}","${jobData.dateTime || ''}","${new Date().toLocaleString()}"`
  ].join('\n');
  
  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  
  chrome.downloads.download({
    url: url,
    filename: `job_data_${new Date().toISOString().split('T')[0]}.csv`,
    saveAs: true
  });
}

// Listen for context menu clicks (alternative way to save)
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'saveJobToSheets',
    title: 'Save Job to Sheets',
    contexts: ['page']
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'saveJobToSheets') {
    // Extract and save job data from the current tab
    chrome.tabs.sendMessage(tab.id, { action: 'extractJobInfo' }, (response) => {
      if (response && response.success) {
        handleSaveToSheets(response.data);
      }
    });
  }
}); 