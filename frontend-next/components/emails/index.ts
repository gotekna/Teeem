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
