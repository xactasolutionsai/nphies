import fs from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';

export function createQueryLoader(filename) {
  let queries;
  let lastModified = -1;
  let revision = 0;
  let loading;
  async function load(force = false) {
    if (loading) return loading;
    const modified = fs.statSync(filename).mtimeMs;
    if (!force && queries && modified === lastModified) return queries;
    loading = (async () => {
      const url = pathToFileURL(filename);
      url.searchParams.set('revision', String(++revision));
      const module = await import(url.href);
      if (!module.queries || typeof module.queries !== 'object') throw new Error('Invalid query module');
      queries = module.queries;
      lastModified = modified;
      return queries;
    })();
    try { return await loading; } finally { loading = null; }
  }
  return { load, current: () => queries, changed: () => fs.statSync(filename).mtimeMs !== lastModified };
}

const filename = fileURLToPath(new URL('./queries.js', import.meta.url));
const loader = createQueryLoader(filename);
let queries;
export async function loadQueries() { queries = await loader.load(); return queries; }
export async function forceReloadQueries() { queries = await loader.load(true); return queries; }
export function getCurrentQueries() { return loader.current(); }
export function hasQueriesChanged() { return loader.changed(); }
export async function initializeQueryLoader() {
  await loadQueries();
  if (process.env.NODE_ENV === 'development') {
    fs.watchFile(filename, { interval: 1000, persistent: false }, () => {
      forceReloadQueries().catch(error => console.error('Query reload failed:', error.message));
    });
  }
}
export { queries as default };
