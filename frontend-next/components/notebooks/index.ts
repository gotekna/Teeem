// Notebook components
export { NotebooksSidebar } from "./NotebooksSidebar";
export { NotebookEditor } from "./NotebookEditor";
export { NotebookCreateModal } from "./NotebookCreateModal";
export { NotebookShareModal } from "./NotebookShareModal";
export { EntityNotesPanel } from "./EntityNotesPanel";
export { RecentNotesWidget } from "./RecentNotesWidget";

// Hooks
export {
  useNotebooks,
  useNotebook,
  notebookActions,
  sectionActions,
  type Notebook,
  type NotebookSection,
  type NotebookPageSummary,
  type NotebookShare,
} from "./hooks/useNotebooks";

export {
  useNotebookPage,
  useNotebookPages,
  useRecentPages,
  useSearchPages,
  pageActions,
  attachmentActions,
  type NotebookPage,
  type NotebookPageAttachment,
} from "./hooks/useNotebookPage";
