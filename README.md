# Job Info Saver Chrome Extension

A Chrome extension that extracts job information from various job websites and saves it to CSV files or Google Sheets.

## Features

- **Automatic Job Data Extraction**: Extracts job information from popular job sites like LinkedIn, Indeed, Glassdoor, Monster, and ZipRecruiter
- **Manual Data Entry**: Allows manual entry of job information
- **CSV Export**: Saves job data to CSV files for easy import into Excel or Google Sheets
- **Modern UI**: Beautiful, responsive popup interface

## Extracted Information

The extension extracts the following information from job pages:
- Job Title
- Company Name
- Location
- Job Description
- Salary (if available)
- Site Link (URL of the job posting)
- Date & Time (when the job was saved)

## Installation

### Method 1: Load as Unpacked Extension (Recommended for Development)

1. Download or clone this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" in the top right corner
4. Click "Load unpacked" and select the folder containing the extension files
5. The extension should now appear in your extensions list

### Method 2: Install from Chrome Web Store (Future)

Once published, you can install directly from the Chrome Web Store.

## Usage

### Basic Usage

1. Navigate to a job posting page (LinkedIn, Indeed, Glassdoor, etc.)
2. Click the extension icon in your Chrome toolbar
3. Click "Extract from Page" to automatically populate the form
4. Review and edit the extracted information if needed
5. Click "Save Job" to save the job locally

### Download Filters (Date Range)

When exporting jobs from the Downloads page, you can filter jobs by timeframe using the dropdown:

- **All Jobs**: Shows all saved jobs.
- **Today**: Only jobs saved on the current day are shown. The extension compares the job's saved date to today's date using robust Date object logic.
- **Since Last Export**: Only jobs saved after your last export are shown. The extension compares each job's saved date to the last export date using Date objects for accuracy. If no last export date is found, all jobs are shown.
- **Custom Range**: Only jobs saved between the selected start and end dates are shown. The extension uses Date objects to ensure jobs are correctly filtered within the range.

**Note:** The date filtering logic is robust and uses JavaScript Date objects for all comparisons, ensuring accurate results regardless of date string format.

### Alternative Methods

#### Context Menu
- Right-click on any job page
- Select "Save Job to CSV" from the context menu
- The job information will be automatically extracted and saved

#### Manual Entry
- Click the extension icon
- Manually fill in the job information
- Click "Save Job" to save locally

## Supported Job Sites

The extension is optimized for the following job sites:
- **LinkedIn Jobs**: Full support for job title, company, location, and description
- **Indeed**: Comprehensive extraction of all job details
- **Glassdoor**: Complete job information extraction
- **Monster**: Job data extraction with fallback selectors
- **ZipRecruiter**: Job information extraction
- **Generic Sites**: Works with most job sites using common selectors

## File Structure

```
saveToSheets/
├── manifest.json          # Extension manifest
├── popup.html            # Extension popup interface
├── popup.js              # Popup functionality
├── content.js            # Content script for data extraction
├── background-simple.js  # Background script (local storage)
├── icons/                # Extension icons
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── libs/                 # Local libraries (e.g., Chart.js)
│   └── chart.umd.min.js
├── README.md             # This file
```

## Customization

### Adding New Job Sites

To add support for a new job site, edit `content.js` and add a new extraction function:

```javascript
function extractFromNewSite() {
  const data = {};
  
  data.jobTitle = extractText([
    '.job-title-selector',
    'h1[class*="title"]',
    'h1'
  ]);
  
  // Add more selectors for other fields...
  
  return data;
}
```

Then add the site to the main extraction function:

```javascript
if (domain.includes('newsite.com')) {
  jobData = extractFromNewSite();
}
```

### Modifying Extracted Fields

To change which fields are extracted, modify the `jobData` object in `content.js` and update the CSV headers in `background-simple.js`.

## Troubleshooting

### Extension Not Working
1. Make sure the extension is enabled in `chrome://extensions/`
2. Check the browser console for error messages
3. Ensure you're on a supported job site

### Data Not Extracting
1. Job sites may change their HTML structure
2. Try manually entering the information
3. Check if the site is supported in `content.js`

### CSV Download Issues
1. Ensure downloads are enabled in Chrome
2. Check if your browser blocks popups
3. Try using the context menu instead

## Privacy

- The extension only extracts data from job pages you visit
- No data is sent to external servers
- All data is stored locally in your browser
- CSV files are saved to your local machine

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

If you encounter any issues or have questions:
1. Check the troubleshooting section above
2. Review the browser console for error messages
3. Create an issue on the GitHub repository

## Future Enhancements

- [ ] Google Sheets API integration
- [ ] Support for more job sites
- [ ] Bulk export functionality
- [ ] Data analytics and insights
- [ ] Job application tracking
- [ ] Email notifications
- [ ] Mobile app companion 