document.addEventListener('DOMContentLoaded', function () {
  const saveJobBtn = document.getElementById('saveJobBtn');
  const previewBtn = document.getElementById('previewBtn');
  const downloadsBtn = document.getElementById('downloadsBtn');
  const statusDiv = document.getElementById('status');

  // Category elements
  const categoryDropdown = document.getElementById('categoryDropdown');
  const addCategoryInput = document.getElementById('addCategoryInput');
  const addCategoryBtn = document.getElementById('addCategoryBtn');
  const sponsorshipDropdown = document.getElementById('sponsorshipDropdown');
  const addSponsorshipInput = document.getElementById('addSponsorshipInput');
  const addSponsorshipBtn = document.getElementById('addSponsorshipBtn');

  // Load initial data
  loadInitialData();

  // --- CATEGORY LOGIC ---
  function getCategories() {
    return JSON.parse(localStorage.getItem('jobCategories') || '["Not Defined"]');
  }
  function setCategories(cats) {
    localStorage.setItem('jobCategories', JSON.stringify(cats));
  }
  function getSponsorships() {
    return JSON.parse(localStorage.getItem('jobSponsorships') || '["Yes", "No", "Unknown"]');
  }
  function setSponsorships(sponsorships) {
    localStorage.setItem('jobSponsorships', JSON.stringify(sponsorships));
  }
  function populateDropdown(dropdown, items) {
    dropdown.innerHTML = '';
    items.forEach(item => {
      const opt = document.createElement('option');
      opt.value = item;
      opt.textContent = item;
      dropdown.appendChild(opt);
    });
  }
  function loadCategoryDropdowns() {
    populateDropdown(categoryDropdown, getCategories());
    populateDropdown(sponsorshipDropdown, getSponsorships());
    // Restore last used selections from chrome.storage
    chrome.storage.local.get(['lastCategory', 'lastSponsorship'], (result) => {
      if (result.lastCategory && getCategories().includes(result.lastCategory)) {
        categoryDropdown.value = result.lastCategory;
      }
      if (result.lastSponsorship && getSponsorships().includes(result.lastSponsorship)) {
        sponsorshipDropdown.value = result.lastSponsorship;
      }
    });
  }
  addCategoryBtn.addEventListener('click', function () {
    const val = addCategoryInput.value.trim();
    if (val) {
      const cats = getCategories();
      if (!cats.includes(val)) {
        cats.push(val);
        setCategories(cats);
        populateDropdown(categoryDropdown, cats);
        categoryDropdown.value = val;
      }
      addCategoryInput.value = '';
    }
  });
  addSponsorshipBtn.addEventListener('click', function () {
    const val = addSponsorshipInput.value.trim();
    if (val) {
      const sponsorships = getSponsorships();
      if (!sponsorships.includes(val)) {
        sponsorships.push(val);
        setSponsorships(sponsorships);
        populateDropdown(sponsorshipDropdown, sponsorships);
        sponsorshipDropdown.value = val;
      }
      addSponsorshipInput.value = '';
    }
  });

  // Save last used category to chrome.storage
  categoryDropdown.addEventListener('change', function () {
    chrome.storage.local.set({ lastCategory: categoryDropdown.value });
  });
  sponsorshipDropdown.addEventListener('change', function () {
    chrome.storage.local.set({ lastSponsorship: sponsorshipDropdown.value });
  });

  // --- SAVE JOB LOGIC ---
  saveJobBtn.addEventListener('click', async function () {
    showStatus('Extracting and saving job...', 'loading');
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js']
        });
      } catch (e) { }
      const response = await chrome.tabs.sendMessage(tab.id, { action: 'extractJobInfo' });
      if (response && response.success) {
        const jobData = response.data;
        // Add category, sponsorship, and date/time
        jobData.category = categoryDropdown.value || 'Not Defined';
        jobData.sponsorship = sponsorshipDropdown.value || 'Unknown';
        jobData.savedAt = new Date().toISOString();
        // Always save to IndexedDB via background
        const saveResp = await chrome.runtime.sendMessage({ action: 'saveJob', data: jobData });
        if (saveResp && saveResp.success) {
          showStatus('Job saved!', 'success');
        } else {
          showStatus('Failed to save job: ' + (saveResp?.error || 'Unknown error'), 'error');
        }
      } else {
        showStatus('Could not extract job info. Try refreshing the page.', 'error');
      }
    } catch (error) {
      showStatus('Error: ' + error.message, 'error');
    }
  });

  // --- PREVIEW BUTTON ---
  previewBtn.addEventListener('click', function () {
    chrome.tabs.create({ url: 'preview.html' });
  });

  // --- DOWNLOADS BUTTON ---
  downloadsBtn.addEventListener('click', function () {
    chrome.tabs.create({ url: 'downloads.html' });
  });

  async function loadInitialData() {
    loadCategoryDropdowns();
  }

  function showStatus(message, type) {
    statusDiv.textContent = message;
    statusDiv.className = `status ${type}`;
    statusDiv.style.display = 'block';
    if (type === 'success') {
      setTimeout(() => {
        statusDiv.style.display = 'none';
      }, 3000);
    }
  }

  // --- HISTORY LOGIC ---
  async function loadJobHistory() {
    const historyList = document.getElementById('historyList');
    const historyLoading = document.getElementById('historyLoading');

    if (!historyList) return;

    historyLoading.style.display = 'block';
    historyList.innerHTML = '';

    try {
      // Get current tab to find company name
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) return;

      // Try to extract company name via content script
      // We use a timeout to avoid hanging if content script isn't ready
      // We also catch connection errors (e.g. on restricted pages) and return null
      const response = await Promise.race([
        chrome.tabs.sendMessage(tab.id, { action: 'extractJobInfo' }).catch(() => null),
        new Promise(resolve => setTimeout(() => resolve(null), 1000))
      ]);

      if (response && response.success && response.data && response.data.company) {
        const companyName = response.data.company;

        // Update Sponsorship Link
        const sponsorshipLink = document.getElementById('sponsorshipLink');
        if (sponsorshipLink) {
          sponsorshipLink.href = `https://h1bdata.info/index.php?em=${encodeURIComponent(companyName)}&job=&city=&year=2025`;
          sponsorshipLink.style.display = 'block';
        }

        // Query background for history
        let historyResp = null;
        try {
          historyResp = await chrome.runtime.sendMessage({
            action: 'getJobHistory',
            companyName: companyName
          });
        } catch (err) {
          console.warn('Background connection failed:', err);
        }

        if (historyResp && historyResp.success && historyResp.jobs && historyResp.jobs.length > 0) {
          renderHistory(historyResp.jobs, companyName);
        } else {
          historyList.innerHTML = `<div style="padding:8px;color:#6c757d;font-style:italic;">No previous jobs found for <b>${companyName}</b></div>`;
        }
      } else {
        // No company found or not on a job page
        historyList.innerHTML = '<div style="padding:8px;color:#6c757d;font-style:italic;">Navigate to a job page to see history.</div>';
      }
    } catch (error) {
      console.error('Error loading history:', error);
      historyList.innerHTML = '<div style="padding:8px;color:#6c757d;">Could not load history.</div>';
    } finally {
      historyLoading.style.display = 'none';
    }
  }

  function renderHistory(jobs, companyName) {
    const historyList = document.getElementById('historyList');
    let html = `<div style="padding:8px 0;border-bottom:1px solid #eee;margin-bottom:8px;font-weight:600;color:#005fa3;">History: ${companyName}</div>`;
    html += '<div style="max-height:150px;overflow-y:auto;">';

    jobs.forEach(job => {
      const date = new Date(job.savedAt).toLocaleDateString();
      const status = job.status || 'Applied';
      let statusColor = '#666';
      if (status.includes('Applied')) statusColor = '#0056b3';
      else if (status.includes('Interview')) statusColor = '#e67e22';
      else if (status.includes('Reject')) statusColor = '#c0392b';
      else if (status.includes('Offer')) statusColor = '#27ae60';

      const jobLink = job.jobLink || '#';
      const target = job.jobLink ? '_blank' : '_self';

      html += `
        <div style="padding:6px 0;border-bottom:1px solid #f8f9fa;font-size:11px;">
          <div style="font-weight:500;margin-bottom:2px;">
            <a href="${jobLink}" target="${target}" style="color:#005fa3;text-decoration:none;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${job.jobTitle}</a>
          </div>
          <div style="display:flex;justify-content:space-between;color:#666;">
            <span>${date}</span>
            <span style="color:${statusColor};font-weight:500;">${status}</span>
          </div>
        </div>
      `;
    });

    html += '</div>';
    historyList.innerHTML = html;
  }

  // Load history when popup opens
  loadJobHistory();
}); 