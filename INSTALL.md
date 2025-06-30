# Installation Guide - Job Info Saver Chrome Extension

## Quick Setup

### 1. Download the Extension
- Download all the files from this repository
- Make sure you have all the required files in one folder

### 2. Load in Chrome
1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" in the top right corner
3. Click "Load unpacked"
4. Select the folder containing the extension files
5. The extension should now appear in your extensions list

### 3. First Use
1. Navigate to any job posting page (LinkedIn, Indeed, Glassdoor, etc.)
2. Click the extension icon in your Chrome toolbar
3. Click "Extract from Page" to automatically populate the form
4. Review and edit the information if needed
5. Click "Save Job" to add it to today's collection

## Features

### Daily Job Collection
- Save jobs throughout the day
- See how many jobs you've saved today
- Jobs are automatically cleared after daily export

### Scheduled Exports
- Set your preferred daily export time (default: 5 PM)
- Automatic Excel file generation at the scheduled time
- Files saved to `jobs/YYYY-MM-DD_jobs.xlsx`

### Manual Export
- Export jobs immediately using "Export Now" button
- Right-click context menu: "Export Jobs Now"

### Quick Save
- Right-click on any job page
- Select "Save Job for Daily Export"
- No need to open the popup

## File Structure
```
saveToSheets/
├── manifest.json              # Extension configuration
├── popup.html                 # Extension popup interface
├── popup.js                   # Popup functionality
├── content.js                 # Job data extraction
├── background-scheduler.js    # Background processing & scheduling
├── README.md                  # Detailed documentation
└── INSTALL.md                 # This file
```

## Troubleshooting

### Extension Not Working
1. Make sure the extension is enabled in `chrome://extensions/`
2. Check the browser console for error messages
3. Ensure you're on a supported job site

### Data Not Extracting
1. Job sites may change their HTML structure
2. Try manually entering the information
3. Check if the site is supported in `content.js`

### Export Issues
1. Ensure downloads are enabled in Chrome
2. Check if your browser blocks popups
3. Try using the context menu instead

## Supported Job Sites
- LinkedIn Jobs
- Indeed
- Glassdoor
- Monster
- ZipRecruiter
- Generic job sites (basic extraction)

## Data Collected
- Job application site link (URL)
- Date/time when saved
- Company name
- Job description
- Full textual content from the entire page

## Privacy
- All data is stored locally in your browser
- No data is sent to external servers
- Excel files are saved to your local machine
- Data is automatically cleared after daily export

## Need Help?
1. Check the troubleshooting section above
2. Review the browser console for error messages
3. Ensure all files are present in the extension folder 