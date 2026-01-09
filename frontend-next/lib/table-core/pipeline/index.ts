/**
 * Pipeline Barrel Export
 *
 * All pure data processing functions for table operations.
 * No React dependencies - can be used in Node.js, tests, or any JS environment.
 */

// Filter pipeline
export {
  filterRows,
  applyFilters,
  evaluateFilter,
  getFilterDisplayValue,
} from "./filterRows";

// Sort pipeline
export { sortRows, applySorting } from "./sortRows";

// Search pipeline
export { searchRows, applySearch, type SearchMode } from "./searchRows";

// Group pipeline
export {
  groupRows,
  buildGroupedEntries,
  getAllGroupKeys,
  getVisibleRowIdsFromGroups,
  getGroupDisplayValue,
} from "./groupRows";
