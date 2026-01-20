"use client";

/**
 * UIComponentsPlaygroundTab - Interactive playground for standard UI components
 *
 * THE SINGLE SOURCE OF TRUTH for component demos and testing.
 * References: frontend-next/lib/component-registry.ts
 *
 * Features:
 * - Interactive demos for all 34 standard components
 * - Dark mode toggle
 * - Copy import snippets
 * - Grouped by tier and category
 */

import * as React from "react";
import {
  Sun,
  Moon,
  Copy,
  Check,
  ChevronDown,
  Search,
  Plus,
  Trash2,
  Settings,
  FileText,
  Database,
  GripVertical,
  X,
  Info,
  AlertCircle,
  Pencil,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Standard Components (THE ONE for each use case)
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { ComboboxDropdown, type ComboboxItem } from "@/components/ui/combobox-dropdown";
import MultipleSelector from "@/components/ui/multiple-selector";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";

// Pattern Components
import { DragHandle, PositionBadge, ItemBadge, SortableList, SortableItem } from "@/components/ui/dnd";
import {
  KanbanBoard,
  KanbanCard,
  type KanbanColumnDef,
  type CardMoveEvent,
} from "@/components/ui/kanban";
import { TokenBadge, TokenPalette, TokenBuilder } from "@/components/ui/tokens";

// Specialized Components (Tier 4)
import { PDFViewer } from "@/components/ui/pdf-viewer";
import { PDFEditor } from "@/components/ui/pdf-editor";
import { SharePointFolderBrowser } from "@/components/ui/sharepoint-folder-browser";

// Note: These require specific data/context to function:
// - TeeemTableView: needs foundationId and entries
// - BillsInvoiceViewer: needs invoice data
// - DocumentPreviewModal: needs document data

// Registry
import {
  STANDARD_COMPONENTS,
  DEPRECATED_COMPONENTS,
  type StandardComponent,
  type ComponentCategory,
  type ComponentTier,
} from "@/lib/component-registry";

// =============================================================================
// TYPES
// =============================================================================

interface ComponentDemo {
  id: string;
  render: () => React.ReactNode;
}

// =============================================================================
// COMPONENT DEMOS
// =============================================================================

function ButtonDemo() {
  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="default">Default</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="destructive">Destructive</Button>
      <Button variant="link">Link</Button>
      <Button size="sm">Small</Button>
      <Button size="lg">Large</Button>
      <Button disabled>Disabled</Button>
    </div>
  );
}

function CardDemo() {
  return (
    <Card className="max-w-sm">
      <CardHeader>
        <CardTitle>Card Title</CardTitle>
        <CardDescription>Card description goes here</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          This is THE ONE Card component. Use for grouping related content.
        </p>
      </CardContent>
    </Card>
  );
}

function BadgeDemo() {
  return (
    <div className="flex flex-wrap gap-2">
      <Badge>Default</Badge>
      <Badge variant="secondary">Secondary</Badge>
      <Badge variant="outline">Outline</Badge>
      <Badge variant="destructive">Destructive</Badge>
    </div>
  );
}

function InputDemo() {
  return (
    <div className="space-y-2 max-w-sm">
      <Input placeholder="Default input" />
      <Input type="email" placeholder="Email input" />
      <Input disabled placeholder="Disabled input" />
    </div>
  );
}

function LabelDemo() {
  return (
    <div className="space-y-2 max-w-sm">
      <div className="space-y-1">
        <Label htmlFor="demo-input">Email</Label>
        <Input id="demo-input" placeholder="Enter your email" />
      </div>
    </div>
  );
}

function SelectDemo() {
  return (
    <div className="max-w-sm">
      <Select>
        <SelectTrigger>
          <SelectValue placeholder="Select an option" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="option1">Option 1</SelectItem>
          <SelectItem value="option2">Option 2</SelectItem>
          <SelectItem value="option3">Option 3</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

function DialogDemo() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">Open Dialog</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Dialog Title</DialogTitle>
          <DialogDescription>
            This is THE ONE Dialog component for modal interactions.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <p className="text-sm text-muted-foreground">Dialog content goes here.</p>
        </div>
        <DialogFooter>
          <Button variant="outline">Cancel</Button>
          <Button>Confirm</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TabsDemo() {
  return (
    <Tabs defaultValue="tab1" className="max-w-md">
      <TabsList>
        <TabsTrigger value="tab1">Tab 1</TabsTrigger>
        <TabsTrigger value="tab2">Tab 2</TabsTrigger>
        <TabsTrigger value="tab3">Tab 3</TabsTrigger>
      </TabsList>
      <TabsContent value="tab1" className="p-4 border rounded-b-md mt-0">
        Content for Tab 1
      </TabsContent>
      <TabsContent value="tab2" className="p-4 border rounded-b-md mt-0">
        Content for Tab 2
      </TabsContent>
      <TabsContent value="tab3" className="p-4 border rounded-b-md mt-0">
        Content for Tab 3
      </TabsContent>
    </Tabs>
  );
}

function TableDemo() {
  return (
    <div className="border rounded-md">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>John Doe</TableCell>
            <TableCell><Badge>Active</Badge></TableCell>
            <TableCell className="text-right">$250.00</TableCell>
          </TableRow>
          <TableRow>
            <TableCell>Jane Smith</TableCell>
            <TableCell><Badge variant="secondary">Pending</Badge></TableCell>
            <TableCell className="text-right">$150.00</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}

function SpinnerDemo() {
  return (
    <div className="flex items-center gap-4">
      <Spinner size={16} />
      <Spinner size={20} />
      <Spinner size={28} />
      <div className="flex items-center gap-2">
        <Spinner size={16} />
        <span className="text-sm text-muted-foreground">Loading...</span>
      </div>
    </div>
  );
}

function TextareaDemo() {
  return (
    <div className="max-w-sm">
      <Textarea placeholder="Enter your message..." rows={3} />
    </div>
  );
}

function CheckboxDemo() {
  const [checked, setChecked] = React.useState(false);
  return (
    <div className="flex items-center gap-2">
      <Checkbox
        id="demo-checkbox"
        checked={checked}
        onCheckedChange={(val) => setChecked(val === true)}
      />
      <Label htmlFor="demo-checkbox">Accept terms and conditions</Label>
    </div>
  );
}

function SwitchDemo() {
  const [enabled, setEnabled] = React.useState(false);
  return (
    <div className="flex items-center gap-2">
      <Switch
        id="demo-switch"
        checked={enabled}
        onCheckedChange={setEnabled}
      />
      <Label htmlFor="demo-switch">Enable notifications</Label>
    </div>
  );
}

function ComboboxDropdownDemo() {
  const [selected, setSelected] = React.useState<ComboboxItem | undefined>(undefined);
  const items: ComboboxItem[] = [
    { id: "apple", label: "Apple" },
    { id: "banana", label: "Banana" },
    { id: "cherry", label: "Cherry" },
    { id: "date", label: "Date" },
  ];

  return (
    <div className="max-w-sm">
      <ComboboxDropdown
        items={items}
        selectedItem={selected}
        onSelect={(item) => setSelected(item || undefined)}
        placeholder="Select a fruit..."
        searchPlaceholder="Search fruits..."
      />
    </div>
  );
}

function MultipleSelectorDemo() {
  const [selected, setSelected] = React.useState<Array<{ value: string; label: string }>>([]);
  const options = [
    { value: "react", label: "React" },
    { value: "vue", label: "Vue" },
    { value: "angular", label: "Angular" },
    { value: "svelte", label: "Svelte" },
  ];

  return (
    <div className="max-w-sm">
      <MultipleSelector
        value={selected}
        onChange={setSelected}
        options={options}
        placeholder="Select frameworks..."
      />
    </div>
  );
}

function PopoverDemo() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline">Open Popover</Button>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Popover Title</h4>
          <p className="text-sm text-muted-foreground">
            Use for small overlays with contextual content.
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function ProgressDemo() {
  const [progress, setProgress] = React.useState(60);

  React.useEffect(() => {
    const timer = setInterval(() => {
      setProgress((prev) => (prev >= 100 ? 0 : prev + 10));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="space-y-2 max-w-sm">
      <Progress value={progress} />
      <p className="text-sm text-muted-foreground text-center">{progress}%</p>
    </div>
  );
}

function SheetDemo() {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline">Open Sheet</Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Sheet Title</SheetTitle>
          <SheetDescription>
            This is THE ONE side panel component. Use instead of Drawer.
          </SheetDescription>
        </SheetHeader>
        <div className="py-4">
          <p className="text-sm text-muted-foreground">Sheet content goes here.</p>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function AccordionDemo() {
  return (
    <Accordion type="single" collapsible className="max-w-md">
      <AccordionItem value="item-1">
        <AccordionTrigger>What is TEEEM?</AccordionTrigger>
        <AccordionContent>
          TEEEM is a comprehensive business management platform.
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="item-2">
        <AccordionTrigger>How do I get started?</AccordionTrigger>
        <AccordionContent>
          Contact your administrator for access credentials.
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="item-3">
        <AccordionTrigger>Is there a mobile app?</AccordionTrigger>
        <AccordionContent>
          Yes, TEEEM has a responsive web interface that works on mobile.
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

function TooltipDemo() {
  return (
    <TooltipProvider>
      <div className="flex gap-4">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" size="icon">
              <Info className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>This is a tooltip</p>
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline">Hover me</Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>Tooltip on bottom</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}

// =============================================================================
// PATTERN COMPONENT DEMOS
// =============================================================================

function DragHandleDemo() {
  return (
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-2 p-2 border rounded-md bg-muted/30">
        <DragHandle />
        <span className="text-sm">Draggable item</span>
      </div>
      <div className="flex items-center gap-2 p-2 border rounded-md bg-muted/30">
        <DragHandle size="sm" />
        <span className="text-sm">Small handle</span>
      </div>
    </div>
  );
}

function PositionBadgeDemo() {
  const [position, setPosition] = React.useState(1);
  return (
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-2">
        <PositionBadge position={1} />
        <span className="text-sm text-muted-foreground">Read-only</span>
      </div>
      <div className="flex items-center gap-2">
        <PositionBadge
          position={position}
          editable
          onPositionChange={setPosition}
          maxPosition={10}
        />
        <span className="text-sm text-muted-foreground">Editable</span>
      </div>
    </div>
  );
}

function ItemBadgeDemo() {
  const [position, setPosition] = React.useState(1);
  const [label, setLabel] = React.useState("02a");
  return (
    <div className="space-y-4">
      {/* Content Types */}
      <div>
        <p className="text-xs text-muted-foreground mb-2">Content types:</p>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <ItemBadge position={1} />
            <span className="text-xs text-muted-foreground">position</span>
          </div>
          <div className="flex items-center gap-1.5">
            <ItemBadge label="02a" />
            <span className="text-xs text-muted-foreground">label</span>
          </div>
          <div className="flex items-center gap-1.5">
            <ItemBadge icon={Settings} />
            <span className="text-xs text-muted-foreground">icon</span>
          </div>
          <div className="flex items-center gap-1.5">
            <ItemBadge renderContent={() => <span className="text-[8px]">CUSTOM</span>} />
            <span className="text-xs text-muted-foreground">custom</span>
          </div>
        </div>
      </div>
      {/* Colors */}
      <div>
        <p className="text-xs text-muted-foreground mb-2">Color variants:</p>
        <div className="flex flex-wrap items-center gap-2">
          <ItemBadge position={1} color="default" />
          <ItemBadge position={2} color="primary" />
          <ItemBadge position={3} color="purple" />
          <ItemBadge position={4} color="orange" />
          <ItemBadge position={5} color="blue" />
          <ItemBadge position={6} color="green" />
          <ItemBadge position={7} color="gray" />
          <ItemBadge position={8} color="red" />
        </div>
      </div>
      {/* Editable */}
      <div>
        <p className="text-xs text-muted-foreground mb-2">Editable:</p>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <ItemBadge
              position={position}
              editable
              onPositionChange={setPosition}
              maxPosition={10}
              color="purple"
            />
            <span className="text-xs text-muted-foreground">click to edit</span>
          </div>
          <div className="flex items-center gap-1.5">
            <ItemBadge
              label={label}
              editable
              onLabelChange={setLabel}
              color="orange"
            />
            <span className="text-xs text-muted-foreground">click to edit</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function TokenBadgeDemo() {
  return (
    <div className="flex flex-wrap gap-2">
      <TokenBadge code="{CompanyCode}" color="purple" />
      <TokenBadge code="{JobCode}" color="orange" />
      <TokenBadge code="{DocType}" color="blue" />
      <TokenBadge code="{Date}" color="green" />
      <TokenBadge code="{Custom}" color="gray" removable onRemove={() => {}} />
    </div>
  );
}

function TokenPaletteDemo() {
  const [selectedCode, setSelectedCode] = React.useState<string | null>(null);
  return (
    <div className="space-y-2">
      {selectedCode && (
        <p className="text-sm text-muted-foreground">
          Selected: <code className="bg-muted px-1 rounded">{selectedCode}</code>
        </p>
      )}
      <TokenPalette
        scope="company"
        onSelect={(code) => setSelectedCode(code)}
        showLongVariants
        maxHeight="200px"
      />
    </div>
  );
}

function TokenBuilderDemo() {
  const [template, setTemplate] = React.useState("{CompanyCode} - {Description}");
  return (
    <div className="max-w-md">
      <TokenBuilder
        value={template}
        onChange={setTemplate}
        scope="document"
        showPreview
        label="File Name Template"
        helpText="Click + to add placeholders"
      />
    </div>
  );
}

// =============================================================================
// SORTABLE LIST DEMOS
// =============================================================================

function SortableListDemo() {
  const [items, setItems] = React.useState([
    { id: "1", name: "First Item" },
    { id: "2", name: "Second Item" },
    { id: "3", name: "Third Item" },
    { id: "4", name: "Fourth Item" },
  ]);

  return (
    <div className="max-w-sm">
      <SortableList items={items} onReorder={setItems}>
        {items.map((item, index) => (
          <SortableItem
            key={item.id}
            id={item.id}
            position={index + 1}
            showHandle
            showPosition
            variant="card"
          >
            <span className="text-sm">{item.name}</span>
          </SortableItem>
        ))}
      </SortableList>
    </div>
  );
}

function SortableItemDemo() {
  return (
    <div className="space-y-2 max-w-sm">
      <p className="text-xs text-muted-foreground mb-2">Different variants:</p>
      <div className="border rounded p-2 bg-muted/30">
        <SortableItem id="card" position={1} showHandle showPosition variant="card">
          <span className="text-sm">Card variant (default)</span>
        </SortableItem>
      </div>
      <div className="border rounded p-2 bg-muted/30">
        <SortableItem id="row" position={2} showHandle showPosition variant="row">
          <span className="text-sm">Row variant</span>
        </SortableItem>
      </div>
      <div className="border rounded p-2 bg-muted/30">
        <SortableItem id="simple" position={3} showHandle showPosition variant="simple">
          <span className="text-sm">Simple variant</span>
        </SortableItem>
      </div>
    </div>
  );
}

// =============================================================================
// KANBAN DEMO
// =============================================================================

interface KanbanDemoItem {
  id: number;
  name: string;
  status: "todo" | "doing" | "done";
  priority?: "high" | "low";
}

function KanbanBoardDemo() {
  const [items, setItems] = React.useState<KanbanDemoItem[]>([
    { id: 1, name: "Design mockups", status: "todo", priority: "high" },
    { id: 2, name: "API integration", status: "todo" },
    { id: 3, name: "Write tests", status: "doing", priority: "high" },
    { id: 4, name: "Fix login bug", status: "doing" },
    { id: 5, name: "Update docs", status: "done" },
  ]);

  const columns: KanbanColumnDef<KanbanDemoItem>[] = [
    { id: "todo", title: "To Do", color: "gray" },
    { id: "doing", title: "In Progress", color: "blue", wipLimit: 3 },
    { id: "done", title: "Done", color: "green" },
  ];

  const getItemColumn = (item: KanbanDemoItem) => item.status;

  const handleCardMove = (event: CardMoveEvent<KanbanDemoItem>) => {
    const { item, toColumnId } = event;
    setItems((prev) =>
      prev.map((i) =>
        i.id === item.id ? { ...i, status: toColumnId as KanbanDemoItem["status"] } : i
      )
    );
  };

  const renderCard = (item: KanbanDemoItem, isDragging: boolean) => (
    <KanbanCard key={item.id} id={item.id} isDragging={isDragging}>
      <div className="px-2 py-1.5 text-xs flex items-center gap-1.5">
        <span className="flex-1 truncate">{item.name}</span>
        {item.priority === "high" && (
          <Badge variant="destructive" className="text-[9px] px-1 py-0 h-3.5">
            High
          </Badge>
        )}
      </div>
    </KanbanCard>
  );

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Drag cards between columns. WIP limit of 3 on &quot;In Progress&quot;.
      </p>
      <div className="h-48 overflow-hidden">
        <KanbanBoard
          columns={columns}
          items={items}
          getItemColumn={getItemColumn}
          renderCard={renderCard}
          onCardMove={handleCardMove}
          columnGap="sm"
          minColumnWidth={120}
          className="h-full"
        />
      </div>
    </div>
  );
}

// =============================================================================
// SPECIALIZED COMPONENT DEMOS (Tier 4)
// =============================================================================

function PDFViewerDemo() {
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        PDF Viewer displays PDF documents with toolbar, zoom, and navigation.
        Requires a valid PDF URL to display content.
      </p>
      <div className="h-64 border rounded bg-muted/30 flex items-center justify-center">
        <div className="text-center text-muted-foreground">
          <FileText className="h-12 w-12 mx-auto mb-2" />
          <p className="text-sm font-medium">PDFViewer Component</p>
          <p className="text-xs">Pass a URL prop to display a PDF</p>
          <code className="text-xs block mt-2 bg-muted p-1 rounded">
            {'<PDFViewer url="/path/to/document.pdf" />'}
          </code>
        </div>
      </div>
    </div>
  );
}

function PDFEditorDemo() {
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        PDF Editor allows adding annotations, signatures, and text to PDFs.
        Requires a valid PDF URL to enable editing.
      </p>
      <div className="h-64 border rounded bg-muted/30 flex items-center justify-center">
        <div className="text-center text-muted-foreground">
          <Pencil className="h-12 w-12 mx-auto mb-2" />
          <p className="text-sm font-medium">PDFEditor Component</p>
          <p className="text-xs">Pass a URL prop to edit a PDF</p>
          <code className="text-xs block mt-2 bg-muted p-1 rounded">
            {'<PDFEditor url="/path/to/document.pdf" />'}
          </code>
        </div>
      </div>
    </div>
  );
}

function SharePointFolderBrowserDemo() {
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Folder browser for SharePoint/OneDrive. Requires Microsoft 365 connection.
      </p>
      <div className="h-48 border rounded bg-muted/30 flex items-center justify-center">
        <div className="text-center text-muted-foreground">
          <Database className="h-12 w-12 mx-auto mb-2" />
          <p className="text-sm font-medium">SharePointFolderBrowser</p>
          <p className="text-xs">Requires Microsoft 365 connection</p>
          <code className="text-xs block mt-2 bg-muted p-1 rounded">
            {'<SharePointFolderBrowser onSelect={...} />'}
          </code>
        </div>
      </div>
    </div>
  );
}

function TeeemTableViewDemo() {
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        THE ONE table component. Features: sorting, filtering, column management,
        inline editing, saved views, and more. See Gold Standard Table tab for live demo.
      </p>
      <div className="border rounded overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">ID</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell className="font-mono text-xs">1</TableCell>
              <TableCell>Sample Row</TableCell>
              <TableCell><Badge variant="outline">Active</Badge></TableCell>
              <TableCell className="text-right">$1,234</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-mono text-xs">2</TableCell>
              <TableCell>Another Row</TableCell>
              <TableCell><Badge variant="secondary">Pending</Badge></TableCell>
              <TableCell className="text-right">$5,678</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-muted-foreground italic">
        This is a preview. Full TeeemTableView requires foundationId and entries props.
      </p>
    </div>
  );
}

function BillsInvoiceViewerDemo() {
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        AI-powered invoice viewer with OCR field highlighting and validation.
      </p>
      <div className="border rounded p-4 bg-muted/30">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <p className="text-xs font-medium">AI Extracted Fields:</p>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Invoice #:</span>
                <span>INV-2024-001</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Amount:</span>
                <span>$1,234.56</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Due Date:</span>
                <span>2024-12-31</span>
              </div>
            </div>
          </div>
          <div className="border rounded bg-background flex items-center justify-center h-20">
            <span className="text-xs text-muted-foreground">PDF Preview</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function DocumentPreviewModalDemo() {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Modal for previewing and editing document metadata with PDF viewer.
      </p>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Open Preview Modal
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Document Preview</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div className="h-48 border rounded bg-muted/30 flex items-center justify-center">
              <span className="text-sm text-muted-foreground">PDF Viewer</span>
            </div>
            <div className="space-y-3">
              <div>
                <Label>Document Name</Label>
                <Input defaultValue="INV-2024-001.pdf" />
              </div>
              <div>
                <Label>Folder</Label>
                <Select defaultValue="invoices">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="invoices">Invoices</SelectItem>
                    <SelectItem value="contracts">Contracts</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// =============================================================================
// DEMO REGISTRY
// =============================================================================

const COMPONENT_DEMOS: Record<string, () => React.ReactNode> = {
  button: ButtonDemo,
  card: CardDemo,
  badge: BadgeDemo,
  input: InputDemo,
  label: LabelDemo,
  select: SelectDemo,
  dialog: DialogDemo,
  tabs: TabsDemo,
  table: TableDemo,
  spinner: SpinnerDemo,
  textarea: TextareaDemo,
  checkbox: CheckboxDemo,
  switch: SwitchDemo,
  "combobox-dropdown": ComboboxDropdownDemo,
  "multiple-selector": MultipleSelectorDemo,
  popover: PopoverDemo,
  progress: ProgressDemo,
  sheet: SheetDemo,
  accordion: AccordionDemo,
  tooltip: TooltipDemo,
  "drag-handle": DragHandleDemo,
  "position-badge": PositionBadgeDemo,
  "item-badge": ItemBadgeDemo,
  "token-badge": TokenBadgeDemo,
  "token-palette": TokenPaletteDemo,
  "token-builder": TokenBuilderDemo,
  // Sortable components
  "sortable-list": SortableListDemo,
  "sortable-item": SortableItemDemo,
  // Kanban
  "kanban-board": KanbanBoardDemo,
  // Specialized components (Tier 4)
  "pdf-viewer": PDFViewerDemo,
  "pdf-editor": PDFEditorDemo,
  "sharepoint-folder-browser": SharePointFolderBrowserDemo,
  "teeem-table-view": TeeemTableViewDemo,
  "bills-invoice-viewer": BillsInvoiceViewerDemo,
  "document-preview-modal": DocumentPreviewModalDemo,
};

// =============================================================================
// HELPER COMPONENTS
// =============================================================================

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleCopy}
      className="h-7 px-2"
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-green-600" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
    </Button>
  );
}

function ComponentCard({ component }: { component: StandardComponent }) {
  const Demo = COMPONENT_DEMOS[component.id];
  const importStatement = `import { ${component.name} } from "${component.importPath}";`;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base">{component.displayName}</CardTitle>
              <Badge variant="outline" className="text-[10px]">
                Tier {component.tier}
              </Badge>
              <Badge variant="secondary" className="text-[10px]">
                {component.category}
              </Badge>
            </div>
            <CardDescription className="text-xs">
              {component.description}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Demo Area */}
        <div className="p-4 border rounded-md bg-muted/20 min-h-[80px]">
          {Demo ? <Demo /> : (
            <div className="flex items-center justify-center text-sm text-muted-foreground">
              Demo not available
            </div>
          )}
        </div>

        {/* Import Statement */}
        <div className="flex items-center gap-2 bg-muted/50 rounded-md px-3 py-2">
          <code className="text-xs flex-1 truncate font-mono">
            {importStatement}
          </code>
          <CopyButton text={importStatement} />
        </div>

        {/* When to Use */}
        <p className="text-xs text-muted-foreground">
          <strong>When to use:</strong> {component.whenToUse}
        </p>

        {/* Deprecates */}
        {component.deprecates && component.deprecates.length > 0 && (
          <div className="flex items-center gap-2 text-xs">
            <AlertCircle className="h-3 w-3 text-amber-500" />
            <span className="text-muted-foreground">
              Replaces: {component.deprecates.join(", ")}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// =============================================================================
// CATEGORY HELPERS
// =============================================================================

const CATEGORY_LABELS: Record<ComponentCategory, string> = {
  forms: "Form Controls",
  display: "Data Display",
  feedback: "Feedback",
  overlays: "Overlays",
  navigation: "Navigation",
  layout: "Layout",
  document: "Document",
  integration: "Integration",
  finance: "Finance",
  dnd: "Drag & Drop",
  templates: "Templates",
  hooks: "Hooks",
};

const TIER_LABELS: Record<ComponentTier, string> = {
  1: "Tier 1: Core Primitives",
  2: "Tier 2: Form Controls",
  3: "Tier 3: Overlays & Layout",
  4: "Tier 4: Specialized",
  5: "Tier 5: Patterns",
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function UIComponentsPlaygroundTab() {
  const [search, setSearch] = React.useState("");
  const [selectedTier, setSelectedTier] = React.useState<ComponentTier | "all">("all");
  const [selectedCategory, setSelectedCategory] = React.useState<ComponentCategory | "all">("all");

  // Filter components
  const filteredComponents = React.useMemo(() => {
    return STANDARD_COMPONENTS.filter((c) => {
      // Search filter
      if (search) {
        const query = search.toLowerCase();
        const matchesSearch =
          c.name.toLowerCase().includes(query) ||
          c.displayName.toLowerCase().includes(query) ||
          c.description.toLowerCase().includes(query) ||
          c.whenToUse.toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }

      // Tier filter
      if (selectedTier !== "all" && c.tier !== selectedTier) return false;

      // Category filter
      if (selectedCategory !== "all" && c.category !== selectedCategory) return false;

      return true;
    });
  }, [search, selectedTier, selectedCategory]);

  // Group by tier
  const componentsByTier = React.useMemo(() => {
    const groups: Record<ComponentTier, StandardComponent[]> = {
      1: [],
      2: [],
      3: [],
      4: [],
      5: [],
    };
    filteredComponents.forEach((c) => {
      groups[c.tier].push(c);
    });
    return groups;
  }, [filteredComponents]);

  // Get unique categories
  const categories = React.useMemo(() => {
    const cats = new Set<ComponentCategory>();
    STANDARD_COMPONENTS.forEach((c) => cats.add(c.category));
    return Array.from(cats);
  }, []);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">UI Components Playground</h2>
          <p className="text-sm text-muted-foreground">
            {STANDARD_COMPONENTS.length} standard components |{" "}
            {DEPRECATED_COMPONENTS.length} deprecated
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search components..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Tier Filter */}
        <Select
          value={String(selectedTier)}
          onValueChange={(v) => setSelectedTier(v === "all" ? "all" : Number(v) as ComponentTier)}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by tier" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Tiers</SelectItem>
            <SelectItem value="1">Tier 1: Core</SelectItem>
            <SelectItem value="2">Tier 2: Forms</SelectItem>
            <SelectItem value="3">Tier 3: Overlays</SelectItem>
            <SelectItem value="4">Tier 4: Specialized</SelectItem>
            <SelectItem value="5">Tier 5: Patterns</SelectItem>
          </SelectContent>
        </Select>

        {/* Category Filter */}
        <Select
          value={selectedCategory}
          onValueChange={(v) => setSelectedCategory(v as ComponentCategory | "all")}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Filter by category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {CATEGORY_LABELS[cat]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Clear Filters */}
        {(search || selectedTier !== "all" || selectedCategory !== "all") && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearch("");
              setSelectedTier("all");
              setSelectedCategory("all");
            }}
          >
            <X className="h-4 w-4 mr-1" />
            Clear
          </Button>
        )}
      </div>

      {/* Results Count */}
      <p className="text-sm text-muted-foreground">
        Showing {filteredComponents.length} of {STANDARD_COMPONENTS.length} components
      </p>

      {/* Component Grid by Tier */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="space-y-8 pr-4">
          {([1, 2, 3, 4, 5] as ComponentTier[]).map((tier) => {
            const tierComponents = componentsByTier[tier];
            if (tierComponents.length === 0) return null;

            return (
              <div key={tier} className="space-y-3">
                <h3 className="text-sm font-medium text-muted-foreground border-b pb-2">
                  {TIER_LABELS[tier]} ({tierComponents.length})
                </h3>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {tierComponents.map((component) => (
                    <ComponentCard key={component.id} component={component} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>

      {/* Deprecated Components Section */}
      {DEPRECATED_COMPONENTS.length > 0 && (
        <div className="mt-8 pt-4 border-t">
          <Accordion type="single" collapsible>
            <AccordionItem value="deprecated" className="border-none">
              <AccordionTrigger className="text-sm font-medium text-muted-foreground hover:no-underline">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-500" />
                  Deprecated Components ({DEPRECATED_COMPONENTS.length})
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2 pt-2">
                  {DEPRECATED_COMPONENTS.map((dep) => (
                    <div
                      key={dep.id}
                      className="flex items-center justify-between p-3 border rounded-md bg-amber-50 dark:bg-amber-950/20"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm line-through text-muted-foreground">
                            {dep.name}
                          </span>
                          <span className="text-xs text-muted-foreground">→</span>
                          <span className="font-mono text-sm text-green-600 dark:text-green-400">
                            {dep.replacedBy}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {dep.migrationGuide}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      )}
    </div>
  );
}
