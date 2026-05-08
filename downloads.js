document.addEventListener('DOMContentLoaded', async function () {
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
    const result = await chrome.storage.local.get(['lastExportDate', 'exportHistory', 'exportTime']);

    if (typeof db !== 'undefined') {
      allJobs = await db.getAllJobs();
    } else {
      allJobs = [];
    }

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
        return savedAt.toISOString().slice(0, 10) === today.toISOString().slice(0, 10);
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

  // --- Delete Filtered Jobs ---
  const deleteFilteredBtn = document.getElementById('deleteFilteredBtn');
  deleteFilteredBtn.addEventListener('click', async function () {
    const jobsToDelete = filterJobs();
    if (!jobsToDelete.length) {
      showStatus(downloadStatus, 'No jobs found for this filter.', 'error');
      return;
    }

    // Confirm deletion
    const confirmMessage = `Are you sure you want to delete ${jobsToDelete.length} job(s)? This action cannot be undone.`;
    if (!confirm(confirmMessage)) {
      return;
    }

    showStatus(downloadStatus, `Deleting ${jobsToDelete.length} job(s)...`, 'loading');

    try {
      // Get all jobs from storage
      const result = await chrome.storage.local.get(['allJobsData']);
      let allJobsFromStorage = result.allJobsData || [];

      // Create a function to generate a unique identifier for a job
      function getJobIdentifier(job) {
        // Use combination of key fields for reliable matching
        const company = (job.company || '').trim();
        const jobTitle = (job.jobTitle || '').trim();
        const timestamp = job.savedAt || job.addedTimestamp || '';
        const jobLink = (job.jobLink || job.siteLink || '').trim();
        // Create identifier from these fields
        return `${company}|${jobTitle}|${timestamp}|${jobLink}`;
      }

      // Create a set of job identifiers to delete
      const jobsToDeleteSet = new Set();
      jobsToDelete.forEach(job => {
        jobsToDeleteSet.add(getJobIdentifier(job));
      });

      // Filter out jobs that match the ones to delete
      let remainingJobs = allJobsFromStorage.filter(job => {
        return !jobsToDeleteSet.has(getJobIdentifier(job));
      });

      // Delete jobs from DB using the auto-increment id
      if (typeof db !== 'undefined') {
        for (const job of jobsToDelete) {
          if (job.id) {
            await db.deleteJob(job.id);
          }
        }
        // Reload to get remaining
        remainingJobs = await db.getAllJobs();
      }

      // Update local state
      allJobs = remainingJobs;

      // Refresh the UI
      renderDownloadPreviewTable();
      showStatus(downloadStatus, `Successfully deleted ${jobsToDelete.length} job(s). ${remainingJobs.length} jobs remaining.`, 'success');
    } catch (error) {
      console.error('Error deleting jobs:', error);
      showStatus(downloadStatus, 'Error deleting jobs: ' + error.message, 'error');
    }
  });

  // --- Download CSV ---
  downloadBtn.addEventListener('click', async function () {
    const jobs = filterJobs();
    if (!jobs.length) {
      showStatus(downloadStatus, 'No jobs found for this filter.', 'error');
      return;
    }
    // Use the same field order as preview
    const headers = [
      'Company',
      'Job Title',
      'Category',
      'Sponsorship',
      'Status',
      'Job Link',
      'Job Description',
      'Applied Time'
    ];
    const csvRows = [headers.join(',')];
    jobs.forEach(job => {
      const rowData = [
        escapeCSVField(job.company || ''),
        escapeCSVField(job.jobTitle || ''),
        escapeCSVField(job.category || ''),
        escapeCSVField(job.sponsorship || ''),
        escapeCSVField(job.status || 'Applied'),
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
    html += '<th style="padding:4px 6px;border:1px solid #e0e3ea;background:#f6f7fb;">Sponsorship</th>';
    html += '<th style="padding:4px 6px;border:1px solid #e0e3ea;background:#f6f7fb;">Status</th>';
    html += '<th style="padding:4px 6px;border:1px solid #e0e3ea;background:#f6f7fb;">Job Link</th>';
    html += '<th style="padding:4px 6px;border:1px solid #e0e3ea;background:#f6f7fb;">Job Description</th>';
    html += '<th style="padding:4px 6px;border:1px solid #e0e3ea;background:#f6f7fb;">Saved At</th>';
    html += '</tr></thead><tbody>';
    jobs.forEach(job => {
      html += '<tr>';
      html += `<td style="padding:4px 6px;border:1px solid #e0e3ea;">${job.company || ''}</td>`;
      html += `<td style="padding:4px 6px;border:1px solid #e0e3ea;">${job.jobTitle || ''}</td>`;
      html += `<td style="padding:4px 6px;border:1px solid #e0e3ea;">${job.category || ''}</td>`;
      html += `<td style="padding:4px 6px;border:1px solid #e0e3ea;">${job.sponsorship || ''}</td>`;
      html += `<td style="padding:4px 6px;border:1px solid #e0e3ea;">${job.status || 'Applied'}</td>`;
      html += `<td style="padding:4px 6px;border:1px solid #e0e3ea;"><a href="${job.jobLink || job.siteLink || '#'}" target="_blank" style="color:#005fa3;">link</a></td>`;
      html += `<td style="padding:4px 6px;border:1px solid #e0e3ea;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${job.jobDescription ? job.jobDescription.slice(0, 60) + (job.jobDescription.length > 60 ? '...' : '') : ''}</td>`;
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
    exportHistoryToggle.addEventListener('click', async function () {
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

  // --- CSV Import Logic ---
  const csvFileInput = document.getElementById('csvFileInput');
  const importCsvBtn = document.getElementById('importCsvBtn');
  const importStatus = document.getElementById('importStatus');
  const undoImportBtn = document.getElementById('undoImportBtn');

  let lastImportedJobIds = []; // Track for undo

  if (importCsvBtn) {
    importCsvBtn.addEventListener('click', async function () {
      const file = csvFileInput.files[0];
      if (!file) {
        showStatus(importStatus, 'Please select a CSV file first.', 'error');
        return;
      }

      showStatus(importStatus, 'Reading and parsing CSV...', 'loading');

      try {
        const text = await file.text();
        const lines = text.split('\n');

        if (lines.length < 2) {
          showStatus(importStatus, 'CSV file is empty or has no data rows.', 'error');
          return;
        }

        // Detect delimiter: » or ,
        const headerLine = lines[0];
        const delimiter = headerLine.includes('»') ? '»' : ',';

        // Parse header
        const headers = headerLine.split(delimiter).map(h => h.trim().replace(/^"|"$/g, ''));
        console.log('CSV Headers:', headers);

        // Map header indices
        const colMap = {
          company: headers.findIndex(h => h.toLowerCase().includes('company')),
          jobTitle: headers.findIndex(h => h.toLowerCase().includes('job title') || h.toLowerCase().includes('jobtitle')),
          category: headers.findIndex(h => h.toLowerCase().includes('category')),
          sponsorship: headers.findIndex(h => h.toLowerCase().includes('sponsorship')),
          status: headers.findIndex(h => h.toLowerCase().includes('status')),
          jobLink: headers.findIndex(h => h.toLowerCase().includes('job link') || h.toLowerCase().includes('joblink') || h.toLowerCase().includes('link')),
          jobDescription: headers.findIndex(h => h.toLowerCase().includes('description')),
          savedAt: headers.findIndex(h => h.toLowerCase().includes('applied') || h.toLowerCase().includes('saved') || h.toLowerCase().includes('time'))
        };

        console.log('Column mapping:', colMap);

        const jobsToImport = [];
        let skippedCount = 0;
        let duplicateCount = 0;

        // Get existing savedAt keys to check for duplicates
        const existingKeys = new Set(allJobs.map(j => j.savedAt));

        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue; // Skip empty lines

          // Simple split by delimiter
          const values = line.split(delimiter).map(v => v.trim().replace(/^"|"$/g, ''));

          const company = colMap.company >= 0 ? values[colMap.company] || '' : '';
          const jobTitle = colMap.jobTitle >= 0 ? values[colMap.jobTitle] || '' : '';

          if (!company && !jobTitle) {
            skippedCount++;
            continue;
          }

          // Parse applied time to ISO
          let savedAt = '';
          if (colMap.savedAt >= 0 && values[colMap.savedAt]) {
            const parsedDate = new Date(values[colMap.savedAt]);
            if (!isNaN(parsedDate)) {
              savedAt = parsedDate.toISOString();
            } else {
              savedAt = new Date(Date.now() + i).toISOString();
            }
          } else {
            savedAt = new Date(Date.now() + i).toISOString();
          }

          // Check for duplicate
          if (existingKeys.has(savedAt)) {
            duplicateCount++;
            continue;
          }

          const job = {
            company: company,
            jobTitle: jobTitle,
            category: colMap.category >= 0 ? values[colMap.category] || '' : '',
            sponsorship: colMap.sponsorship >= 0 ? values[colMap.sponsorship] || '' : '',
            status: colMap.status >= 0 ? values[colMap.status] || 'Applied' : 'Applied',
            jobLink: colMap.jobLink >= 0 ? values[colMap.jobLink] || '' : '',
            jobDescription: colMap.jobDescription >= 0 ? values[colMap.jobDescription] || '' : '',
            savedAt: savedAt,
            addedTimestamp: savedAt,
            addedDate: new Date(savedAt).toLocaleString()
          };

          jobsToImport.push(job);
          existingKeys.add(savedAt);
        }

        if (jobsToImport.length === 0) {
          showStatus(importStatus, `No new jobs to import. ${duplicateCount} duplicates, ${skippedCount} skipped.`, 'error');
          return;
        }

        // Bulk insert to IndexedDB
        if (typeof db !== 'undefined') {
          const result = await db.addJobs(jobsToImport);
          console.log('Import result:', result);

          // Track imported job IDs (jobId UUIDs) for undo
          lastImportedJobIds = jobsToImport.map(j => j.jobId);

          // Show undo button
          if (undoImportBtn) {
            undoImportBtn.style.display = '';
          }

          // Reload data
          await loadData();

          // Broadcast update
          chrome.runtime.sendMessage({ action: 'jobsUpdated' }).catch(() => { });

          showStatus(importStatus, `Successfully imported ${result.added} jobs. ${duplicateCount} duplicates skipped, ${skippedCount} empty rows skipped.`, 'success');
        } else {
          showStatus(importStatus, 'Database not available.', 'error');
        }
      } catch (error) {
        console.error('Import error:', error);
        showStatus(importStatus, 'Error importing CSV: ' + error.message, 'error');
      }
    });
  }

  // --- Undo Import Logic ---
  if (undoImportBtn) {
    undoImportBtn.addEventListener('click', async function () {
      if (lastImportedJobIds.length === 0) {
        showStatus(importStatus, 'Nothing to undo.', 'error');
        return;
      }

      if (!confirm(`Are you sure you want to undo the last import? This will delete ${lastImportedJobIds.length} jobs.`)) {
        return;
      }

      showStatus(importStatus, `Undoing import of ${lastImportedJobIds.length} jobs...`, 'loading');

      try {
        if (typeof db !== 'undefined') {
          // Reload to get actual jobs with database IDs
          const currentJobs = await db.getAllJobs();
          const jobsToDelete = currentJobs.filter(j => lastImportedJobIds.includes(j.jobId));

          for (const job of jobsToDelete) {
            if (job.id) {
              await db.deleteJob(job.id);
            }
          }

          const deletedCount = lastImportedJobIds.length;
          lastImportedJobIds = [];

          // Hide undo button
          undoImportBtn.style.display = 'none';

          // Reload data
          await loadData();

          // Broadcast update
          chrome.runtime.sendMessage({ action: 'jobsUpdated' }).catch(() => { });

          showStatus(importStatus, `Successfully undone import. Deleted ${deletedCount} jobs.`, 'success');
        }
      } catch (error) {
        console.error('Undo error:', error);
        showStatus(importStatus, 'Error undoing import: ' + error.message, 'error');
      }
    });
  }

  // --- Clear Memory Button ---
  const clearMemoryBtn = document.getElementById('clearMemoryBtn');
  if (clearMemoryBtn) {
    clearMemoryBtn.addEventListener('click', async function () {
      const confirmation = prompt('Are you sure you want to clear all saved jobs?\nType "delete" to confirm.');
      if (confirmation && confirmation.trim().toLowerCase() === 'delete') {
        try {
          if (typeof db !== 'undefined') {
            await db.clearAllJobs();
          }
          alert('All jobs have been cleared.');
          location.reload();
        } catch (error) {
          console.error('Error clearing jobs:', error);
          alert('Error clearing jobs: ' + error.message);
        }
      } else {
        alert('Clear memory cancelled.');
      }
    });
  }

  // --- Initial load ---
  loadData();
}); 