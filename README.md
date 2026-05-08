# Job Tracker Chrome Extension with Kanban Dashboard

A Chrome extension designed to help you track and manage your job applications. It extracts job information from various job websites, saves it locally, and provides a powerful Kanban-style dashboard to visualize and manage your application pipeline from 'Applied' to 'Offer'.

## Features

- **Kanban Dashboard for Application Tracking**: Visualize your job application pipeline with a dynamic, drag-and-drop Kanban board. Easily move job cards through customizable stages like 'Applied', 'Interviewing', 'Offer', and 'Rejected'.
- **Automatic Job Data Extraction**: Extracts key job information (title, company, link, description) from popular job sites like LinkedIn and other generic job boards.
- **Robust Local Storage**: All your job data is stored securely and efficiently in your browser's IndexedDB.
- **Advanced Job Management (Downloads Page)**: A dedicated "Downloads" page for bulk actions like filtering, exporting to CSV, importing from CSV (with duplicate detection), and mass deletion of job entries.
- **Quick Save with Popup**: Use the extension popup to quickly save jobs, categorize them, and set sponsorship status directly from job postings. The popup also shows a history of saved jobs for the current company.
- **Context Menu Shortcuts**: Right-click on any page to quickly save a job or trigger a manual backup.
- **Scheduled Daily Backups**: Automatically backs up all your saved jobs to a CSV file every day at a configurable time (default is 5 PM).
- **Data Integrity**: Undo your last import, delete jobs individually, or clear all saved jobs.
- **Data Migration**: Automatically migrates data from older versions of the extension to ensure compatibility.

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

### Using the Kanban Dashboard

The Kanban Dashboard is your primary interface for managing your job application pipeline.

1.  **Accessing the Dashboard**: Click the "Dashboard" button in the extension popup to open the Kanban board.
2.  **Job Cards**: Each job you save appears as a card on the dashboard.
3.  **Pipelines (Stages)**: Jobs are organized into vertical pipelines (e.g., Applied, Interviewing, Offer).
4.  **Moving Jobs**: Drag and drop job cards between pipelines to update their status.
5.  **Viewing Details**: Click on a job card to view its full details (title, company, link, description).
6.  **Quick Actions**: Right-click on a job card for quick options like editing or deleting.

### Saving a Job

1. Navigate to a job posting page (e.g., on LinkedIn).
2. Click the extension icon in your Chrome toolbar.
3. Select a category and sponsorship status.
4. Click "Save Job". The job information will be extracted and saved locally.

### Managing Jobs (Bulk Operations)

While the Kanban Dashboard is ideal for day-to-day tracking, the "Downloads" page (accessible via the "Downloads" button in the extension popup) provides powerful tools for bulk management:

1.  **Filtering**: Use the dropdown to filter which jobs are displayed based on criteria like "All Jobs", "Today", "Since Last Export", or a "Custom Range".
2.  **Exporting**: After filtering, click "Download Filtered Jobs" to get a CSV file of the selected jobs.
3.  **Importing**: Use the "Import from CSV" section to select a CSV file and merge it with your saved jobs.
4.  **Deleting**: Use the "Delete Filtered Jobs" button to remove the jobs currently displayed in the preview. You can also "Clear All Saved Jobs" to start fresh.

### Context Menu

- Right-click on any job page and select "Save Job to DB" to quickly save the job.
- Right-click anywhere and select "Backup Jobs Now" to trigger a manual export of all your jobs.

## Supported Job Sites

- **LinkedIn**: Optimized for detailed extraction.
- **Generic Sites**: Works with most other job sites by using common HTML structures to find job titles and company names.

## File Structure

```
saveToSheets/
├── manifest.json          # Extension manifest, permissions, and background service worker registration
├── background.js          # Main background service worker for data handling, scheduling, and core logic
├── content.js             # Content script for extracting job information from web pages
├── popup.html             # HTML for the extension's popup interface
├── popup.js               # JavaScript for popup functionality (saving jobs, quick actions)
├── dashboard.html         # HTML for the Kanban-style job tracking dashboard
├── dashboard.js           # JavaScript for the Kanban dashboard functionality
├── downloads.html         # HTML for the job management and bulk operations page
├── downloads.js           # JavaScript for the downloads page functionality
├── preview.html           # HTML for job preview
├── preview.js             # JavaScript for job preview functionality
├── migration-utils.js     # Utility scripts for data migration
├── libs/
│   └── db.js              # IndexedDB wrapper for local data storage
├── icons/                 # Extension icons
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── README.md              # This documentation file
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

- All data is stored **exclusively locally** in your browser's IndexedDB.
- **No data is ever sent to external servers**, including Google Sheets or any other third-party services.
- **Regarding Google Sheets:** While this project was initially conceived with Google Sheets integration and the `manifest.json` might contain remnant permissions related to Google Sheets API (`sheets.googleapis.com`), this feature was abandoned. The current implementation does not use or send data to Google Sheets. We plan to remove these unused permissions from `manifest.json` in a future update to prevent confusion.
- CSV files generated for backup or export are created and saved directly on your local machine. 