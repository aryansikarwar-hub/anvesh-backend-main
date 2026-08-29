import { getLogger } from '../common/logger';

/**
 * Background jobs run inside the API process, so they share the API's logger.
 * The indirection is kept because every processor imports `log()`.
 */
export function log(): ReturnType<typeof getLogger> {
  return getLogger();
}
