// Dynamic query loader for auto-update on application start
// This allows queries to be updated without restarting the application

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let queries = {};
let lastModified = 0;
let queriesPath = path.join(__dirname, 'queries.js');

// Import queries directly
import { queries as importedQueries } from './queries.js';

/**
 * Load queries from the queries.js file
 * This function will re-import the queries if the file has been modified
 * @returns {Promise<Object>} The loaded queries object
 */
export async function loadQueries() {
  try {
    // Check if queries.js file exists and get its modification time
    if (fs.existsSync(queriesPath)) {
      const stats = fs.statSync(queriesPath);
      const currentModified = stats.mtime.getTime();
      
      // If file has been modified since last load, reload it
      if (currentModified > lastModified) {
        console.log('🔄 Reloading queries from queries.js...');
        
        // Clear current queries to force reload
        queries = {};
        
        // Update last modified time
        lastModified = currentModified;
        
        console.log('✅ Queries reloaded successfully');
      }
    }
    
    // If queries is empty or we need to reload, use the imported queries
    if (Object.keys(queries).length === 0) {
      console.log('📥 Loading queries from queries.js...');
      
      // Use the directly imported queries
      queries = { ...importedQueries };
      
      console.log('✅ Queries loaded successfully');
    }
    
    return queries;
  } catch (error) {
    console.error('❌ Error loading queries:', error);
    
    // Return empty queries object as fallback
    return {};
  }
}

/**
 * Force reload queries from file
 * This can be called manually to force a reload
 * @returns {Promise<Object>} The reloaded queries object
 */
export async function forceReloadQueries() {
  console.log('🔄 Force reloading queries...');
  lastModified = 0; // Reset last modified time to force reload
  queries = {}; // Clear current queries
  return await loadQueries();
}

/**
 * Get current queries without reloading
 * @returns {Object} The current queries object
 */
export function getCurrentQueries() {
  return queries;
}

/**
 * Check if queries file has been modified
 * @returns {boolean} True if file has been modified since last load
 */
export function hasQueriesChanged() {
  try {
    if (fs.existsSync(queriesPath)) {
      const stats = fs.statSync(queriesPath);
      const currentModified = stats.mtime.getTime();
      return currentModified > lastModified;
    }
    return false;
  } catch (error) {
    console.error('❌ Error checking queries file modification:', error);
    return false;
  }
}

/**
 * Initialize the query loader
 * This should be called at application startup
 */
export async function initializeQueryLoader() {
  console.log('🚀 Initializing dynamic query loader...');
  
  try {
    // Load queries initially
    await loadQueries();
    
    // Set up file watcher for automatic reloading in development
    if (process.env.NODE_ENV === 'development') {
      console.log('👀 Setting up file watcher for queries.js...');
      
      fs.watchFile(queriesPath, { interval: 1000 }, async (curr, prev) => {
        if (curr.mtime > prev.mtime) {
          console.log('📝 Queries file modified, reloading...');
          // Clear queries and force reload
          queries = {};
          lastModified = 0;
          await loadQueries();
        }
      });
      
      console.log('✅ File watcher set up successfully');
    }
    
    console.log('✅ Query loader initialized successfully');
  } catch (error) {
    console.error('❌ Error initializing query loader:', error);
  }
}

// Export the default queries object for backward compatibility
export { queries as default };
