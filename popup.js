document.addEventListener('DOMContentLoaded', function() {
  const saveJobBtn = document.getElementById('saveJobBtn');
  const previewBtn = document.getElementById('previewBtn');
  const downloadsBtn = document.getElementById('downloadsBtn');
  const statusDiv = document.getElementById('status');
  
  // Category/subcategory elements
  const categoryDropdown = document.getElementById('categoryDropdown');
  const addCategoryInput = document.getElementById('addCategoryInput');
  const addCategoryBtn = document.getElementById('addCategoryBtn');
  const subCategoryDropdown = document.getElementById('subCategoryDropdown');
  const addSubCategoryInput = document.getElementById('addSubCategoryInput');
  const addSubCategoryBtn = document.getElementById('addSubCategoryBtn');

  // Load initial data
  loadInitialData();

  // --- CATEGORY/SUBCATEGORY LOGIC ---
  function getCategories() {
    return JSON.parse(localStorage.getItem('jobCategories') || '["Not Defined"]');
  }
  function setCategories(cats) {
    localStorage.setItem('jobCategories', JSON.stringify(cats));
  }
  function getSubCategories() {
    return JSON.parse(localStorage.getItem('jobSubCategories') || '["Not Defined"]');
  }
  function setSubCategories(subs) {
    localStorage.setItem('jobSubCategories', JSON.stringify(subs));
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
    populateDropdown(subCategoryDropdown, getSubCategories());
    // Restore last used selections from chrome.storage
    chrome.storage.local.get(['lastCategory', 'lastSubCategory'], (result) => {
      if (result.lastCategory && getCategories().includes(result.lastCategory)) {
        categoryDropdown.value = result.lastCategory;
      }
      if (result.lastSubCategory && getSubCategories().includes(result.lastSubCategory)) {
        subCategoryDropdown.value = result.lastSubCategory;
      }
    });
  }
  addCategoryBtn.addEventListener('click', function() {
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
  addSubCategoryBtn.addEventListener('click', function() {
    const val = addSubCategoryInput.value.trim();
    if (val) {
      const subs = getSubCategories();
      if (!subs.includes(val)) {
        subs.push(val);
        setSubCategories(subs);
        populateDropdown(subCategoryDropdown, subs);
        subCategoryDropdown.value = val;
      }
      addSubCategoryInput.value = '';
    }
  });

  // Save last used category to chrome.storage
  categoryDropdown.addEventListener('change', function() {
    chrome.storage.local.set({ lastCategory: categoryDropdown.value });
  });
  subCategoryDropdown.addEventListener('change', function() {
    chrome.storage.local.set({ lastSubCategory: subCategoryDropdown.value });
  });

  // --- SAVE JOB LOGIC ---
  saveJobBtn.addEventListener('click', async function() {
    showStatus('Extracting and saving job...', 'loading');
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js']
        });
      } catch (e) {}
      const response = await chrome.tabs.sendMessage(tab.id, { action: 'extractJobInfo' });
      if (response && response.success) {
        const jobData = response.data;
        // Add category, subcategory, and date/time
        jobData.category = categoryDropdown.value || 'Not Defined';
        jobData.subCategory = subCategoryDropdown.value || 'Not Defined';
        jobData.savedAt = new Date().toISOString();
        // Always save to allJobsData
        const saveResp = await chrome.runtime.sendMessage({ action: 'saveToSheets', data: jobData });
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
  previewBtn.addEventListener('click', function() {
    chrome.tabs.create({ url: 'preview.html' });
  });

  // --- DOWNLOADS BUTTON ---
  downloadsBtn.addEventListener('click', function() {
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
}); 