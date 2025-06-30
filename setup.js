// Setup script for Job Info Saver extension
console.log('Job Info Saver Extension Setup');
console.log('================================');

// Check if we're in a Chrome extension context
if (typeof chrome !== 'undefined' && chrome.runtime) {
  console.log('✅ Chrome extension environment detected');
} else {
  console.log('❌ Not running in Chrome extension environment');
  console.log('Please load this as an unpacked extension in Chrome');
}

// Configuration options
const config = {
  // Choose your preferred save method
  saveMethod: 'csv', // 'csv' or 'sheets'
  
  // Google Sheets API settings (if using sheets method)
  googleSheets: {
    clientId: '', // Your OAuth 2.0 client ID
    apiKey: '',   // Your API key
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  },
  
  // CSV export settings
  csv: {
    includeHeaders: true,
    filenamePrefix: 'job_data_',
    autoDownload: true
  },
  
  // Supported job sites
  supportedSites: [
    'linkedin.com',
    'indeed.com',
    'glassdoor.com',
    'monster.com',
    'ziprecruiter.com'
  ]
};

// Function to validate configuration
function validateConfig() {
  console.log('Validating configuration...');
  
  if (config.saveMethod === 'sheets' && !config.googleSheets.clientId) {
    console.warn('⚠️  Google Sheets method selected but no client ID provided');
    console.log('Please set up Google Cloud Platform credentials');
  }
  
  if (config.saveMethod === 'csv') {
    console.log('✅ CSV export mode configured');
  }
  
  console.log('✅ Configuration validation complete');
}

// Function to test extraction on current page
async function testExtraction() {
  console.log('Testing job information extraction...');
  
  try {
    // Simulate extraction (this would normally be done by content script)
    const testData = {
      jobTitle: 'Software Engineer',
      company: 'Test Company',
      location: 'San Francisco, CA',
      jobDescription: 'This is a test job description...',
      salary: '$100,000 - $150,000',
      siteLink: window.location.href,
      dateTime: new Date().toISOString()
    };
    
    console.log('✅ Test extraction successful');
    console.log('Sample data:', testData);
    
    return testData;
  } catch (error) {
    console.error('❌ Test extraction failed:', error);
    return null;
  }
}

// Function to test CSV export
async function testCSVExport(data) {
  console.log('Testing CSV export...');
  
  try {
    const csvContent = [
      'Job Title,Company,Location,Job Description,Salary,Site Link,Date Time',
      `"${data.jobTitle}","${data.company}","${data.location}","${data.jobDescription}","${data.salary}","${data.siteLink}","${data.dateTime}"`
    ].join('\n');
    
    console.log('✅ CSV content generated successfully');
    console.log('Sample CSV:');
    console.log(csvContent);
    
    return csvContent;
  } catch (error) {
    console.error('❌ CSV export test failed:', error);
    return null;
  }
}

// Main setup function
async function runSetup() {
  console.log('Starting setup...');
  
  // Validate configuration
  validateConfig();
  
  // Test extraction
  const testData = await testExtraction();
  
  if (testData) {
    // Test CSV export
    await testCSVExport(testData);
  }
  
  console.log('Setup complete!');
  console.log('');
  console.log('Next steps:');
  console.log('1. Load the extension in Chrome (chrome://extensions/)');
  console.log('2. Navigate to a job posting page');
  console.log('3. Click the extension icon to extract and save job data');
  console.log('4. Use right-click context menu for quick saves');
}

// Run setup if this script is executed
if (typeof window !== 'undefined') {
  // Wait for page to load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runSetup);
  } else {
    runSetup();
  }
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    config,
    validateConfig,
    testExtraction,
    testCSVExport,
    runSetup
  };
} 