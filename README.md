# Job Info Saver Chrome Extension

A Chrome extension that extracts job information from various job websites and saves it locally to your browser. It allows for easy management, filtering, and exporting of your saved jobs.

## Features

- **Automatic Job Data Extraction**: Extracts job information from popular job sites like LinkedIn and other generic job boards.
- **Robust Local Storage**: Uses IndexedDB to store a large number of jobs efficiently.
- **Scheduled Daily Backups**: Automatically backs up all your saved jobs to a CSV file every day at a configurable time (default is 5 PM).
- **Advanced Job Management**: A dedicated "Downloads" page to manage your jobs.
- **Filter and Export**: Filter jobs by date range (all, today, since last export, custom range) and download them as a CSV file.
- **Import and Merge**: Import jobs from a CSV file, with duplicate detection.
- **Data Integrity**: Undo your last import and delete jobs individually or in bulk based on filters.
- **Job History**: The popup shows a history of jobs you've saved for the currently viewed company.
- **Custom Categories**: Organize your jobs with custom categories and sponsorship status.
- **Context Menu Shortcuts**: Right-click on any page to quickly save a job or trigger a manual backup.
- **Data Migration**: Automatically migrates data from older versions of the extension.

## Extracted Information

The extension extracts the following information from job pages:
- Job Title
- Company Name
- Job Link (URL of the job posting)
- Job Description (full content of the job posting)
- Saved At (Date and time when the job was saved)

## Installation

1. Download or clone this repository.
2. Open Chrome and navigate to `chrome://extensions/`.
3. Enable "Developer mode" in the top right corner.
4. Click "Load unpacked" and select the `saveToSheets` folder.
5. The extension should now appear in your extensions list.

## Usage

### Saving a Job

1. Navigate to a job posting page (e.g., on LinkedIn).
2. Click the extension icon in your Chrome toolbar.
3. Select a category and sponsorship status.
4. Click "Save Job". The job information will be extracted and saved locally.

### Managing and Exporting Jobs

1. Click the "Downloads" button in the extension popup to open the management page.
2. **Filtering**: Use the dropdown to filter which jobs are displayed. You can choose "All Jobs", "Today", "Since Last Export", or a "Custom Range".
3. **Exporting**: After filtering, click "Download Filtered Jobs" to get a CSV file of the selected jobs.
4. **Importing**: Use the "Import from CSV" section to select a CSV file and merge it with your saved jobs.
5. **Deleting**: Use the "Delete Filtered Jobs" button to remove the jobs currently displayed in the preview. You can also "Clear All Saved Jobs" to start fresh.

### Context Menu

- Right-click on any job page and select "Save Job to DB" to quickly save the job.
- Right-click anywhere and select "Backup Jobs Now" to trigger a manual export of all your jobs.

## Supported Job Sites

- **LinkedIn**: Optimized for detailed extraction.
- **Generic Sites**: Works with most other job sites by using common HTML structures to find job titles and company names.

## File Structure

```
saveToSheets/
├── manifest.json          # Extension manifest
├── background.js          # Main background service worker
├── content.js             # Content script for data extraction
├── popup.html             # Extension popup interface
├── popup.js               # Popup functionality
├── downloads.html         # Job management and downloads page
├── downloads.js           # Functionality for the downloads page
├── preview.html           # Job preview page
├── preview.js             # Functionality for the preview page
├── libs/
│   └── db.js              # IndexedDB wrapper
├── icons/                 # Extension icons
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── README.md              # This file
```

## Customization

### Adding New Job Sites

To add support for a new job site, you can edit `content.js`. Add a new extraction function for the specific site and then call it from the `extractJobInformation` function based on the website's domain.

```javascript
function extractFromNewSite() {
  const data = {};
  data.jobTitle = document.querySelector('.job-title-selector')?.innerText.trim() || '';
  data.company = document.querySelector('.company-name-selector')?.innerText.trim() || '';
  // ... add more selectors
  return data;
}

// In extractJobInformation()
if (domain.includes('newsite.com')) {
  jobData = extractFromNewSite();
}
```

### Modifying CSV Headers

The headers for the CSV export are defined in `background.js` in the `createCSVContent` function and in `downloads.js`. If you add new fields to be extracted, you'll need to update the headers in both of these locations.

## Troubleshooting

- **Extension Not Working**: Ensure the extension is enabled in `chrome://extensions/`. Check the browser console for errors by right-clicking the extension icon, selecting "Inspect popup", and checking the "Console" tab.
- **Data Not Extracting**: Job sites frequently change their layout, which can break the extraction process. If data isn't extracting correctly, you may need to update the selectors in `content.js`.
- **CSV Download Issues**: Ensure that you don't have any browser settings or other extensions that block downloads.

## Privacy

- All data is stored locally in your browser's IndexedDB.
- No data is ever sent to external servers.
- CSV files are created and saved directly on your local machine. 