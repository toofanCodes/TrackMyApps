function getQueryParam(name) {
  const url = new URL(window.location.href);
  return url.searchParams.get(name);
}

function formatDate(date) {
  return date.toISOString().split('T')[0];
}

document.addEventListener('DOMContentLoaded', async function() {
  const tableContainer = document.getElementById('tableContainer');
  const searchCompany = document.getElementById('searchCompany');
  const searchTitle = document.getElementById('searchTitle');
  const searchDescription = document.getElementById('searchDescription');
  const filterCategory = document.getElementById('filterCategory');
  const filterSubCategory = document.getElementById('filterSubCategory');
  const resetBtn = document.getElementById('resetBtn');
  const searchForm = document.getElementById('searchForm');
  const dateFrom = document.getElementById('dateFrom');
  const dateTo = document.getElementById('dateTo');
  const applyDateFilter = document.getElementById('applyDateFilter');
  const clearMemoryBtn = document.getElementById('clearMemoryBtn');

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

  // Load jobs from storage
  async function loadJobsData() {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        const result = await chrome.storage.local.get(['allJobsData']);
        allJobs = result.allJobsData || [];
        console.log(`Loaded ${allJobs.length} jobs from chrome.storage.local`);
      } else {
        const storedData = localStorage.getItem('allJobsData');
        if (storedData) {
          allJobs = JSON.parse(storedData);
          console.log(`Loaded ${allJobs.length} jobs from localStorage`);
        } else {
          allJobs = [];
          console.log('No data found');
        }
      }
    } catch (error) {
      console.error('Error loading jobs data:', error);
      allJobs = [];
    }
    console.log('Loaded jobs from storage:', allJobs.length, allJobs);
  }

  await loadJobsData();

  function populateDropdowns(jobs) {
    const categories = Array.from(new Set(jobs.map(j => j.category).filter(Boolean)));
    const subCategories = Array.from(new Set(jobs.map(j => j.subCategory).filter(Boolean)));
    
    if (filterCategory) {
      filterCategory.innerHTML = '<option value="">All Categories</option>' + categories.map(c => `<option value="${c}">${c}</option>`).join('');
    }
    
    if (filterSubCategory) {
      filterSubCategory.innerHTML = '<option value="">All Subcategories</option>' + subCategories.map(s => `<option value="${s}">${s}</option>`).join('');
    }
  }

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
    if (filterSubCategory.value) {
      jobs = jobs.filter(j => j.subCategory === filterSubCategory.value);
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
    // Always sort by Applied Time (savedAt/addedTimestamp) descending
    return jobs.sort((a, b) => {
      const aVal = new Date(a.savedAt || a.addedTimestamp || 0);
      const bVal = new Date(b.savedAt || b.addedTimestamp || 0);
      return bVal - aVal;
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
    tableContainer.innerHTML = '';
    if (!jobs.length) {
      tableContainer.innerHTML = '<div style="text-align:center;padding:40px;color:#6c757d;font-size:16px;">No jobs found for this filter.</div>';
      return;
    }
    
    let html = '<div class="table-scroll-container">';
    html += '<table class="jobs-table"><thead><tr>' +
      '<th>#</th>' +
      '<th class="sortable-th" data-sort="company">Company</th>' +
      '<th class="sortable-th" data-sort="jobTitle">Job Title</th>' +
      '<th class="sortable-th" data-sort="category">Category</th>' +
      '<th class="sortable-th" data-sort="subCategory">Sub Category</th>' +
      '<th>Job Link</th>' +
      '<th>Job Description</th>' +
      '<th>Applied Time</th>' +
      '</tr></thead><tbody>';
    jobs.forEach((job, idx) => {
      const desc = job.jobDescription || '';
      const cleanLink = cleanLinkedInJobLink(job.jobLink || '');
      html += `<tr data-job-idx="${idx}">` +
        `<td>${idx + 1}</td>` +
        `<td>${job.company || ''}</td>` +
        `<td>${job.jobTitle || ''}</td>` +
        `<td>${job.category || ''}</td>` +
        `<td>${job.subCategory || ''}</td>` +
        `<td><a class='link' href="${cleanLink}" target="_blank">Link</a></td>` +
        `<td class='truncate' data-full-desc="${desc.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\"/g, '&quot;').replace(/'/g, '&#39;')}">${desc.length > 0 ? (desc.slice(0, 150) + (desc.length > 150 ? '...' : '')) : '<span style=\'color:#bbb\'>(No description)</span>'}</td>` +
        `<td>${job.savedAt ? new Date(job.savedAt).toLocaleString() : (job.addedDate || job.addedTimestamp ? new Date(job.addedDate || job.addedTimestamp).toLocaleString() : '')}</td>` +
        `</tr>`;
    });
    html += '</tbody></table></div>';
    tableContainer.innerHTML = html;

    // Add click listeners to sortable headers
    const ths = tableContainer.querySelectorAll('.sortable-th');
    ths.forEach(th => {
      th.addEventListener('click', function() {
        const column = th.getAttribute('data-sort');
        if (column) window.handleSort(column);
      });
    });

    // Advanced tooltip logic for job description
    setupAdvancedTooltip();

    // Add row click listeners for job detail panel
    setupJobDetailPanel(jobs);
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
  window.handleSort = function(column) {
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
  searchForm.addEventListener('submit', function(e) {
    e.preventDefault();
    updateAll(false);
  });
  resetBtn.addEventListener('click', function() {
    searchCompany.value = '';
    searchTitle.value = '';
    searchDescription.value = '';
    filterCategory.value = '';
    filterSubCategory.value = '';
    dateFrom.value = '';
    dateTo.value = '';
    updateAll(false);
  });
  searchCompany.addEventListener('input', () => updateAll(false));
  searchTitle.addEventListener('input', () => updateAll(false));
  searchDescription.addEventListener('input', () => updateAll(false));
  filterCategory.addEventListener('change', () => updateAll(false));
  filterSubCategory.addEventListener('change', () => updateAll(false));
  applyDateFilter.addEventListener('click', () => updateAll(true));

  // Initial render
  updateAll(false);

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
      cell.addEventListener('mouseenter', function(e) {
        const fullDesc = cell.getAttribute('data-full-desc') || '';
        if (fullDesc) {
          showTooltip(fullDesc, e.clientX, e.clientY);
        }
      });
      cell.addEventListener('mousemove', function(e) {
        const fullDesc = cell.getAttribute('data-full-desc') || '';
        if (fullDesc) {
          showTooltip(fullDesc, e.clientX, e.clientY);
        }
      });
      cell.addEventListener('mouseleave', function() {
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
      row.addEventListener('click', function(e) {
        if (isEditMode) return; // Prevent changing job while editing
        if (e.target.classList.contains('copy-link-btn')) return;
        const idx = parseInt(row.getAttribute('data-job-idx'), 10);
        if (!isNaN(idx) && jobs[idx]) {
          showJobDetail(jobs[idx], idx);
        }
      });
    });

    // Button logic
    document.getElementById('editJobBtn').onclick = function(e) {
      e.stopPropagation();
      if (currentDetailJobIdx !== null) enterEditMode();
    };
    document.getElementById('saveJobBtn').onclick = function(e) {
      e.stopPropagation();
      if (currentDetailJobIdx !== null) saveJobEdits();
    };
    document.getElementById('cancelEditBtn').onclick = function(e) {
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
    document.getElementById('detailCategory').textContent = job.category || '—';
    document.getElementById('detailSubCategory').textContent = job.subCategory || '—';
    // Job link as clickable with copy icon
    const linkSpan = document.getElementById('detailJobLink');
    const cleanLink = cleanLinkedInJobLink(job.jobLink || '');
    if (cleanLink) {
      linkSpan.innerHTML = `<button class='copy-link-btn' style ="height: 5px;" title='Copy link' data-link="${cleanLink}">📋</button> <a href="${cleanLink}" target="_blank" style="word-break:break-all;">${cleanLink}</a> <span class='copy-success' style='display:none;'>Copied!</span>`;
      const copyBtn = linkSpan.querySelector('.copy-link-btn');
      const copySuccess = linkSpan.querySelector('.copy-success');
      if (copyBtn && copyBtn.dataset.link) {
        copyBtn.onclick = function(ev) {
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

  function enterEditMode() {
    isEditMode = true;
    const job = originalJobData;
    // Replace spans with inputs
    document.getElementById('detailCompany').innerHTML = `<input id='editCompany' type='text' value="${job.company || ''}" style='width:90%;'/>`;
    document.getElementById('detailJobTitle').innerHTML = `<input id='editJobTitle' type='text' value="${job.jobTitle || ''}" style='width:90%;'/>`;
    document.getElementById('detailCategory').innerHTML = `<input id='editCategory' type='text' value="${job.category || ''}" style='width:90%;'/>`;
    document.getElementById('detailSubCategory').innerHTML = `<input id='editSubCategory' type='text' value="${job.subCategory || ''}" style='width:90%;'/>`;
    document.getElementById('detailJobLink').innerHTML = `<input id='editJobLink' type='text' value="${job.jobLink || ''}" style='width:90%;'/>`;
    document.getElementById('detailJobDescription').innerHTML = `<textarea id='editJobDescription' style='width:98%;height:120px;'>${job.jobDescription || ''}</textarea>`;
    document.getElementById('editJobBtn').style.display = 'none';
    document.getElementById('saveJobBtn').style.display = '';
    document.getElementById('cancelEditBtn').style.display = '';
    document.getElementById('deleteJobBtn').style.display = '';
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
    const jobIdx = allJobs.findIndex(j => (j.savedAt || j.addedTimestamp) === currentDetailJobId);
    if (jobIdx === -1) return; // not found, abort
    const job = allJobs[jobIdx];
    job.company = document.getElementById('editCompany').value;
    job.jobTitle = document.getElementById('editJobTitle').value;
    job.category = document.getElementById('editCategory').value;
    job.subCategory = document.getElementById('editSubCategory').value;
    job.jobLink = document.getElementById('editJobLink').value;
    job.jobDescription = document.getElementById('editJobDescription').value;
    // Save to storage
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      await chrome.storage.local.set({ allJobsData: allJobs });
    } else {
      localStorage.setItem('allJobsData', JSON.stringify(allJobs));
    }
    isEditMode = false;
    renderJobDetailView(job);
    document.getElementById('editJobBtn').style.display = '';
    document.getElementById('saveJobBtn').style.display = 'none';
    document.getElementById('cancelEditBtn').style.display = 'none';
    document.getElementById('deleteJobBtn').style.display = 'none';
    // Refresh table
    updateAll(false);
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
        plugins: {
          legend: { display: true, labels: { font: { size: 11 } } },
          tooltip: { enabled: true },
          totalLabels: true
        },
        scales: {
          x: {
            stacked: true,
            ticks: {
              font: { size: 11 },
              callback: function(value, idx, values) {
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
  document.getElementById('kpiPrevBtn').addEventListener('click', function() {
    kpiStartIdx = Math.min(kpiStartIdx + 1, Math.max(0, allJobs.length));
    renderKPIChart();
  });
  document.getElementById('kpiNextBtn').addEventListener('click', function() {
    kpiStartIdx = Math.max(kpiStartIdx - 1, 0);
    renderKPIChart();
  });

  // Render KPI chart after jobs are loaded
  renderKPIChart();

  if (clearMemoryBtn) {
    clearMemoryBtn.addEventListener('click', async function() {
      const confirmation = prompt('Are you sure you want to clear all saved jobs?\nType "delete" to confirm.');
      if (confirmation && confirmation.trim().toLowerCase() === 'delete') {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          await chrome.storage.local.remove('allJobsData');
        } else {
          localStorage.removeItem('allJobsData');
        }
        alert('All jobs have been cleared.');
        location.reload();
      } else {
        alert('Clear memory cancelled.');
      }
    });
  }

  document.getElementById('deleteJobBtn').onclick = async function(e) {
    e.stopPropagation();
    if (!isEditMode) return;
    if (!confirm('Are you sure you want to delete this job? This cannot be undone.')) return;
    const jobIdx = allJobs.findIndex(j => (j.savedAt || j.addedTimestamp) === currentDetailJobId);
    if (jobIdx === -1) return;
    allJobs.splice(jobIdx, 1);
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      await chrome.storage.local.set({ allJobsData: allJobs });
    } else {
      localStorage.setItem('allJobsData', JSON.stringify(allJobs));
    }
    isEditMode = false;
    updateAll(false);
    // Clear detail panel
    document.getElementById('detailCompany').textContent = '—';
    document.getElementById('detailJobTitle').textContent = '—';
    document.getElementById('detailCategory').textContent = '—';
    document.getElementById('detailSubCategory').textContent = '—';
    document.getElementById('detailJobLink').textContent = '—';
    document.getElementById('detailJobDescription').textContent = '—';
    document.getElementById('detailSavedAt').textContent = '—';
    document.getElementById('editJobBtn').style.display = '';
    document.getElementById('saveJobBtn').style.display = 'none';
    document.getElementById('cancelEditBtn').style.display = 'none';
    document.getElementById('deleteJobBtn').style.display = 'none';
  };
}); 