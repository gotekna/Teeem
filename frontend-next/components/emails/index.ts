// Email components
export { ComposeEmailModal } from "./ComposeEmailModal";
export { EmailToContactsModal } from "./EmailToContactsModal";

// Labels
export {
  LabelBadge,
  LabelSelector,
  LabelList,
  useEmailLabels,
  type EmailLabel,
  type LabelColor,
} from "./LabelManager";

// Templates
export {
  TemplateManager,
  TemplatePicker,
  VariableBadge,
  useEmailTemplates,
  type EmailTemplate,
  type TemplateCategory,
  type SystemVariable,
} from "./TemplateManager";

// Snooze
export {
  SnoozePicker,
  SnoozeBadge,
  SnoozedEmailsList,
  useEmailSnooze,
  type EmailSnooze,
  type SnoozePreset,
} from "./SnoozePicker";

// Reminders
export {
  ReminderPicker,
  ReminderBadge,
  ReminderButton,
  useEmailReminder,
  type ReminderState,
} from "./ReminderPicker";

// User State & Actions
export {
  PinButton,
  StarButton,
  ArchiveButton,
  VipButton,
  VipBadge,
  EmailActionsBar,
  useEmailState,
  type EmailUserState,
  type StarColor,
} from "./EmailActions";

// Split Inbox
export {
  SplitInboxTabs,
  ViewModeToggle,
  CategoryBadge,
  useSplitInbox,
  type SplitInboxCategory,
  type SplitInboxData,
  type CategoryData,
} from "./SplitInboxTabs";

// Keyboard Shortcuts
export { KeyboardShortcutsHelp } from "./KeyboardShortcutsHelp";

// Bulk Actions
export { BulkActionBar } from "./BulkActionBar";

// Threading
export { ThreadCountBadge } from "./ThreadCountBadge";

// Search
export { EmailSearchFilters } from "./EmailSearchFilters";

// Drafts
export { DraftsList, DraftsBadge } from "./DraftsList";

// Quick Actions
export { QuickEmailActions } from "./QuickEmailActions";

// Folder Management
export { MoveToFolderMenu, type EmailFolder } from "./MoveToFolderMenu";
export { CreateFolderDialog, DeleteFolderDialog } from "./FolderManagementDialog";

// AI Summary
export { EmailSummary, type SummaryData, type ActionItem, type Entities } from "./EmailSummary";

// Contact Matching
export { EmailContactMatch, type ContactInfo } from "./EmailContactMatch";
