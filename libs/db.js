/**
 * IndexedDB Wrapper for Job Info Saver
 * Handles all database interactions for job storage.
 */

class JobDatabase {
  constructor() {
    this.dbName = 'JobInfoSaverDB';
    this.storeName = 'jobs';
    this.version = 1;
    this.db = null;
  }

  async open() {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          // Use savedAt as the key path as it's unique per save action
          const store = db.createObjectStore(this.storeName, { keyPath: 'savedAt' });
          // Create indexes for common search fields
          store.createIndex('company', 'company', { unique: false });
          store.createIndex('jobTitle', 'jobTitle', { unique: false });
          store.createIndex('savedAt', 'savedAt', { unique: true });
        }
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        resolve(this.db);
      };

      request.onerror = (event) => {
        console.error('IndexedDB error:', event.target.error);
        reject(event.target.error);
      };
    });
  }

  async addJob(jobData) {
    await this.open();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      
      // Ensure savedAt exists and is unique
      if (!jobData.savedAt) {
        jobData.savedAt = new Date().toISOString();
      }

      const request = store.add(jobData);

      request.onsuccess = () => resolve(jobData);
      request.onerror = (e) => reject(e.target.error);
    });
  }

  async getAllJobs() {
    await this.open();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = (e) => reject(e.target.error);
    });
  }

  async getJob(savedAt) {
    await this.open();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(savedAt);

      request.onsuccess = () => resolve(request.result);
      request.onerror = (e) => reject(e.target.error);
    });
  }

  async updateJob(jobData) {
    await this.open();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.put(jobData); // put updates if key exists

      request.onsuccess = () => resolve(jobData);
      request.onerror = (e) => reject(e.target.error);
    });
  }

  async deleteJob(savedAt) {
    await this.open();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(savedAt);

      request.onsuccess = () => resolve(true);
      request.onerror = (e) => reject(e.target.error);
    });
  }

  async clearAllJobs() {
    await this.open();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.clear();

      request.onsuccess = () => resolve(true);
      request.onerror = (e) => reject(e.target.error);
    });
  }
  
  // Bulk add for migration
  async addJobs(jobs) {
    await this.open();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      
      let completed = 0;
      let errors = 0;
      
      if (jobs.length === 0) {
        resolve({ added: 0, errors: 0 });
        return;
      }

      transaction.oncomplete = () => {
        resolve({ added: completed, errors: errors });
      };

      transaction.onerror = (e) => {
        reject(e.target.error);
      };

      jobs.forEach(job => {
        if (!job.savedAt) job.savedAt = new Date().toISOString();
        try {
          store.put(job); // Use put to avoid constraint errors on duplicates
          completed++;
        } catch (e) {
          console.error('Error adding job during bulk add:', e);
          errors++;
        }
      });
    });
  }

  async getJobsByCompany(companyName, limit = 5) {
    await this.open();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const index = store.index('company');
      const request = index.getAll(companyName);

      request.onsuccess = () => {
        let results = request.result || [];
        // Sort by savedAt descending
        results.sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));
        // Limit results
        if (limit > 0) {
          results = results.slice(0, limit);
        }
        resolve(results);
      };
      request.onerror = (e) => reject(e.target.error);
    });
  }
}

// Export a singleton instance
const db = new JobDatabase();
// For ES modules (if used) or global scope
if (typeof window !== 'undefined') {
  window.db = db;
}
// For Service Worker
if (typeof self !== 'undefined') {
  self.db = db;
}
