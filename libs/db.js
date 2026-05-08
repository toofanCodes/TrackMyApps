/**
 * IndexedDB Wrapper for Job Info Saver
 * Handles all database interactions for job storage.
 */

class JobDatabase {
  constructor() {
    this.dbName = 'JobInfoSaverDB';
    this.storeName = 'jobs';
    this.version = 3; // Bumped to 3 for jobId (UUID) migration
    this.db = null;
  }

  async open() {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        const oldVersion = event.oldVersion;
        const transaction = event.target.transaction;

        console.log(`Upgrading database from version ${oldVersion} to ${this.version}`);

        // Version 1 -> 2 migration: Change from savedAt key to auto-increment id
        if (oldVersion < 2) {
          // If old store exists, migrate data
          if (db.objectStoreNames.contains(this.storeName)) {
            // Read all existing data before deleting the store
            const oldStore = transaction.objectStore(this.storeName);
            const getAllRequest = oldStore.getAll();

            getAllRequest.onsuccess = () => {
              const existingJobs = getAllRequest.result || [];
              console.log(`Migrating ${existingJobs.length} jobs to new schema`);

              // Delete old store
              db.deleteObjectStore(this.storeName);

              // Create new store with auto-increment id
              const newStore = db.createObjectStore(this.storeName, { keyPath: 'id', autoIncrement: true });
              newStore.createIndex('company', 'company', { unique: false });
              newStore.createIndex('jobTitle', 'jobTitle', { unique: false });
              newStore.createIndex('savedAt', 'savedAt', { unique: false });
              newStore.createIndex('jobLink', 'jobLink', { unique: false });

              // Re-add all jobs to the new store (with jobId since we're going to v3)
              existingJobs.forEach(job => {
                delete job.id; // Ensure no stale id
                if (!job.jobId) {
                  job.jobId = crypto.randomUUID();
                }
                newStore.add(job);
              });

              console.log('Migration complete');
            };

            getAllRequest.onerror = (e) => {
              console.error('Error reading old data for migration:', e);
            };
          } else {
            // Fresh install - create new store with auto-increment id
            const store = db.createObjectStore(this.storeName, { keyPath: 'id', autoIncrement: true });
            store.createIndex('company', 'company', { unique: false });
            store.createIndex('jobTitle', 'jobTitle', { unique: false });
            store.createIndex('savedAt', 'savedAt', { unique: false });
            store.createIndex('jobLink', 'jobLink', { unique: false });
          }
        }

        // Version 2 -> 3 migration: Add jobId (UUID) to all existing jobs
        if (oldVersion >= 2 && oldVersion < 3) {
          const store = transaction.objectStore(this.storeName);
          const getAllRequest = store.getAll();

          getAllRequest.onsuccess = () => {
            const existingJobs = getAllRequest.result || [];
            console.log(`Adding jobId to ${existingJobs.length} existing jobs`);

            let migrated = 0;
            existingJobs.forEach(job => {
              if (!job.jobId) {
                job.jobId = crypto.randomUUID();
                store.put(job);
                migrated++;
              }
            });

            console.log(`Migration v2→v3 complete: ${migrated} jobs updated with jobId`);
          };

          getAllRequest.onerror = (e) => {
            console.error('Error reading jobs for v3 migration:', e);
          };
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

      // Ensure savedAt exists
      if (!jobData.savedAt) {
        jobData.savedAt = new Date().toISOString();
      }

      // Ensure jobId exists (UUID for unique identification)
      if (!jobData.jobId) {
        jobData.jobId = crypto.randomUUID();
      }

      // Remove id if present to let auto-increment work
      const jobCopy = { ...jobData };
      delete jobCopy.id;

      const request = store.add(jobCopy);

      request.onsuccess = (e) => {
        // Return job with the new auto-generated id
        jobCopy.id = e.target.result;
        resolve(jobCopy);
      };
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

  async getJob(id) {
    await this.open();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(id);

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

  async deleteJob(id) {
    await this.open();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(id);

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
        if (!job.jobId) job.jobId = crypto.randomUUID(); // Ensure UUID for all jobs
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
    if (!companyName) return [];
    try {
      const allJobs = await this.getAllJobs();
      const target = companyName.toLowerCase().trim();
      
      let results = allJobs.filter(j => {
        if (!j.company) return false;
        const c = j.company.toLowerCase().trim();
        // Allow exact match or partial containment (e.g., "Google" vs "Google LLC")
        return c === target || c.includes(target) || target.includes(c);
      });

      // Sort by savedAt descending
      results.sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));
      
      // Limit results
      if (limit > 0) {
        results = results.slice(0, limit);
      }
      return results;
    } catch (e) {
      console.error('Error getting jobs by company:', e);
      return [];
    }
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
