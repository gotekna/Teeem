// BACKWARDS COMPATIBILITY ALIAS
// This file exists for backwards compatibility during the OneDrive → SharePoint rename
// All code should use @/components/sharepoint/SharePointFolderPicker instead
//
// TODO: Remove this file after all references are updated
export {
  SharePointFolderPicker,
  SharePointFolderPicker as OneDriveFolderPicker,
  type OneDriveFolderPickerProps,
} from "@/components/sharepoint/SharePointFolderPicker";
