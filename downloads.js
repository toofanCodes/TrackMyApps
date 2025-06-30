document.addEventListener('DOMContentLoaded', async function() {
  const downloadType = document.getElementById('downloadType');
  const startDate = document.getElementById('startDate');
  const endDate = document.getElementById('endDate');
  const toLabel = document.getElementById('toLabel');
  const downloadBtn = document.getElementById('downloadBtn');
  const downloadStatus = document.getElementById('downloadStatus');
  const historyBody = document.getElementById('historyBody');
  // const exportTimeInput = document.getElementById('exportTimeInput');
  const setTimeBtn = document.getElementById('setTimeBtn');
  // const currentExportTime = document.getElementById('currentExportTime');
  const timeStatus = document.getElementById('timeStatus');

  let allJobs = [];
  let lastExportDate = null;
  let exportHistory = [];

  // --- Load jobs and history ---
  async function loadData() {
    const result = await chrome.storage.local.get(['allJobsData', 'lastExportDate', 'exportHistory', 'exportTime']);
    allJobs = result.allJobsData || [];
    lastExportDate = result.lastExportDate || null;
    exportHistory = result.exportHistory || [];
    // if (exportTimeInput && result.exportTime) exportTimeInput.value = result.exportTime;
    console.log('Loaded jobs from storage:', allJobs.length, allJobs);
    renderHistory();
    // if (currentExportTime) {
    //   if (result.exportTime) {
    //     currentExportTime.textContent = `Current: ${result.exportTime}`;
    //   } else {
    //     currentExportTime.textContent = '';
    //   }
    // }
    renderDownloadPreviewTable();
  }

  // --- Timeframe dropdown logic ---
  function updateDatePickers() {
    if (downloadType.value === 'custom') {
      startDate.style.display = '';
      endDate.style.display = '';
      toLabel.style.display = '';
    } else {
      startDate.style.display = 'none';
      endDate.style.display = 'none';
      toLabel.style.display = 'none';
    }
  }
  downloadType.addEventListener('change', updateDatePickers);
  updateDatePickers();

  // --- Filter jobs by timeframe ---
  function filterJobs() {
    const type = downloadType.value;
    let filtered = [];
    if (type === 'all') {
      filtered = allJobs;
    } else if (type === 'today') {
      const today = new Date();
      filtered = allJobs.filter(j => {
        const savedAtRaw = j.savedAt || j.addedTimestamp || '';
        if (!savedAtRaw) return false;
        const savedAt = new Date(savedAtRaw);
        if (isNaN(savedAt)) return false;
        return savedAt.toISOString().slice(0,10) === today.toISOString().slice(0,10);
      });
    } else if (type === 'sinceLastExport') {
      if (!lastExportDate) {
        filtered = allJobs;
      } else {
        const lastExport = new Date(lastExportDate);
        filtered = allJobs.filter(j => {
          const savedAtRaw = j.savedAt || j.addedTimestamp || '';
          if (!savedAtRaw) return false;
          const savedAt = new Date(savedAtRaw);
          if (isNaN(savedAt)) return false;
          return savedAt > lastExport;
        });
      }
    } else if (type === 'custom') {
      const start = startDate.value;
      const end = endDate.value;
      if (!start || !end) filtered = [];
      else {
        let fromDate = new Date(start + 'T00:00:00');
        let toDate = new Date(end + 'T23:59:59.999');
        filtered = allJobs.filter(j => {
          const savedAtRaw = j.savedAt || j.addedTimestamp || '';
          if (!savedAtRaw) return false;
          const savedAt = new Date(savedAtRaw);
          if (isNaN(savedAt)) return false;
          if (fromDate && savedAt < fromDate) return false;
          if (toDate && savedAt > toDate) return false;
          return true;
        });
      }
    } else {
      filtered = allJobs;
    }
    console.log('Filter type:', type, '| Jobs returned:', filtered.length, filtered);
    return filtered;
  }

  // --- Download CSV ---
  downloadBtn.addEventListener('click', async function() {
    const jobs = filterJobs();
    if (!jobs.length) {
      showStatus(downloadStatus, 'No jobs found for this filter.', 'error');
      return;
    }
    // Use the same field order as preview
    const headers = [
      'Company', 'Job Title', 'Category', 'Sub Category', 'Job Link', 'Job Description', 'Saved At'
    ];
    const csvRows = [headers.join(',')];
    jobs.forEach(job => {
      const rowData = [
        escapeCSVField(job.company || ''),
        escapeCSVField(job.jobTitle || ''),
        escapeCSVField(job.category || ''),
        escapeCSVField(job.subCategory || ''),
        escapeCSVField(job.jobLink || job.siteLink || ''),
        escapeCSVField(job.jobDescription || ''),
        escapeCSVField(job.savedAt ? new Date(job.savedAt).toLocaleString() : (job.addedDate || job.addedTimestamp ? new Date(job.addedDate || job.addedTimestamp).toLocaleString() : ''))
      ];
      csvRows.push(rowData.join(','));
    });
    const csvContent = csvRows.join('\n');
    const csvBase64 = btoa(unescape(encodeURIComponent(csvContent)));
    const dataUrl = 'data:text/csv;base64,' + csvBase64;
    const filename = `jobs_export_${new Date().toISOString().replace(/[:.]/g, '-')}.csv`;
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
    }, 200);
    showStatus(downloadStatus, `Downloaded ${jobs.length} jobs.`, 'success');

    // --- Update export history (merge with latest from storage) ---
    const now = new Date();
    const record = {
      date: now.toLocaleDateString(),
      time: now.toLocaleTimeString(),
      jobCount: jobs.length
    };
    let latestHistory = [];
    try {
      const result = await chrome.storage.local.get(['exportHistory']);
      latestHistory = result.exportHistory || [];
    } catch (e) { latestHistory = []; }
    latestHistory.unshift(record);
    if (latestHistory.length > 10) latestHistory = latestHistory.slice(0, 10);
    exportHistory = latestHistory;
    await chrome.storage.local.set({ exportHistory: latestHistory });
    renderHistory();
  });

  function escapeCSVField(field) {
    if (field === null || field === undefined) {
      return '""';
    }
    const escaped = String(field).replace(/"/g, '""');
    return `"${escaped}"`;
  }

  // --- Render export history ---
  function renderHistory() {
    if (!exportHistory.length) {
      historyBody.innerHTML = '<tr><td colspan="3">No export history.</td></tr>';
      return;
    }
    historyBody.innerHTML = exportHistory.map(item =>
      `<tr><td>${item.date}</td><td>${item.time}</td><td>${item.jobCount}</td></tr>`
    ).join('');
  }

  // --- Set daily export time ---
  // if (setTimeBtn) {
  //   setTimeBtn.addEventListener('click', async function() {
  //     const newTime = exportTimeInput.value;
  //     if (!newTime) {
  //       showStatus(timeStatus, 'Please select a valid time.', 'error');
  //       return;
  //     }
  //     showStatus(timeStatus, 'Setting export time...', 'loading');
  //     try {
  //       const response = await chrome.runtime.sendMessage({ action: 'setExportTime', time: newTime });
  //       if (response.success) {
  //         showStatus(timeStatus, response.message, 'success');
  //         if (currentExportTime) {
  //           currentExportTime.textContent = `Current: ${newTime}`;
  //         }
  //       } else {
  //         showStatus(timeStatus, 'Failed to set export time: ' + response.error, 'error');
  //       }
  //     } catch (error) {
  //       showStatus(timeStatus, 'Error: ' + error.message, 'error');
  //     }
  //   });
  // }

  function showStatus(el, message, type) {
    el.textContent = message;
    el.className = `status ${type}`;
    el.style.display = 'block';
    if (type === 'success') {
      setTimeout(() => {
        el.style.display = 'none';
      }, 3000);
    }
  }

  function renderDownloadPreviewTable() {
    const jobs = filterJobs();
    const tableDiv = document.getElementById('downloadPreviewTable');
    console.log('Rendering preview table with jobs:', jobs.length, jobs);
    if (!jobs.length) {
      tableDiv.innerHTML = '<div style="color:#888;font-size:13px;">No jobs found for this filter.</div>';
      return;
    }
    let html = '<table style="width:100%;font-size:11px;border-collapse:collapse;margin-top:4px;">';
    html += '<thead><tr>';
    html += '<th style="padding:4px 6px;border:1px solid #e0e3ea;background:#f6f7fb;">Company</th>';
    html += '<th style="padding:4px 6px;border:1px solid #e0e3ea;background:#f6f7fb;">Job Title</th>';
    html += '<th style="padding:4px 6px;border:1px solid #e0e3ea;background:#f6f7fb;">Category</th>';
    html += '<th style="padding:4px 6px;border:1px solid #e0e3ea;background:#f6f7fb;">Sub Category</th>';
    html += '<th style="padding:4px 6px;border:1px solid #e0e3ea;background:#f6f7fb;">Job Link</th>';
    html += '<th style="padding:4px 6px;border:1px solid #e0e3ea;background:#f6f7fb;">Job Description</th>';
    html += '<th style="padding:4px 6px;border:1px solid #e0e3ea;background:#f6f7fb;">Saved At</th>';
    html += '</tr></thead><tbody>';
    jobs.forEach(job => {
      html += '<tr>';
      html += `<td style="padding:4px 6px;border:1px solid #e0e3ea;">${job.company || ''}</td>`;
      html += `<td style="padding:4px 6px;border:1px solid #e0e3ea;">${job.jobTitle || ''}</td>`;
      html += `<td style="padding:4px 6px;border:1px solid #e0e3ea;">${job.category || ''}</td>`;
      html += `<td style="padding:4px 6px;border:1px solid #e0e3ea;">${job.subCategory || ''}</td>`;
      html += `<td style="padding:4px 6px;border:1px solid #e0e3ea;"><a href="${job.jobLink || job.siteLink || '#'}" target="_blank" style="color:#005fa3;">link</a></td>`;
      html += `<td style="padding:4px 6px;border:1px solid #e0e3ea;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${job.jobDescription ? job.jobDescription.slice(0,60) + (job.jobDescription.length>60?'...':'') : ''}</td>`;
      html += `<td style="padding:4px 6px;border:1px solid #e0e3ea;">${job.savedAt ? new Date(job.savedAt).toLocaleString() : ''}</td>`;
      html += '</tr>';
    });
    html += '</tbody></table>';
    tableDiv.innerHTML = html;
  }

  // Update preview table on filter changes
  downloadType.addEventListener('change', renderDownloadPreviewTable);
  startDate.addEventListener('change', renderDownloadPreviewTable);
  endDate.addEventListener('change', renderDownloadPreviewTable);

  // Add event listener for Refresh Preview button
  const refreshPreviewBtn = document.getElementById('refreshPreviewBtn');
  if (refreshPreviewBtn) {
    refreshPreviewBtn.addEventListener('click', renderDownloadPreviewTable);
  }

  // Collapsible Export History logic
  const exportHistoryToggle = document.getElementById('exportHistoryToggle');
  const exportHistorySection = document.getElementById('exportHistorySection');
  const exportHistoryArrow = document.getElementById('exportHistoryArrow');
  if (exportHistoryToggle && exportHistorySection && exportHistoryArrow) {
    exportHistoryToggle.addEventListener('click', async function() {
      const isOpen = exportHistorySection.style.display !== 'none';
      if (isOpen) {
        exportHistorySection.style.display = 'none';
        exportHistoryArrow.style.transform = '';
      } else {
        // Reload export history from storage when expanding
        let latestHistory = [];
        try {
          const result = await chrome.storage.local.get(['exportHistory']);
          latestHistory = result.exportHistory || [];
        } catch (e) { latestHistory = []; }
        exportHistory = latestHistory;
        renderHistory();
        exportHistorySection.style.display = '';
        exportHistoryArrow.style.transform = 'rotate(90deg)';
      }
    });
    // Hide section by default
    exportHistorySection.style.display = 'none';
    exportHistoryArrow.style.transform = '';
  }

  // --- Initial load ---
  loadData();
}); 