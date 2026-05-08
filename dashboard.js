/**
 * Dashboard.js - Fresh Job Tracker Dashboard
 * 
 * SAFETY: This file only uses READ operations from the database.
 * No db.updateJob(), db.deleteJob(), or db.clearAllJobs() calls.
 */

document.addEventListener('DOMContentLoaded', async function () {

    // =========================================
    // STATE
    // =========================================
    let allJobs = [];
    let filteredJobs = [];
    let activeFilter = 'all';
    let searchQuery = '';

    // Status mapping for pipeline columns
    const STATUS_COLUMNS = {
        'Applied': 'applied',
        'Assessment Received': 'assessment',
        'Assessment': 'assessment',
        'Assessment Failed': 'rejected',
        'Interview': 'interview',
        'Interview Rejected': 'rejected',
        'Rejected': 'rejected',
        'Offer': 'offer'
    };

    // Reverse mapping: column key -> status value for updates
    const COLUMN_TO_STATUS = {
        'applied': 'Applied',
        'assessment': 'Assessment',
        'interview': 'Interview',
        'offer': 'Offer',
        'rejected': 'Rejected'
    };

    // Currently dragged job
    let draggedJob = null;

    // =========================================
    // DATA LOADING (READ-ONLY)
    // =========================================
    async function loadJobs() {
        try {
            if (typeof db !== 'undefined') {
                allJobs = await db.getAllJobs(); // READ ONLY - safe operation
                console.log(`Dashboard: Loaded ${allJobs.length} jobs`);
            } else {
                console.error('Database not available');
                allJobs = [];
            }
        } catch (error) {
            console.error('Error loading jobs:', error);
            allJobs = [];
        }
        return allJobs;
    }

    // =========================================
    // FILTERING
    // =========================================
    function filterJobs() {
        let jobs = allJobs.slice();

        // Filter by category
        if (activeFilter !== 'all') {
            jobs = jobs.filter(j => (j.category || 'Uncategorized') === activeFilter);
        }

        // Filter by search query
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            jobs = jobs.filter(j =>
                (j.company || '').toLowerCase().includes(query) ||
                (j.jobTitle || '').toLowerCase().includes(query)
            );
        }

        return jobs;
    }

    function getJobsByStatus(jobs, statusKey) {
        return jobs.filter(j => {
            const status = j.status || 'Applied';
            const mappedColumn = STATUS_COLUMNS[status] || 'applied';
            return mappedColumn === statusKey;
        });
    }

    // =========================================
    // STATISTICS
    // =========================================
    function calculateStats(jobs) {
        const now = new Date();
        const weekAgo = new Date(now);
        weekAgo.setDate(weekAgo.getDate() - 7);

        const thisWeek = jobs.filter(j => {
            const date = new Date(j.savedAt || j.addedTimestamp);
            return date >= weekAgo;
        }).length;

        const interviews = jobs.filter(j =>
            (j.status || '').toLowerCase().includes('interview')
        ).length;

        const offers = jobs.filter(j =>
            (j.status || '').toLowerCase().includes('offer')
        ).length;

        const responded = jobs.filter(j => {
            const status = (j.status || 'Applied').toLowerCase();
            return status !== 'applied';
        }).length;

        const responseRate = jobs.length > 0
            ? Math.round((responded / jobs.length) * 100)
            : 0;

        return {
            total: jobs.length,
            thisWeek,
            interviews,
            offers,
            responseRate
        };
    }

    function renderStats(stats) {
        document.getElementById('statTotal').textContent = stats.total;
        document.getElementById('statThisWeek').textContent = stats.thisWeek;
        document.getElementById('statInterview').textContent = stats.interviews;
        document.getElementById('statOffer').textContent = stats.offers;
        document.getElementById('statResponse').textContent = stats.responseRate + '%';
    }

    // =========================================
    // CATEGORY FILTERS
    // =========================================
    function getCategories(jobs) {
        const categories = new Set();
        jobs.forEach(j => {
            if (j.category) categories.add(j.category);
        });
        return Array.from(categories).sort();
    }

    function renderFilters() {
        const filterSection = document.getElementById('filterSection');
        const categories = getCategories(allJobs);

        // Keep the "All" filter, add category filters
        filterSection.innerHTML = `<div class="filter-tag ${activeFilter === 'all' ? 'active' : ''}" data-filter="all">All</div>`;

        categories.forEach(cat => {
            const tag = document.createElement('div');
            tag.className = `filter-tag ${activeFilter === cat ? 'active' : ''}`;
            tag.dataset.filter = cat;
            tag.textContent = cat;
            filterSection.appendChild(tag);
        });

        // Add click handlers
        filterSection.querySelectorAll('.filter-tag').forEach(tag => {
            tag.addEventListener('click', () => {
                activeFilter = tag.dataset.filter;
                renderFilters();
                renderPipeline();
            });
        });
    }

    // =========================================
    // PIPELINE RENDERING
    // =========================================
    function createJobCard(job) {
        const card = document.createElement('div');
        card.className = 'job-card';
        card.draggable = true;
        card.dataset.jobId = job.jobId || job.savedAt;

        const date = job.savedAt ? new Date(job.savedAt).toLocaleDateString() : '';

        card.innerHTML = `
      <div class="job-company">
        ${escapeHtml(job.company || 'Unknown Company')}
      </div>
      <div class="job-title">${escapeHtml(job.jobTitle || 'No title')}</div>
      <div class="job-meta">
        ${job.category ? `<span class="job-tag category">${escapeHtml(job.category)}</span>` : ''}
        ${job.sponsorship ? `<span class="job-tag sponsor">${escapeHtml(job.sponsorship)}</span>` : ''}
      </div>
      <div class="job-date">${date}</div>
    `;

        // Click to open modal
        card.addEventListener('click', (e) => {
            if (!e.defaultPrevented) showJobModal(job);
        });

        // Drag events
        card.addEventListener('dragstart', (e) => {
            draggedJob = job;
            card.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
        });

        card.addEventListener('dragend', () => {
            card.classList.remove('dragging');
            draggedJob = null;
            document.querySelectorAll('.column-cards.drag-over').forEach(col => col.classList.remove('drag-over'));
        });

        return card;
    }

    function createColumn(title, statusKey, jobs) {
        const columnJobs = getJobsByStatus(jobs, statusKey);

        const column = document.createElement('div');
        column.className = `pipeline-column column-${statusKey}`;
        column.dataset.statusKey = statusKey;

        column.innerHTML = `
      <div class="column-header">
        <div class="column-title">
          <div class="column-dot"></div>
          ${title}
        </div>
        <div class="column-count">${columnJobs.length}</div>
      </div>
      <div class="column-cards"></div>
    `;

        const cardsContainer = column.querySelector('.column-cards');

        // Drop zone event handlers
        cardsContainer.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            cardsContainer.classList.add('drag-over');
        });

        cardsContainer.addEventListener('dragleave', (e) => {
            if (!cardsContainer.contains(e.relatedTarget)) {
                cardsContainer.classList.remove('drag-over');
            }
        });

        cardsContainer.addEventListener('drop', async (e) => {
            e.preventDefault();
            cardsContainer.classList.remove('drag-over');

            if (draggedJob) {
                const newStatus = COLUMN_TO_STATUS[statusKey];
                const currentStatus = draggedJob.status || 'Applied';

                if (STATUS_COLUMNS[currentStatus] !== statusKey) {
                    await updateJobStatus(draggedJob, newStatus);
                }
            }
        });

        if (columnJobs.length === 0) {
            cardsContainer.innerHTML = '<div class="empty-column">No applications</div>';
        } else {
            columnJobs.sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));
            columnJobs.forEach(job => {
                cardsContainer.appendChild(createJobCard(job));
            });
        }

        return column;
    }

    function renderPipeline() {
        const container = document.getElementById('pipelineContainer');
        const jobs = filterJobs();
        filteredJobs = jobs;

        container.innerHTML = '';

        // Create columns
        const columns = [
            { title: 'Applied', key: 'applied' },
            { title: 'Assessment', key: 'assessment' },
            { title: 'Interview', key: 'interview' },
            { title: 'Offer', key: 'offer' },
            { title: 'Rejected', key: 'rejected' }
        ];

        columns.forEach(col => {
            container.appendChild(createColumn(col.title, col.key, jobs));
        });

        // Update stats based on filtered jobs
        renderStats(calculateStats(jobs));
    }

    // =========================================
    // STATUS UPDATE (Drag and Drop)
    // =========================================
    async function updateJobStatus(job, newStatus) {
        try {
            job.status = newStatus;

            if (typeof db !== 'undefined') {
                await db.updateJob(job);
                console.log(`Dashboard: Updated "${job.company}" to "${newStatus}"`);

                // Update local array
                const idx = allJobs.findIndex(j => j.jobId === job.jobId);
                if (idx !== -1) allJobs[idx].status = newStatus;

                renderPipeline();

                // Notify other views
                chrome.runtime.sendMessage({ action: 'jobsUpdated' }).catch(() => { });
            }
        } catch (error) {
            console.error('Error updating job status:', error);
            alert('Failed to update status: ' + error.message);
        }
    }

    // =========================================
    // MODAL
    // =========================================
    function showJobModal(job) {
        const modal = document.getElementById('jobModal');

        document.getElementById('modalCompany').textContent = job.company || 'Unknown';
        document.getElementById('modalTitle').textContent = job.jobTitle || 'No title';
        document.getElementById('modalStatus').textContent = job.status || 'Applied';
        document.getElementById('modalCategory').textContent = job.category || '—';
        document.getElementById('modalSponsorship').textContent = job.sponsorship || '—';
        document.getElementById('modalDate').textContent = job.savedAt
            ? new Date(job.savedAt).toLocaleDateString('en-US', {
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
            })
            : '—';

        const linkEl = document.getElementById('modalLink');
        if (job.jobLink) {
            linkEl.innerHTML = `<a href="${escapeHtml(job.jobLink)}" target="_blank">${escapeHtml(job.jobLink)}</a>`;
        } else {
            linkEl.textContent = '—';
        }

        document.getElementById('modalDescription').textContent = job.jobDescription || 'No description available';

        modal.classList.add('active');
    }

    function hideJobModal() {
        document.getElementById('jobModal').classList.remove('active');
    }

    // =========================================
    // UTILITIES
    // =========================================
    function escapeHtml(str) {
        if (!str) return '';
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function debounce(func, wait) {
        let timeout;
        return function (...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func(...args), wait);
        };
    }

    // =========================================
    // EVENT LISTENERS
    // =========================================

    // Search
    const searchInput = document.getElementById('searchInput');
    searchInput.addEventListener('input', debounce(() => {
        searchQuery = searchInput.value;
        renderPipeline();
    }, 300));

    // Modal close
    document.getElementById('modalClose').addEventListener('click', hideJobModal);
    document.getElementById('jobModal').addEventListener('click', (e) => {
        if (e.target.id === 'jobModal') hideJobModal();
    });

    // Escape key closes modal
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') hideJobModal();
    });

    // =========================================
    // INITIALIZATION
    // =========================================
    async function init() {
        await loadJobs();
        document.getElementById('loadingState').style.display = 'none';
        renderFilters();
        renderPipeline();
    }

    init();
});
