// Catch-all route for job tabs: /jobs/[id]/[...tab]
// Handles all path variations:
// - /jobs/123/overview → params.tab = ["overview"]
// - /jobs/123/photo/site → params.tab = ["photo", "site"]
// Re-exports the main job page which reads pathname directly
export { default } from "../page";
