// Notebook components
export { NotebooksSidebar } from "./NotebooksSidebar";
export { NotebookEditor } from "./NotebookEditor";
export { NotebookCreateModal } from "./NotebookCreateModal";
export { NotebookShareModal } from "./NotebookShareModal";
export { EntityNotesPanel } from "./EntityNotesPanel";

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
  pageActions,
  type NotebookPage,
  type NotebookPageAttachment,
} from "./hooks/useNotebookPage";
