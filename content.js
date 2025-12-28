// Content script to extract job information from web pages
console.log('Job Info Saver content script loaded');

// Ensure the script is ready to receive messages
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  console.log('Content script received message:', request);

  if (request.action === 'extractJobInfo') {
    try {
      const jobData = extractJobInformation();
      console.log('Extracted job data:', jobData);
      sendResponse({ success: true, data: jobData });
    } catch (error) {
      console.error('Error extracting job info:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  // Always return true to indicate we will send a response asynchronously
  return true;
});

function extractJobInformation() {
  const url = window.location.href;
  const domain = window.location.hostname;

  let jobData = {
    company: '',
    jobTitle: '',
    jobLink: url,
    jobDescription: ''
  };

  // LinkedIn job extraction
  if (domain.includes('linkedin.com')) {
    jobData = extractFromLinkedIn();
  }
  // Generic extraction for other sites
  else {
    jobData = extractFromGeneric();
  }

  // Always ensure all fields are present
  jobData.company = jobData.company || '';
  jobData.jobTitle = jobData.jobTitle || '';
  jobData.jobLink = jobData.jobLink || url;
  jobData.jobDescription = jobData.jobDescription || getFullPageContent();

  return jobData;
}

function getFullPageContent() {
  try {
    // Get the main content area, excluding navigation, ads, etc.
    let content = '';

    // Try to find the main job content area
    const mainSelectors = [
      'main',
      '[role="main"]',
      '.main-content',
      '.job-content',
      '.content',
      '#content',
      'article',
      '.posting',
      'body'
    ];

    let mainElement = null;
    for (const selector of mainSelectors) {
      mainElement = document.querySelector(selector);
      if (mainElement) break;
    }

    if (mainElement) {
      // Clone the element to avoid modifying the original
      const clone = mainElement.cloneNode(true);

      // Remove unwanted elements
      const unwantedSelectors = [
        'nav', '.nav', '.navigation',
        'header', '.header',
        'footer', '.footer',
        '.ads', '.advertisement', '[class*="ad"]',
        '.sidebar', '.side-bar',
        '.comments', '.comment',
        '.social', '.share',
        'script', 'style',
        '.hidden', '[style*="display: none"]'
      ];

      unwantedSelectors.forEach(selector => {
        const elements = clone.querySelectorAll(selector);
        elements.forEach(el => el.remove());
      });

      content = clone.textContent || clone.innerText;
    } else {
      // Fallback: get all text content from body
      content = document.body.textContent || document.body.innerText;
    }

    // Clean up the content
    content = content
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .replace(/\n+/g, '\n') // Replace multiple newlines with single newline
      .trim();

    // Limit content length to avoid extremely large files
    if (content.length > 50000) {
      content = content.substring(0, 50000) + '... [Content truncated]';
    }

    return content;
  } catch (error) {
    console.error('Error extracting full page content:', error);
    return 'Error extracting page content';
  }
}

function extractFromLinkedIn() {
  // LinkedIn job detail page selectors
  const company = document.querySelector('.job-details-jobs-unified-top-card__company-name a')?.innerText.trim() || '';
  const jobTitle = document.querySelector('.job-details-jobs-unified-top-card__job-title')?.innerText.trim() || '';
  const jobLinkElem = document.querySelector('.job-details-jobs-unified-top-card__job-title a');
  const jobLink = jobLinkElem ? 'https://www.linkedin.com' + jobLinkElem.getAttribute('href') : window.location.href;
  const jobDescription = document.querySelector('article.jobs-description__container')?.innerText.trim() || getFullPageContent();
  return { company, jobTitle, jobLink, jobDescription };
}

function extractFromGeneric() {
  // Try to extract company and job title from common selectors
  const company = document.querySelector('.company, .company-name, [itemprop="hiringOrganization"]')?.innerText?.trim() || '';
  const jobTitle = document.querySelector('h1, .job-title, [itemprop="title"]')?.innerText?.trim() || '';
  const jobLink = window.location.href;
  const jobDescription = getFullPageContent();
  return { company, jobTitle, jobLink, jobDescription };
}

function extractText(selectors) {
  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element) {
      let text = element.textContent || element.innerText;
      text = text.trim();
      if (text) {
        return text;
      }
    }
  }
  return '';
}

function cleanJobData(data) {
  const cleaned = {};

  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'string') {
      // Remove extra whitespace and normalize
      cleaned[key] = value.replace(/\s+/g, ' ').trim();
    } else {
      cleaned[key] = value;
    }
  }

  return cleaned;
}

document.addEventListener('DOMContentLoaded', function () {
  if (typeof observer !== 'undefined' && document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
  }
});