export interface JobTab {
  id: number;
  name: string;
  slug: string;
  icon: string;
  position: number;
  is_hidden: boolean;
  has_children: boolean;
  children: JobTab[];
}

export interface JobTabsResponse {
  success: boolean;
  tabs: JobTab[];
}

export interface JobTabReorderItem {
  id: number;
  position: number;
  parent_id: number | null;
}
