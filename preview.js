function getQueryParam(name) {
  const url = new URL(window.location.href);
  return url.searchParams.get(name);
}

function formatDate(date) {
  return date.toISOString().split('T')[0];
}

// ========================================
// PERFORMANCE UTILITIES
// ========================================
// Debounce function to limit how often a function can fire
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}
// ========================================

// ========================================
// CONFIGURATION: Status Options
// ========================================
// Default status options - can be extended via UI
// Custom statuses are saved in localStorage and merged with these defaults
// ========================================
const DEFAULT_STATUS_OPTIONS = [
  'Applied',
  'Assessment Received',
  'Assessment Failed',
  'Interview',
  'Interview Rejected',
  'Rejected',
  'Offer',
];

// Load custom statuses from localStorage
function getStatusOptions() {
  const customStatuses = JSON.parse(localStorage.getItem('customStatuses') || '[]');
  return Array.from(new Set([...DEFAULT_STATUS_OPTIONS, ...customStatuses]));
}

// Save custom status to localStorage
function addCustomStatus(status) {
  const customStatuses = JSON.parse(localStorage.getItem('customStatuses') || '[]');
  if (!customStatuses.includes(status) && !DEFAULT_STATUS_OPTIONS.includes(status)) {
    customStatuses.push(status);
    localStorage.setItem('customStatuses', JSON.stringify(customStatuses));
  }
}

// Remove custom status from localStorage
function removeCustomStatus(status) {
  let customStatuses = JSON.parse(localStorage.getItem('customStatuses') || '[]');
  customStatuses = customStatuses.filter(s => s !== status);
  localStorage.setItem('customStatuses', JSON.stringify(customStatuses));
}

// Get current status options (defaults + custom)
let STATUS_OPTIONS = getStatusOptions();
// ========================================


document.addEventListener('DOMContentLoaded', async function () {
  const tableContainer = document.getElementById('tableContainer');
  const searchCompany = document.getElementById('searchCompany');
  const searchTitle = document.getElementById('searchTitle');
  const searchDescription = document.getElementById('searchDescription');
  const filterCategory = document.getElementById('filterCategory');
  const filterSponsorship = document.getElementById('filterSponsorship');
  const filterStatus = document.getElementById('filterStatus'); // New Filter
  const resetBtn = document.getElementById('resetBtn');
  const searchForm = document.getElementById('searchForm');
  const dateFrom = document.getElementById('dateFrom');
  const dateTo = document.getElementById('dateTo');
  const applyDateFilter = document.getElementById('applyDateFilter');
  // const clearMemoryBtn = document.getElementById('clearMemoryBtn'); // Moved to downloads.html
  // const refreshDataBtn = document.getElementById('refreshDataBtn'); // Add refresh button (commented out - relic from past)

  let allJobs = [];
  let filteredJobs = [];
  let sortColumn = '';
  let sortDirection = 'asc';
  let kpiChart = null;
  let kpiStartIdx = 0; // For scrolling through weeks
  let currentDetailJobIdx = null;
  let isEditMode = false;
  let originalJobData = null;
  let currentDetailJobId = null; // Track unique job identifier

  // Pagination State
  let currentPage = 1;
  let itemsPerPage = 50;

  // Job Map for O(1) lookups (rebuilt when allJobs changes)
  let jobMap = new Map();
  function rebuildJobMap() {
    jobMap.clear();
    allJobs.forEach(job => {
      const id = job.savedAt || job.addedTimestamp;
      if (id) jobMap.set(id, job);
    });
  }

  // Bulk Edit State
  let selectedJobIds = new Set(); // Set of savedAt timestamps
  const bulkEditBar = document.getElementById('bulkEditBar');
  const bulkCount = document.getElementById('bulkCount');
  const bulkCategory = document.getElementById('bulkCategory');
  const bulkSponsorship = document.getElementById('bulkSponsorship');
  const bulkStatus = document.getElementById('bulkStatus'); // New Bulk Field
  const bulkAppliedTime = document.getElementById('bulkAppliedTime');
  const bulkUpdateBtn = document.getElementById('bulkUpdateBtn');
  const bulkCancelBtn = document.getElementById('bulkCancelBtn');

  // Load jobs from IndexedDB
  async function loadJobsData() {
    try {
      if (typeof db !== 'undefined') {
        allJobs = await db.getAllJobs();
        console.log(`Loaded ${allJobs.length} jobs from IndexedDB`);
      } else {
        console.error('DB library not loaded');
        allJobs = [];
      }
    } catch (error) {
      console.error('Error loading jobs data:', error);
      allJobs = [];
    }
    console.log('Loaded jobs:', allJobs.length);
  }

  await loadJobsData();
  rebuildJobMap(); // Build initial lookup map

  // Auto-focus on Company search input for immediate typing
  searchCompany.focus();

  function populateDropdowns(jobs) {
    const categories = Array.from(new Set(jobs.map(j => j.category).filter(Boolean)));
    const sponsorships = Array.from(new Set(jobs.map(j => j.sponsorship).filter(Boolean)));
    // Combine predefined STATUS_OPTIONS with any custom statuses from existing data
    const dataStatuses = jobs.map(j => j.status).filter(Boolean);
    const allStatuses = Array.from(new Set([...STATUS_OPTIONS, ...dataStatuses]));

    if (filterCategory) {
      filterCategory.innerHTML = '<option value="">All Categories</option>' + categories.map(c => `<option value="${c}">${c}</option>`).join('');
    }

    if (filterSponsorship) {
      filterSponsorship.innerHTML = '<option value="">All Sponsorships</option>' + sponsorships.map(s => `<option value="${s}">${s}</option>`).join('');
    }

    if (filterStatus) {
      filterStatus.innerHTML = '<option value="">All Statuses</option>' + allStatuses.map(s => `<option value="${s}">${s}</option>`).join('');
    }

    // Populate Bulk Edit Dropdowns
    if (bulkCategory) {
      bulkCategory.innerHTML = '<option value="">Change Category...</option>' + categories.map(c => `<option value="${c}">${c}</option>`).join('');
    }
    if (bulkSponsorship) {
      bulkSponsorship.innerHTML = '<option value="">Change Sponsorship...</option>' + sponsorships.map(s => `<option value="${s}">${s}</option>`).join('');
    }
    if (bulkStatus) {
      bulkStatus.innerHTML = '<option value="">Change Status...</option>' + allStatuses.map(s => `<option value="${s}">${s}</option>`).join('');
    }
  }

  // ... (rest of the file) ...

  function enterEditMode() {
    isEditMode = true;
    const job = originalJobData;
    // Replace spans with inputs
    document.getElementById('detailCompany').innerHTML = `<input id='editCompany' type='text' value="${job.company || ''}" style='width:90%;'/>`;
    document.getElementById('detailJobTitle').innerHTML = `<input id='editJobTitle' type='text' value="${job.jobTitle || ''}" style='width:90%;'/>`;
    // Category dropdown
    const categories = Array.from(new Set(allJobs.map(j => j.category).filter(Boolean)));
    let catOptions = categories.map(c => `<option value="${c}">${c}</option>`).join('');
    document.getElementById('detailCategoryWrapper').innerHTML = `<select id='editCategory' style='width:94%;'>
      <option value="">Not Defined</option>${catOptions}
    </select>`;
    document.getElementById('editCategory').value = job.category || '';
    // Sponsorship dropdown
    const sponsorships = Array.from(new Set(allJobs.map(j => j.sponsorship).filter(Boolean)));
    let sponsorshipOptions = sponsorships.map(s => `<option value="${s}">${s}</option>`).join('');
    document.getElementById('detailSponsorshipWrapper').innerHTML = `<select id='editSponsorship' style='width:94%;'>
      <option value="">Unknown</option>${sponsorshipOptions}
    </select>`;
    document.getElementById('editSponsorship').value = job.sponsorship || '';
    // Status dropdown - uses STATUS_OPTIONS from configuration
    let statusOptions = STATUS_OPTIONS.map(s => `<option value="${s}">${s}</option>`).join('');
    document.getElementById('detailStatusWrapper').innerHTML = `<select id='editStatus' style='width:94%;'>
      ${statusOptions}
    </select>`;
    document.getElementById('editStatus').value = job.status || 'Applied';
    document.getElementById('detailJobLink').innerHTML = `<input id='editJobLink' type='text' value="${job.jobLink || ''}" style='width:90%;'/>`;
    document.getElementById('detailJobDescription').innerHTML = `<textarea id='editJobDescription' style='width:98%;height:120px;'>${job.jobDescription || ''}</textarea>`;
    // Saved At editable field
    let savedAtValue = job.savedAt || job.addedDate || job.addedTimestamp;
    let inputDateValue = '';
    if (savedAtValue) {
      const d = new Date(savedAtValue);
      if (!isNaN(d)) {
        // Format as yyyy-MM-ddTHH:mm for datetime-local
        inputDateValue = d.toISOString().slice(0, 16);
      }
    }
    document.getElementById('detailSavedAt').innerHTML = `<input id='editSavedAt' type='datetime-local' value="${inputDateValue}" style='width:94%;'/>`;
    document.getElementById('editJobBtn').style.display = 'none';
    document.getElementById('saveJobBtn').style.display = '';
    document.getElementById('cancelEditBtn').style.display = '';
    document.getElementById('deleteJobBtn').style.display = '';
  }

  // ... (rest of the file) ...



  function filterJobs() {
    let jobs = allJobs.slice();
    if (searchCompany.value.trim()) {
      jobs = jobs.filter(j => (j.company || '').toLowerCase().includes(searchCompany.value.trim().toLowerCase()));
    }
    if (searchTitle.value.trim()) {
      jobs = jobs.filter(j => (j.jobTitle || '').toLowerCase().includes(searchTitle.value.trim().toLowerCase()));
    }
    if (searchDescription.value.trim()) {
      const keywords = searchDescription.value.toLowerCase().split(/[,;]/).map(k => k.trim()).filter(Boolean);
      jobs = jobs.filter(j => keywords.every(kw => (j.jobDescription || '').toLowerCase().includes(kw)));
    }
    if (filterCategory.value) {
      jobs = jobs.filter(j => j.category === filterCategory.value);
    }
    if (filterSponsorship.value) {
      jobs = jobs.filter(j => j.sponsorship === filterSponsorship.value);
    }
    if (filterStatus && filterStatus.value) {
      jobs = jobs.filter(j => j.status === filterStatus.value);
    }
    console.log('Jobs shown in table after filtering:', jobs.length, jobs);
    return jobs;
  }

  function applyDateRange(jobs) {
    const from = dateFrom.value;
    const to = dateTo.value;
    if (!from && !to) return jobs;
    // Parse the from and to dates as full Date objects
    let fromDate = from ? new Date(from + 'T00:00:00') : null;
    let toDate = to ? new Date(to + 'T23:59:59.999') : null;
    return jobs.filter(j => {
      const savedAtRaw = j.savedAt || j.addedTimestamp || '';
      if (!savedAtRaw) return false;
      const savedAt = new Date(savedAtRaw);
      if (fromDate && savedAt < fromDate) return false;
      if (toDate && savedAt > toDate) return false;
      return true;
    });
  }

  function sortJobs(jobs) {
    if (!sortColumn) {
      // Default: Applied Time descending
      return jobs.sort((a, b) => {
        const aVal = new Date(a.savedAt || a.addedTimestamp || 0);
        const bVal = new Date(b.savedAt || b.addedTimestamp || 0);
        return bVal - aVal;
      });
    }

    return jobs.sort((a, b) => {
      let aVal, bVal;

      if (sortColumn === 'savedAt') {
        aVal = new Date(a.savedAt || a.addedTimestamp || 0);
        bVal = new Date(b.savedAt || b.addedTimestamp || 0);
      } else {
        aVal = (a[sortColumn] || '').toString().toLowerCase();
        bVal = (b[sortColumn] || '').toString().toLowerCase();
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }

  // Utility to clean LinkedIn job links
  function cleanLinkedInJobLink(url) {
    if (typeof url !== 'string') return url;
    const match = url.match(/^(https:\/\/www\.linkedin\.com\/jobs\/view\/\d+)/);
    if (match) {
      return match[1] + '/';
    }
    return url;
  }

  function renderTable(jobs) {
    const paginationControls = document.getElementById('paginationControls');
    tableContainer.innerHTML = '';

    if (!jobs.length) {
      tableContainer.innerHTML = '<div style="text-align:center;padding:40px;color:#6c757d;font-size:16px;">No jobs found for this filter.</div>';
      if (paginationControls) paginationControls.style.display = 'none';
      return;
    }

    // Calculate pagination
    const totalPages = Math.ceil(jobs.length / itemsPerPage);
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, jobs.length);
    const paginatedJobs = jobs.slice(startIndex, endIndex);

    let html = '<div class="table-scroll-container">';
    html += '<table class="jobs-table"><thead><tr>' +
      '<th><input type="checkbox" id="selectAllCheckbox" /></th>' +
      `<th class="sortable-th" data-sort="savedAt"># ${sortColumn === 'savedAt' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}</th>` +
      `<th class="sortable-th" data-sort="company">Company ${sortColumn === 'company' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}</th>` +
      `<th class="sortable-th" data-sort="jobTitle">Job Title ${sortColumn === 'jobTitle' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}</th>` +
      `<th class="sortable-th" data-sort="category">Category ${sortColumn === 'category' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}</th>` +
      `<th class="sortable-th" data-sort="sponsorship">Sponsorship ${sortColumn === 'sponsorship' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}</th>` +
      `<th class="sortable-th" data-sort="status">Status ${sortColumn === 'status' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}</th>` +
      '<th>Job Link</th>' +
      `<th class="sortable-th" data-sort="savedAt">Applied Time ${sortColumn === 'savedAt' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}</th>` +
      '</tr></thead><tbody id="jobsTableBody">';

    paginatedJobs.forEach((job, idx) => {
      const globalIdx = startIndex + idx; // Preserve global index for job detail
      const cleanLink = cleanLinkedInJobLink(job.jobLink || '');
      const jobId = job.savedAt || job.addedTimestamp;
      const isSelected = selectedJobIds.has(jobId);

      // Status Badge
      const status = job.status || 'Applied';
      let statusClass = 'status-other';
      if (status.toLowerCase().includes('applied')) statusClass = 'status-applied';
      else if (status.toLowerCase().includes('interview')) statusClass = 'status-interview';
      else if (status.toLowerCase().includes('reject')) statusClass = 'status-rejected';
      else if (status.toLowerCase().includes('offer')) statusClass = 'status-offer';

      html += `<tr data-job-idx="${globalIdx}" data-job-id="${jobId}" class="${isSelected ? 'selected-row' : ''}">` +
        `<td><input type="checkbox" class="job-checkbox" data-job-id="${jobId}" ${isSelected ? 'checked' : ''} /></td>` +
        `<td>${globalIdx + 1}</td>` +
        `<td>${job.company || ''}</td>` +
        `<td>${job.jobTitle || ''}</td>` +
        `<td>${job.category || ''}</td>` +
        `<td>${job.sponsorship || ''}</td>` +
        `<td><span class="status-badge ${statusClass}">${status}</span></td>` +
        `<td><a class='link' href="${cleanLink}" target="_blank">Link</a></td>` +
        `<td>${job.savedAt ? new Date(job.savedAt).toLocaleString() : (job.addedDate || job.addedTimestamp ? new Date(job.addedDate || job.addedTimestamp).toLocaleString() : '')}</td>` +
        `</tr>`;
    });
    html += '</tbody></table></div>';
    tableContainer.innerHTML = html;

    // Render pagination controls
    renderPaginationControls(jobs.length, totalPages);

    // Add click listeners to sortable headers
    const ths = tableContainer.querySelectorAll('.sortable-th');
    ths.forEach(th => {
      th.addEventListener('click', function () {
        const column = th.getAttribute('data-sort');
        if (column) window.handleSort(column);
      });
    });

    // Advanced tooltip logic for job description
    setupAdvancedTooltip();

    // Setup event delegation for table body (row clicks and checkboxes)
    setupTableEventDelegation(jobs);
  }

  // Render pagination controls
  function renderPaginationControls(totalItems, totalPages) {
    const paginationControls = document.getElementById('paginationControls');
    const prevBtn = document.getElementById('prevPageBtn');
    const nextBtn = document.getElementById('nextPageBtn');
    const pageInfo = document.getElementById('pageInfo');
    const totalJobsInfo = document.getElementById('totalJobsInfo');

    if (!paginationControls) return;

    paginationControls.style.display = 'flex';
    pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
    totalJobsInfo.textContent = `(${totalItems} total jobs)`;

    prevBtn.disabled = currentPage <= 1;
    nextBtn.disabled = currentPage >= totalPages;
  }

  // Event Delegation for table body (checkboxes and row clicks)
  function setupTableEventDelegation(allFilteredJobs) {
    const tableBody = document.getElementById('jobsTableBody');
    const selectAll = document.getElementById('selectAllCheckbox');

    if (!tableBody) return;

    // Single click handler for the entire table body
    tableBody.addEventListener('click', function (e) {
      const target = e.target;
      const row = target.closest('tr');
      if (!row) return;

      const jobId = row.getAttribute('data-job-id');
      const jobIdx = parseInt(row.getAttribute('data-job-idx'), 10);

      // Handle checkbox clicks
      if (target.classList.contains('job-checkbox')) {
        e.stopPropagation();
        if (target.checked) {
          selectedJobIds.add(jobId);
        } else {
          selectedJobIds.delete(jobId);
        }
        row.classList.toggle('selected-row', target.checked);
        updateBulkEditBar();
        updateSelectAllState();
        return;
      }

      // Handle link clicks - don't trigger row selection
      if (target.tagName === 'A' || target.classList.contains('copy-link-btn')) {
        return;
      }

      // Handle row click for job detail
      if (isEditMode) return;
      if (!isNaN(jobIdx) && allFilteredJobs[jobIdx]) {
        showJobDetail(allFilteredJobs[jobIdx], jobIdx);
      }
    });

    // Select All checkbox handler
    if (selectAll) {
      // Calculate current page jobs for select all
      const startIndex = (currentPage - 1) * itemsPerPage;
      const endIndex = Math.min(startIndex + itemsPerPage, allFilteredJobs.length);
      const pageJobs = allFilteredJobs.slice(startIndex, endIndex);

      updateSelectAllState();

      selectAll.addEventListener('change', function () {
        if (this.checked) {
          pageJobs.forEach(j => selectedJobIds.add(j.savedAt || j.addedTimestamp));
        } else {
          pageJobs.forEach(j => selectedJobIds.delete(j.savedAt || j.addedTimestamp));
        }
        // Update UI without full re-render
        const checkboxes = tableBody.querySelectorAll('.job-checkbox');
        checkboxes.forEach(cb => {
          cb.checked = this.checked;
          cb.closest('tr').classList.toggle('selected-row', this.checked);
        });
        updateBulkEditBar();
      });
    }
  }

  function updateSelectAllState() {
    const selectAll = document.getElementById('selectAllCheckbox');
    const checkboxes = document.querySelectorAll('.job-checkbox');
    if (!selectAll || checkboxes.length === 0) return;

    const allChecked = Array.from(checkboxes).every(c => c.checked);
    const someChecked = Array.from(checkboxes).some(c => c.checked);
    selectAll.checked = allChecked;
    selectAll.indeterminate = someChecked && !allChecked;
  }


  function setupCheckboxListeners(jobs) {
    const selectAll = document.getElementById('selectAllCheckbox');
    const checkboxes = document.querySelectorAll('.job-checkbox');

    // Select All
    if (selectAll) {
      selectAll.checked = jobs.length > 0 && jobs.every(j => selectedJobIds.has(j.savedAt || j.addedTimestamp));
      selectAll.indeterminate = jobs.some(j => selectedJobIds.has(j.savedAt || j.addedTimestamp)) && !selectAll.checked;

      selectAll.addEventListener('change', function () {
        if (this.checked) {
          jobs.forEach(j => selectedJobIds.add(j.savedAt || j.addedTimestamp));
        } else {
          jobs.forEach(j => selectedJobIds.delete(j.savedAt || j.addedTimestamp));
        }
        updateAll(false); // Re-render to update UI
      });
    }

    // Individual Checkboxes
    checkboxes.forEach(cb => {
      cb.addEventListener('click', function (e) {
        e.stopPropagation(); // Prevent row click
        const id = this.getAttribute('data-job-id');
        if (this.checked) selectedJobIds.add(id);
        else selectedJobIds.delete(id);
        updateBulkEditBar();

        // Update Select All state visually without full re-render
        if (selectAll) {
          const allChecked = Array.from(checkboxes).every(c => c.checked);
          const someChecked = Array.from(checkboxes).some(c => c.checked);
          selectAll.checked = allChecked;
          selectAll.indeterminate = someChecked && !allChecked;
        }
      });
    });

    updateBulkEditBar();
  }

  function updateBulkEditBar() {
    const count = selectedJobIds.size;
    if (count > 0) {
      bulkEditBar.classList.remove('hidden');
      bulkCount.textContent = `${count}`; // Just the number
    } else {
      bulkEditBar.classList.add('hidden');
    }
  }

  // Bulk Edit Listeners
  if (bulkCancelBtn) {
    bulkCancelBtn.addEventListener('click', function () {
      selectedJobIds.clear();
      updateAll(false);
    });
  }

  if (bulkUpdateBtn) {
    bulkUpdateBtn.addEventListener('click', async function () {
      const category = bulkCategory.value;
      const sponsorship = bulkSponsorship.value;
      const status = bulkStatus.value;
      const appliedTime = bulkAppliedTime.value;

      if (!category && !sponsorship && !status && !appliedTime) {
        alert('Please select at least one field to update.');
        return;
      }

      if (!confirm(`Update ${selectedJobIds.size} jobs?`)) return;

      try {
        let updatedCount = 0;
        // Convert Set to Array to avoid issues if we modify IDs during iteration
        const idsToUpdate = Array.from(selectedJobIds);

        let loopIndex = 0;
        for (const id of idsToUpdate) {
          // O(1) lookup using jobMap instead of O(N) .find()
          const job = jobMap.get(id);
          if (job) {
            const oldId = job.savedAt;
            let dateChanged = false;

            if (category) job.category = category;
            if (sponsorship) job.sponsorship = sponsorship;
            if (status) job.status = status;

            if (appliedTime) {
              const baseDate = new Date(appliedTime);
              // Add seconds/ms to ensure uniqueness
              // We'll add loopIndex seconds to keep them ordered
              baseDate.setSeconds(baseDate.getSeconds() + loopIndex);
              const newDate = baseDate.toISOString();

              if (newDate !== oldId) {
                job.savedAt = newDate;
                dateChanged = true;
              }
            }

            if (typeof db !== 'undefined') {
              if (dateChanged) {
                await db.deleteJob(oldId);
                await db.addJob(job);
                // Update jobMap with new key
                jobMap.delete(oldId);
                jobMap.set(job.savedAt, job);
              } else {
                await db.updateJob(job);
              }
              updatedCount++;
            }
          }
          loopIndex++;
        }

        alert(`Successfully updated ${updatedCount} jobs.`);
        selectedJobIds.clear();

        // Reset inputs
        if (bulkCategory) bulkCategory.value = '';
        if (bulkSponsorship) bulkSponsorship.value = '';
        if (bulkStatus) bulkStatus.value = '';
        if (bulkAppliedTime) bulkAppliedTime.value = '';

        rebuildJobMap(); // Rebuild map after bulk changes
        updateAll(false);

        // Broadcast update to other tabs
        chrome.runtime.sendMessage({ action: 'jobsUpdated' }).catch(() => { });
      } catch (error) {
        console.error('Bulk update error:', error);
        alert('Error updating jobs: ' + error.message);
      }
    });
  }

  // --- Bulk Delete Logic ---
  const bulkDeleteBtn = document.getElementById('bulkDeleteBtn');
  if (bulkDeleteBtn) {
    bulkDeleteBtn.addEventListener('click', async function () {
      if (selectedJobIds.size === 0) {
        alert('No jobs selected.');
        return;
      }

      if (!confirm(`Are you sure you want to DELETE ${selectedJobIds.size} jobs? This cannot be undone.`)) {
        return;
      }

      try {
        let deletedCount = 0;
        const idsToDelete = Array.from(selectedJobIds);

        // Use jobMap for O(1) lookups
        for (const id of idsToDelete) {
          const job = jobMap.get(id);
          if (job) {
            if (typeof db !== 'undefined' && job.savedAt) {
              await db.deleteJob(job.savedAt);
            }
            // Remove from allJobs array
            const jobIndex = allJobs.indexOf(job);
            if (jobIndex !== -1) {
              allJobs.splice(jobIndex, 1);
            }
            jobMap.delete(id);
            deletedCount++;
          }
        }

        alert(`Successfully deleted ${deletedCount} jobs.`);
        selectedJobIds.clear();
        rebuildJobMap(); // Rebuild map after bulk deletion
        updateAll(false);

        // Broadcast update to other tabs
        chrome.runtime.sendMessage({ action: 'jobsUpdated' }).catch(() => { });
      } catch (error) {
        console.error('Bulk delete error:', error);
        alert('Error deleting jobs: ' + error.message);
      }
    });
  }


  function updateAll(applyDate = false) {
    filteredJobs = filterJobs();
    if (applyDate) {
      filteredJobs = applyDateRange(filteredJobs);
    }
    filteredJobs = sortJobs(filteredJobs);
    renderTable(filteredJobs);
    populateDropdowns(allJobs);
  }

  // Global sort handler function
  window.handleSort = function (column) {
    if (sortColumn === column) {
      // Toggle direction if same column
      sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      // New column, start with ascending
      sortColumn = column;
      sortDirection = 'asc';
    }
    updateAll(false);
  };

  // Event listeners
  searchForm.addEventListener('submit', function (e) {
    e.preventDefault();
    updateAll(false);
  });
  resetBtn.addEventListener('click', function () {
    searchCompany.value = '';
    searchTitle.value = '';
    searchDescription.value = '';
    filterCategory.value = '';
    filterSponsorship.value = '';
    if (filterStatus) filterStatus.value = ''; // Reset status
    dateFrom.value = '';
    dateTo.value = '';
    updateAll(false);
  });
  searchCompany.addEventListener('input', debounce(() => { currentPage = 1; updateAll(false); }, 300));
  searchTitle.addEventListener('input', debounce(() => { currentPage = 1; updateAll(false); }, 300));
  searchDescription.addEventListener('input', debounce(() => { currentPage = 1; updateAll(false); }, 300));
  filterCategory.addEventListener('change', () => { currentPage = 1; updateAll(false); });
  filterSponsorship.addEventListener('change', () => { currentPage = 1; updateAll(false); });
  if (filterStatus) filterStatus.addEventListener('change', () => { currentPage = 1; updateAll(false); }); // Status listener
  applyDateFilter.addEventListener('click', () => { currentPage = 1; updateAll(true); });
  // refreshDataBtn.addEventListener('click', async function () { // Add refresh button logic (commented out - relic from past)
  //   await loadJobsData();
  //   updateAll(false);
  // });

  // Pagination event listeners
  const prevPageBtn = document.getElementById('prevPageBtn');
  const nextPageBtn = document.getElementById('nextPageBtn');
  const itemsPerPageSelect = document.getElementById('itemsPerPageSelect');

  if (prevPageBtn) {
    prevPageBtn.addEventListener('click', () => {
      if (currentPage > 1) {
        currentPage--;
        updateAll(false);
      }
    });
  }

  if (nextPageBtn) {
    nextPageBtn.addEventListener('click', () => {
      const totalPages = Math.ceil(filteredJobs.length / itemsPerPage);
      if (currentPage < totalPages) {
        currentPage++;
        updateAll(false);
      }
    });
  }

  if (itemsPerPageSelect) {
    itemsPerPageSelect.addEventListener('change', (e) => {
      itemsPerPage = parseInt(e.target.value, 10);
      currentPage = 1; // Reset to first page
      updateAll(false);
    });
  }

  // Initial render
  updateAll(false);

  // --- Keyboard Shortcuts ---
  const keyboardShortcutsOverlay = document.getElementById('keyboardShortcutsOverlay');
  let optionKeyHoldTimeout = null;

  document.addEventListener('keydown', function (e) {
    // Debug logging to see what keys are being pressed
    console.log('Key pressed:', e.key, 'Code:', e.code, 'Alt:', e.altKey, 'Meta:', e.metaKey, 'Ctrl:', e.ctrlKey);

    // Show keyboard shortcuts overlay when Option is held (but not with other keys)
    if (e.altKey && !e.ctrlKey && !e.metaKey && e.key === 'Alt') {
      // Use a small delay to distinguish between holding and quickly pressing
      if (!optionKeyHoldTimeout) {
        optionKeyHoldTimeout = setTimeout(() => {
          if (keyboardShortcutsOverlay) {
            keyboardShortcutsOverlay.style.display = 'flex';
          }
        }, 500); // Show after 500ms of holding
      }
    }


    // ESC key: Clear selections and remove focus
    if (e.key === 'Escape' || e.code === 'Escape') {
      console.log('ESC pressed - clearing selections and focus');
      e.preventDefault();

      // Check what element currently has focus
      const activeElement = document.activeElement;
      const isInCompanyFilter = activeElement === searchCompany;

      // Remove focus from any active element
      if (activeElement) {
        activeElement.blur();
      }

      // Clear all checkbox selections
      if (selectedJobIds.size > 0) {
        selectedJobIds.clear();
        updateAll(false);
        console.log('Cleared all selections');
      }

      // Only return focus to company search if we weren't already there
      if (!isInCompanyFilter) {
        setTimeout(() => {
          searchCompany.focus();
        }, 100);
      }

      return;
    }

    // Check if Alt/Option key is pressed
    // Use e.code instead of e.key because Option key produces special characters on Mac (® for R, ç for C, etc.)
    if (e.altKey) {
      const code = e.code; // e.code gives physical key location (e.g., "KeyR", "KeyC")
      console.log('Alt key combo detected with code:', code);

      switch (code) {
        case 'KeyR':
          // Option + R: Reset filters
          console.log('Executing Reset shortcut');
          e.preventDefault();
          e.stopPropagation();
          resetBtn.click();
          break;
        case 'KeyC':
          // Option + C: Select first row checkbox
          console.log('Executing Select First Row shortcut');
          e.preventDefault();
          e.stopPropagation();
          const firstCheckbox = document.querySelector('.job-checkbox');
          if (firstCheckbox) {
            console.log('Found checkbox, clicking it');
            firstCheckbox.click();
            // Scroll to top of table
            const tableContainer = document.getElementById('tableContainer');
            if (tableContainer) {
              tableContainer.scrollTop = 0;
            }
          } else {
            console.log('No checkbox found!');
          }
          break;
        case 'KeyP':
          // Option + P: Focus on bulk edit bar (first input/select)
          console.log('Executing Bulk Edit Bar focus shortcut');
          e.preventDefault();
          e.stopPropagation();
          console.log('Bulk edit bar hidden?', bulkEditBar.classList.contains('hidden'));
          if (!bulkEditBar.classList.contains('hidden')) {
            // If bulk edit bar is visible, focus on first input
            const firstBulkInput = bulkEditBar.querySelector('select, input');
            if (firstBulkInput) {
              firstBulkInput.focus();
              console.log('Focused on bulk edit input');
            }
          } else {
            // If not visible, select first row to make it appear
            console.log('Bulk edit bar hidden, selecting first row');
            const firstCheckbox = document.querySelector('.job-checkbox');
            if (firstCheckbox && !firstCheckbox.checked) {
              firstCheckbox.click();
            }
            // Then focus on first input after a short delay
            setTimeout(() => {
              const firstBulkInput = bulkEditBar.querySelector('select, input');
              if (firstBulkInput) {
                firstBulkInput.focus();
                console.log('Focused on bulk edit input after delay');
              }
            }, 100);
          }
          break;
        default:
          console.log('No handler for Alt +', code);
      }
    }
  });

  // Hide overlay when Option key is released
  document.addEventListener('keyup', function (e) {
    if (e.key === 'Alt') {
      // Clear the timeout if key is released before 500ms
      if (optionKeyHoldTimeout) {
        clearTimeout(optionKeyHoldTimeout);
        optionKeyHoldTimeout = null;
      }
      // Hide the overlay
      if (keyboardShortcutsOverlay) {
        keyboardShortcutsOverlay.style.display = 'none';
      }
    }
  });

  // Also hide if window loses focus while Option is pressed
  window.addEventListener('blur', function () {
    if (optionKeyHoldTimeout) {
      clearTimeout(optionKeyHoldTimeout);
      optionKeyHoldTimeout = null;
    }
    if (keyboardShortcutsOverlay) {
      keyboardShortcutsOverlay.style.display = 'none';
    }
  });

  // --- Event-driven update logic ---
  chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
    if (request.action === 'jobsUpdated') {
      if (!isEditMode) {
        console.log('Received jobsUpdated event. Refreshing data...');
        await loadJobsData();
        updateAll(false);
        renderKPIChart();
      }
    }
  });

  // Advanced tooltip logic
  function setupAdvancedTooltip() {
    // Create tooltip element if not present
    let tooltip = document.getElementById('advanced-job-tooltip');
    if (!tooltip) {
      tooltip = document.createElement('div');
      tooltip.id = 'advanced-job-tooltip';
      tooltip.style.position = 'fixed';
      tooltip.style.zIndex = '9999';
      tooltip.style.background = '#222';
      tooltip.style.color = '#fff';
      tooltip.style.padding = '12px 16px';
      tooltip.style.borderRadius = '10px';
      tooltip.style.fontSize = '13px';
      tooltip.style.maxWidth = '420px';
      tooltip.style.height = '220px';
      tooltip.style.overflowY = 'auto';
      tooltip.style.boxShadow = '0 2px 12px rgba(0,0,0,0.18)';
      tooltip.style.whiteSpace = 'pre-line';
      tooltip.style.pointerEvents = 'none';
      tooltip.style.opacity = '0';
      tooltip.style.transition = 'opacity 0.15s';
      tooltip.style.display = 'block';
      document.body.appendChild(tooltip);
    }

    function showTooltip(text, x, y) {
      tooltip.innerHTML = text;
      tooltip.style.opacity = '1';
      // Position tooltip near mouse, but not off screen
      const padding = 12;
      const rect = tooltip.getBoundingClientRect();
      let left = x + 18;
      let top = y + 18;
      if (left + rect.width > window.innerWidth - padding) {
        left = window.innerWidth - rect.width - padding;
      }
      if (top + rect.height > window.innerHeight - padding) {
        top = window.innerHeight - rect.height - padding;
      }
      tooltip.style.left = left + 'px';
      tooltip.style.top = top + 'px';
    }
    function hideTooltip() {
      tooltip.style.opacity = '0';
    }

    // Remove any previous listeners
    const oldCells = document.querySelectorAll('.truncate');
    oldCells.forEach(cell => {
      cell.onmouseenter = null;
      cell.onmousemove = null;
      cell.onmouseleave = null;
    });

    // Add listeners to all .truncate cells
    const cells = document.querySelectorAll('.truncate');
    cells.forEach(cell => {
      cell.addEventListener('mouseenter', function (e) {
        const fullDesc = cell.getAttribute('data-full-desc') || '';
        if (fullDesc) {
          showTooltip(fullDesc, e.clientX, e.clientY);
        }
      });
      cell.addEventListener('mousemove', function (e) {
        const fullDesc = cell.getAttribute('data-full-desc') || '';
        if (fullDesc) {
          showTooltip(fullDesc, e.clientX, e.clientY);
        }
      });
      cell.addEventListener('mouseleave', function () {
        hideTooltip();
      });
    });
  }

  // Job detail panel logic
  function setupJobDetailPanel(jobs) {
    // Remove overlay/close logic, just update the static panel
    // Remove previous listeners
    const oldRows = document.querySelectorAll('.jobs-table tbody tr');
    oldRows.forEach(row => {
      row.onclick = null;
    });

    // Add click listeners to each row
    const rows = document.querySelectorAll('.jobs-table tbody tr');
    rows.forEach(row => {
      row.addEventListener('click', function (e) {
        if (isEditMode) return; // Prevent changing job while editing
        if (e.target.classList.contains('copy-link-btn')) return;
        if (e.target.classList.contains('job-checkbox')) return; // Ignore checkbox clicks
        const idx = parseInt(row.getAttribute('data-job-idx'), 10);
        if (!isNaN(idx) && jobs[idx]) {
          showJobDetail(jobs[idx], idx);
        }
      });
    });

    // Button logic
    document.getElementById('editJobBtn').onclick = function (e) {
      e.stopPropagation();
      if (currentDetailJobIdx !== null) enterEditMode();
    };
    document.getElementById('saveJobBtn').onclick = function (e) {
      e.stopPropagation();
      if (currentDetailJobIdx !== null) saveJobEdits();
    };
    document.getElementById('cancelEditBtn').onclick = function (e) {
      e.stopPropagation();
      if (currentDetailJobIdx !== null) exitEditMode();
    };
  }

  function showJobDetail(job, idx) {
    currentDetailJobIdx = idx;
    isEditMode = false;
    originalJobData = { ...job };
    currentDetailJobId = job.savedAt || job.addedTimestamp || null;
    renderJobDetailView(job);
    document.getElementById('editJobBtn').style.display = '';
    document.getElementById('saveJobBtn').style.display = 'none';
    document.getElementById('cancelEditBtn').style.display = 'none';
  }

  function renderJobDetailView(job) {
    document.getElementById('detailCompany').textContent = job.company || '—';
    document.getElementById('detailJobTitle').textContent = job.jobTitle || '—';
    // Category: show as text unless in edit mode
    document.getElementById('detailCategoryWrapper').innerHTML = `<span id="detailCategory">${job.category || '—'}</span>`;
    document.getElementById('detailSponsorshipWrapper').innerHTML = `<span id="detailSponsorship">${job.sponsorship || '—'}</span>`;
    document.getElementById('detailStatusWrapper').innerHTML = `<span id="detailStatus" class="status-badge ${getStatusClass(job.status)}">${job.status || 'Applied'}</span>`;
    // Job link as clickable with copy icon
    const linkSpan = document.getElementById('detailJobLink');
    const cleanLink = cleanLinkedInJobLink(job.jobLink || '');
    if (cleanLink) {
      linkSpan.innerHTML = `<button class='copy-link-btn' style ="height: 5px;" title='Copy link' data-link="${cleanLink}">📋</button> <a href="${cleanLink}" target="_blank" style="word-break:break-all;">${cleanLink}</a> <span class='copy-success' style='display:none;'>Copied!</span>`;
      const copyBtn = linkSpan.querySelector('.copy-link-btn');
      const copySuccess = linkSpan.querySelector('.copy-success');
      if (copyBtn && copyBtn.dataset.link) {
        copyBtn.onclick = function (ev) {
          ev.stopPropagation();
          navigator.clipboard.writeText(copyBtn.dataset.link).then(() => {
            if (copySuccess) {
              copySuccess.style.display = 'inline';
              setTimeout(() => { copySuccess.style.display = 'none'; }, 1200);
            }
          });
        };
      }
    } else {
      linkSpan.textContent = '—';
    }
    // Job description (preserve line breaks)
    const descSpan = document.getElementById('detailJobDescription');
    descSpan.innerHTML = job.jobDescription ? job.jobDescription.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>') : '—';
    document.getElementById('detailSavedAt').textContent = job.savedAt ? new Date(job.savedAt).toLocaleString() : (job.addedDate || job.addedTimestamp ? new Date(job.addedDate || job.addedTimestamp).toLocaleString() : '—');
  }



  function exitEditMode() {
    isEditMode = false;
    renderJobDetailView(originalJobData);
    document.getElementById('editJobBtn').style.display = '';
    document.getElementById('saveJobBtn').style.display = 'none';
    document.getElementById('cancelEditBtn').style.display = 'none';
    document.getElementById('deleteJobBtn').style.display = 'none';
  }

  async function saveJobEdits() {
    try {
      const jobIdx = allJobs.findIndex(j => (j.savedAt || j.addedTimestamp) === currentDetailJobId);
      if (jobIdx === -1) {
        console.error('Job not found for update:', currentDetailJobId);
        alert('Error: Job not found. Please refresh and try again.');
        return;
      }

      const job = allJobs[jobIdx];
      const oldId = job.savedAt; // Keep track of old ID

      // Update properties
      job.company = document.getElementById('editCompany').value;
      job.jobTitle = document.getElementById('editJobTitle').value;
      job.category = document.getElementById('editCategory').value;
      job.sponsorship = document.getElementById('editSponsorship').value;
      job.status = document.getElementById('editStatus').value;
      job.jobLink = document.getElementById('editJobLink').value;
      job.jobDescription = document.getElementById('editJobDescription').value;

      // Handle Date Change
      const savedAtInput = document.getElementById('editSavedAt');
      let newId = oldId;
      let dateChanged = false;

      if (savedAtInput && savedAtInput.value) {
        const newDate = new Date(savedAtInput.value).toISOString();
        if (newDate !== oldId) {
          job.savedAt = newDate;
          newId = newDate;
          dateChanged = true;
        }
      }

      // Save to IndexedDB
      if (typeof db !== 'undefined') {
        if (dateChanged) {
          // If key changed: delete old, add new
          await db.deleteJob(oldId);
          await db.addJob(job);
          currentDetailJobId = newId; // Update current ID tracking
        } else {
          // Standard update
          await db.updateJob(job);
        }
        console.log('Job updated successfully:', job);
      } else {
        console.error('DB not available for update');
        alert('Database error: DB not available.');
        return;
      }

      isEditMode = false;
      renderJobDetailView(job);

      document.getElementById('editJobBtn').style.display = '';
      document.getElementById('saveJobBtn').style.display = 'none';
      document.getElementById('cancelEditBtn').style.display = 'none';
      document.getElementById('deleteJobBtn').style.display = 'none';

      // Refresh table
      updateAll(false);

      // Broadcast update to other tabs
      chrome.runtime.sendMessage({ action: 'jobsUpdated' }).catch(() => { });
    } catch (error) {
      console.error('Error saving job edits:', error);
      alert('Failed to save changes: ' + error.message);
    }
  }

  function getLastNDates(n, endDate = new Date()) {
    const dates = [];
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(endDate);
      d.setDate(d.getDate() - i);
      dates.push(d);
    }
    return dates;
  }

  // Helper to get local date string in YYYY-MM-DD
  function getLocalDateString(date) {
    return date.getFullYear() + '-' +
      String(date.getMonth() + 1).padStart(2, '0') + '-' +
      String(date.getDate()).padStart(2, '0');
  }

  function getKPIData(jobs, startIdx = 0, days = 7) {
    // Get all unique categories
    const categories = Array.from(new Set(jobs.map(j => j.category || 'Not Defined')));
    // Find the latest date in the data, or use today if no data
    let endDate;
    if (jobs.length > 0) {
      const allDates = jobs
        .map(j => {
          const d = new Date(j.savedAt || j.addedTimestamp || '');
          if (isNaN(d)) return null;
          return d;
        })
        .filter(Boolean);
      endDate = new Date(Math.max(...allDates.map(d => d.getTime())));
    } else {
      endDate = new Date();
    }
    // Always get the last N days, even if no jobs exist for some days
    const dateObjs = getLastNDates(30, endDate);
    const dateList = dateObjs.map(d => getLocalDateString(d));
    const windowDates = dateList.slice(Math.max(0, dateList.length - days - startIdx), dateList.length - startIdx);
    // Build data: for each date, count jobs per category (0 if none)
    const data = windowDates.map(date => {
      const jobsOnDate = jobs.filter(j => {
        const d = new Date(j.savedAt || j.addedTimestamp || '');
        return getLocalDateString(d) === date;
      });
      console.log(`Jobs on ${date}:`, jobsOnDate.length, jobsOnDate);
      const counts = {};
      categories.forEach(cat => {
        counts[cat] = jobsOnDate.filter(j => (j.category || 'Not Defined') === cat).length;
      });
      return counts;
    });
    return { windowDates, categories, data };
  }

  function renderKPIChart() {
    const ctx = document.getElementById('kpiChart').getContext('2d');
    if (kpiChart) kpiChart.destroy();
    const { windowDates, categories, data } = getKPIData(allJobs, kpiStartIdx, 7);
    // Prepare datasets for Chart.js
    const datasets = categories.map((cat, idx) => ({
      label: cat,
      data: data.map(counts => counts[cat]),
      backgroundColor: `hsl(${(idx * 360) / categories.length}, 60%, 60%)`,
      borderWidth: 1,
      borderRadius: 2,
      barPercentage: 0.7,
      categoryPercentage: 0.8,
    }));
    kpiChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: windowDates,
        datasets: datasets,
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: {
          padding: {
            top: 15
          }
        },
        plugins: {
          legend: {
            display: true,
            position: 'top', // Move legend to top
            maxHeight: 60, // Enable scrolling if too many items
            labels: {
              usePointStyle: true, // Use small circle instead of bar
              pointStyle: 'circle',
              font: { size: 10 } // Reduce font size
            }
          },
          tooltip: { enabled: true },
          totalLabels: true
        },
        scales: {
          x: {
            stacked: true,
            ticks: {
              font: { size: 11 },
              callback: function (value, idx, values) {
                return this.getLabelForValue(value);
              },
              maxRotation: 90,
              minRotation: 90,
            },
          },
          y: {
            stacked: true,
            display: false,
          },
        },
        indexAxis: 'x',
      },
      plugins: [{
        id: 'totalLabels',
        afterDatasetsDraw(chart, args, pluginOptions) {
          if (!chart.options.plugins.totalLabels) return;
          const { ctx, chartArea, data } = chart;
          ctx.save();
          const meta = chart.getDatasetMeta(0);
          const datasets = chart.data.datasets;
          chart.data.labels.forEach((label, i) => {
            let total = 0;
            datasets.forEach(ds => {
              total += ds.data[i] || 0;
            });
            // Find the top bar's top Y position
            let y = null;
            for (let d = datasets.length - 1; d >= 0; d--) {
              const bar = chart.getDatasetMeta(d).data[i];
              if (bar) {
                y = bar.y;
                break;
              }
            }
            if (y !== null && total > 0) {
              ctx.font = 'bold 11px sans-serif';
              ctx.fillStyle = '#222';
              ctx.textAlign = 'center';
              ctx.fillText(total, meta.data[i].x, y - 6);
            }
          });
          ctx.restore();
        }
      }]
    });
  }

  // KPI navigation
  document.getElementById('kpiPrevBtn').addEventListener('click', function () {
    kpiStartIdx = Math.min(kpiStartIdx + 1, Math.max(0, allJobs.length));
    renderKPIChart();
  });
  document.getElementById('kpiNextBtn').addEventListener('click', function () {
    kpiStartIdx = Math.max(kpiStartIdx - 1, 0);
    renderKPIChart();
  });

  // Render KPI chart after jobs are loaded
  renderKPIChart();

  // Clear Memory button moved to downloads.html
  /*
  if (clearMemoryBtn) {
    clearMemoryBtn.addEventListener('click', async function () {
      const confirmation = prompt('Are you sure you want to clear all saved jobs?\nType "delete" to confirm.');
      if (confirmation && confirmation.trim().toLowerCase() === 'delete') {
        if (typeof db !== 'undefined') {
          await db.clearAllJobs();
        }
        alert('All jobs have been cleared.');
        location.reload();
      } else {
        alert('Clear memory cancelled.');
      }
    });
  }
  */

  // Delete Job Button Logic
  const deleteJobBtn = document.getElementById('deleteJobBtn');
  if (deleteJobBtn) {
    deleteJobBtn.onclick = async function (e) {
      e.stopPropagation();
      if (!isEditMode) return;
      if (!confirm('Are you sure you want to delete this job? This cannot be undone.')) return;

      const jobIdx = allJobs.findIndex(j => (j.savedAt || j.addedTimestamp) === currentDetailJobId);
      if (jobIdx === -1) return;

      // Fix: Get job first, then splice ONCE
      const jobToDelete = allJobs[jobIdx];
      allJobs.splice(jobIdx, 1);

      if (typeof db !== 'undefined') {
        await db.deleteJob(jobToDelete.savedAt);
      }
      isEditMode = false;
      updateAll(false);

      // Clear detail panel
      document.getElementById('detailCompany').textContent = '—';
      document.getElementById('detailJobTitle').textContent = '—';
      document.getElementById('detailCategoryWrapper').innerHTML = '<span id="detailCategory">—</span>';
      document.getElementById('detailSponsorshipWrapper').innerHTML = '<span id="detailSponsorship">—</span>';
      document.getElementById('detailStatusWrapper').innerHTML = '<span id="detailStatus">—</span>';
      document.getElementById('detailJobLink').innerHTML = '—';
      document.getElementById('detailJobDescription').innerHTML = '—';
      document.getElementById('detailSavedAt').textContent = '—';

      document.getElementById('editJobBtn').style.display = '';
      document.getElementById('saveJobBtn').style.display = 'none';
      document.getElementById('cancelEditBtn').style.display = 'none';
      document.getElementById('deleteJobBtn').style.display = 'none';
    };
  }

  // Helper function for status classes
  function getStatusClass(status) {
    if (!status) return 'status-other';
    const s = status.toLowerCase();
    if (s.includes('applied')) return 'status-applied';
    if (s.includes('assessment')) return 'status-interview'; // Map assessment to interview color
    if (s.includes('interview')) return 'status-interview';
    if (s.includes('reject') || s.includes('fail')) return 'status-rejected';
    if (s.includes('offer')) return 'status-offer';
    return 'status-other';
  }

  // ========================================
  // STATUS MANAGEMENT MODAL
  // ========================================
  const manageStatusesBtn = document.getElementById('manageStatusesBtn');
  const statusModal = document.getElementById('statusModal');
  const closeStatusModalBtn = document.getElementById('closeStatusModalBtn');
  const addStatusBtn = document.getElementById('addStatusBtn');
  const newStatusInput = document.getElementById('newStatusInput');
  const statusList = document.getElementById('statusList');

  // Render status list in modal
  function renderStatusList() {
    const customStatuses = JSON.parse(localStorage.getItem('customStatuses') || '[]');
    statusList.innerHTML = '';

    // Render all statuses
    STATUS_OPTIONS.forEach(status => {
      const isCustom = customStatuses.includes(status);
      const isDefault = DEFAULT_STATUS_OPTIONS.includes(status);

      const statusItem = document.createElement('div');
      statusItem.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:8px 10px;margin-bottom:6px;background:#fff;border:1px solid #e0e3ea;border-radius:6px;';

      const statusText = document.createElement('span');
      statusText.textContent = status;
      statusText.style.cssText = 'font-size:0.9rem;color:#212529;';

      const badge = document.createElement('span');
      badge.textContent = isDefault ? 'Default' : 'Custom';
      badge.style.cssText = `font-size:0.75rem;padding:2px 8px;border-radius:4px;margin-left:8px;${isDefault ? 'background:#e3f2fd;color:#1565c0;' : 'background:#fff3e0;color:#ef6c00;'}`;

      statusItem.appendChild(statusText);
      statusItem.appendChild(badge);

      // Add delete button for custom statuses only
      if (isCustom && !isDefault) {
        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = '🗑️';
        deleteBtn.style.cssText = 'background:#ff4444;color:#fff;border:none;border-radius:4px;padding:4px 8px;cursor:pointer;margin-left:8px;font-size:0.85rem;';
        deleteBtn.onclick = function () {
          if (confirm(`Remove "${status}" from custom statuses?`)) {
            removeCustomStatus(status);
            STATUS_OPTIONS = getStatusOptions();
            renderStatusList();
            populateDropdowns(allJobs);
          }
        };
        statusItem.appendChild(deleteBtn);
      }

      statusList.appendChild(statusItem);
    });
  }

  // Open modal
  manageStatusesBtn.addEventListener('click', function () {
    statusModal.style.display = 'flex';
    renderStatusList();
  });

  // Close modal
  closeStatusModalBtn.addEventListener('click', function () {
    statusModal.style.display = 'none';
    newStatusInput.value = '';
  });

  // Close modal on background click
  statusModal.addEventListener('click', function (e) {
    if (e.target === statusModal) {
      statusModal.style.display = 'none';
      newStatusInput.value = '';
    }
  });

  // Add new status
  addStatusBtn.addEventListener('click', function () {
    const newStatus = newStatusInput.value.trim();
    if (!newStatus) {
      alert('Please enter a status name.');
      return;
    }

    if (STATUS_OPTIONS.includes(newStatus)) {
      alert('This status already exists.');
      return;
    }

    addCustomStatus(newStatus);
    STATUS_OPTIONS = getStatusOptions();
    renderStatusList();
    populateDropdowns(allJobs);
    newStatusInput.value = '';
    alert(`"${newStatus}" added successfully!`);
  });

  // Add status on Enter key
  newStatusInput.addEventListener('keypress', function (e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      addStatusBtn.click();
    }
  });
  // ========================================
});