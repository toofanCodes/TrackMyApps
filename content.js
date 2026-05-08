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
  // LinkedIn has three main page formats:
  // 1. /jobs/search - Two-pane search results view
  // 2. /jobs/collections - Two-pane collections view (Similar Jobs, Saved, etc.)
  // 3. /jobs/view/ - Standalone single job page

  const url = window.location.href;

  if (url.includes('/jobs/view/')) {
    console.log('LinkedIn: Detected standalone job view page');
    return extractFromLinkedInJobView();
  } else {
    // Both /jobs/search and /jobs/collections use the two-pane layout
    console.log('LinkedIn: Detected two-pane layout (search/collections)');
    return extractFromLinkedInTwoPane();
  }
}

// ============================================================
// TWO-PANE LAYOUT: /jobs/search and /jobs/collections
// These pages have a job list on the left and job details on the right
// ============================================================
function extractFromLinkedInTwoPane() {
  let company, jobTitle, jobLinkElem, jobDescription;

  // Primary approach: Scope search to the details container on the right pane
  // This avoids picking up elements from the sidebar list (like "Similar Jobs" header or other companies)
  const detailsContainer = document.querySelector('.jobs-details__main-content') ||
    document.querySelector('.scaffold-layout__detail') ||
    document.querySelector('.job-view-layout');

  if (detailsContainer) {
    // Company name - look for company link within the top card
    company = detailsContainer.querySelector('.job-details-jobs-unified-top-card__company-name a')?.innerText.trim() ||
      detailsContainer.querySelector('.jobs-unified-top-card__company-name a')?.innerText.trim() ||
      detailsContainer.querySelector('.topcard__org-name-link')?.innerText.trim();

    // If still no company, find the first company link but ONLY within top card area
    if (!company) {
      const topCard = detailsContainer.querySelector('.job-details-jobs-unified-top-card__container') ||
        detailsContainer.querySelector('.jobs-unified-top-card') ||
        detailsContainer.querySelector('[class*="top-card"]');
      if (topCard) {
        company = topCard.querySelector('a[href*="/company/"]')?.innerText.trim();
      }
    }

    // Job title - from the top card, NOT from the page header
    jobTitle = detailsContainer.querySelector('.job-details-jobs-unified-top-card__job-title')?.innerText.trim() ||
      detailsContainer.querySelector('.jobs-unified-top-card__job-title')?.innerText.trim() ||
      detailsContainer.querySelector('.topcard__title')?.innerText.trim();

    // If still no title, look for h1 BUT only within the details container
    if (!jobTitle) {
      const h1 = detailsContainer.querySelector('h1');
      // Validate it's not a page header like "Similar Jobs"
      const text = h1?.innerText.trim();
      if (text && !text.toLowerCase().includes('similar') && !text.toLowerCase().includes('jobs you')) {
        jobTitle = text;
      }
    }

    // Job link element for extracting the canonical URL
    jobLinkElem = detailsContainer.querySelector('.job-details-jobs-unified-top-card__job-title a') ||
      detailsContainer.querySelector('.jobs-unified-top-card__job-title a');

    // Job description
    jobDescription = detailsContainer.querySelector('#job-details')?.innerText.trim() ||
      detailsContainer.querySelector('.jobs-description__container')?.innerText.trim() ||
      detailsContainer.querySelector('.jobs-description')?.innerText.trim() ||
      detailsContainer.querySelector('article.jobs-description__container')?.innerText.trim();
  }

  // Fallback: Try global selectors if container approach failed
  if (!company) {
    company = document.querySelector('.job-details-jobs-unified-top-card__company-name a')?.innerText.trim() ||
      document.querySelector('.jobs-unified-top-card__company-name a')?.innerText.trim();
  }

  if (!jobTitle) {
    jobTitle = document.querySelector('.job-details-jobs-unified-top-card__job-title')?.innerText.trim() ||
      document.querySelector('.jobs-unified-top-card__job-title')?.innerText.trim();
  }

  if (!jobLinkElem) {
    jobLinkElem = document.querySelector('.job-details-jobs-unified-top-card__job-title a');
  }

  if (!jobDescription) {
    jobDescription = document.querySelector('#job-details')?.innerText.trim() ||
      document.querySelector('article.jobs-description__container')?.innerText.trim();
  }

  // Last resort: Extract from page title (format: "Job Title | Company | LinkedIn")
  if (!jobTitle || !company) {
    const pageTitle = document.title;
    if (pageTitle && pageTitle.includes('|')) {
      const parts = pageTitle.split('|').map(p => p.trim());
      if (parts.length >= 2 && parts[parts.length - 1] === 'LinkedIn') {
        if (!jobTitle) jobTitle = parts[0];
        if (!company && parts.length >= 3) company = parts[1];
      }
    }
  }

  // Build canonical job link
  let jobLink = window.location.href;
  if (jobLinkElem) {
    const href = jobLinkElem.getAttribute('href');
    if (href) {
      jobLink = href.startsWith('http') ? href : 'https://www.linkedin.com' + href;
    }
  }

  // Fallback for description
  if (!jobDescription) {
    jobDescription = getFullPageContent();
  }

  return {
    company: company || '',
    jobTitle: jobTitle || '',
    jobLink,
    jobDescription: jobDescription || ''
  };
}

// ============================================================
// STANDALONE JOB VIEW: /jobs/view/
// These are direct links to individual job postings
// Often have obfuscated/dynamic class names
// ============================================================
function extractFromLinkedInJobView() {
  let company, jobTitle, jobDescription;

  // Company: Look for company link
  const companyLink = document.querySelector('main a[href*="/company/"]') ||
    document.querySelector('a[href*="/company/"]');
  company = companyLink?.innerText.trim();

  // Alternative company selectors for obfuscated pages
  if (!company) {
    company = document.querySelector('.jobs-unified-top-card__company-name a')?.innerText.trim() ||
      document.querySelector('.topcard__org-name-link')?.innerText.trim() ||
      document.querySelector('[data-tracking-control-name*="company"]')?.innerText.trim();
  }

  // Job title: Primary h1 within main content
  const h1 = document.querySelector('main h1') || document.querySelector('h1.t-24') || document.querySelector('h1');
  jobTitle = h1?.innerText.trim();

  // Alternative title selectors
  if (!jobTitle) {
    jobTitle = document.querySelector('.jobs-unified-top-card__job-title')?.innerText.trim() ||
      document.querySelector('.topcard__title')?.innerText.trim() ||
      document.querySelector('.t-24.t-bold')?.innerText.trim();
  }

  // Job description: Look for "About the job" section first
  const aboutHeader = [...document.querySelectorAll('h2, h3, div, span')].find(
    el => el.innerText.trim() === 'About the job'
  );

  if (aboutHeader) {
    let container = aboutHeader.closest('section') || aboutHeader.parentElement?.parentElement;
    if (container) {
      jobDescription = container.innerText.trim();
    }
  }

  // Fallback description selectors
  if (!jobDescription) {
    jobDescription = document.querySelector('#job-details')?.innerText.trim() ||
      document.querySelector('.jobs-description')?.innerText.trim() ||
      document.querySelector('.jobs-description__container')?.innerText.trim() ||
      document.querySelector('[class*="description"]')?.innerText.trim();
  }

  // Extract from page title as last resort
  if (!jobTitle || !company) {
    const pageTitle = document.title;
    if (pageTitle && pageTitle.includes('|')) {
      const parts = pageTitle.split('|').map(p => p.trim());
      if (parts.length >= 2 && parts[parts.length - 1] === 'LinkedIn') {
        if (!jobTitle) jobTitle = parts[0];
        if (!company && parts.length >= 3) company = parts[1];
      }
    }
  }

  // Find job title from DOM structure near company link
  if (!jobTitle && company && companyLink) {
    let parent = companyLink.closest('div');
    if (parent && parent.parentElement) {
      const siblings = [...parent.parentElement.children];
      for (const sibling of siblings) {
        const text = sibling.innerText?.trim();
        if (text && text !== company &&
          !text.includes(company) &&
          !text.includes('·') &&
          !text.includes('ago') &&
          text.length > 3 && text.length < 100) {
          jobTitle = text;
          break;
        }
      }
    }
  }

  // Final fallback for description
  if (!jobDescription) {
    jobDescription = getFullPageContent();
  }

  // Job link is the current URL for standalone pages
  const jobLink = window.location.href;

  return {
    company: company || '',
    jobTitle: jobTitle || '',
    jobLink,
    jobDescription: jobDescription || ''
  };
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
