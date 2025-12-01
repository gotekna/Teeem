"use client";

/**
 * ============================================================================
 * TEEEM DESIGN SYSTEM
 * ============================================================================
 *
 * Internal design system reference for the Teeem construction management app.
 * Use this as a reference for building new features.
 */

import * as React from "react";

// UI Component Imports
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Pill, StatusPill } from "@/components/ui/pill";
import { Loader } from "@/components/ui/loader";
import { Spinner } from "@/components/ui/spinner";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger, SheetFooter } from "@/components/ui/sheet";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

// Icons
import {
  Copy, Check, ChevronDown, ChevronRight, Plus, Search, MoreHorizontal, Settings,
  User, Bell, Mail, Calendar, AlertTriangle, Info, CheckCircle, XCircle,
  Home, FileText, Folder, Star, Heart, Trash, Edit, Download, Upload,
  ArrowRight, ArrowLeft, ExternalLink, Link2, Eye, EyeOff, Lock, Unlock,
  Sun, Moon, Zap, Activity, BarChart3, PieChart, TrendingUp, DollarSign,
  Building2, Users, Briefcase, ShoppingCart, Package, Truck, CreditCard,
  Phone, MapPin, Clock, Filter, SortAsc, RefreshCw, X
} from "lucide-react";

// ============================================================================
// 1. DESIGN TOKENS
// ============================================================================

const designTokens = {
  colors: {
    light: {
      background: "hsl(0, 0%, 100%)",
      foreground: "hsl(0, 0%, 7%)",
      card: "hsl(45, 18%, 96%)",
      popover: "hsl(45, 18%, 96%)",
      primary: "hsl(240, 5.9%, 10%)",
      primaryForeground: "hsl(0, 0%, 98%)",
      secondary: "hsl(40, 11%, 89%)",
      secondaryForeground: "hsl(240, 5.9%, 10%)",
      muted: "hsl(40, 11%, 89%)",
      mutedForeground: "hsl(0, 0%, 38%)",
      accent: "hsl(40, 10%, 94%)",
      accentForeground: "hsl(240, 5.9%, 10%)",
      destructive: "hsl(0, 84.2%, 60.2%)",
      destructiveForeground: "hsl(0, 0%, 98%)",
      border: "hsl(45, 5%, 85%)",
      input: "hsl(240, 5.9%, 90%)",
      ring: "hsl(240, 5.9%, 10%)",
    },
    dark: {
      background: "hsl(0, 0%, 5%)",
      foreground: "hsl(0, 0%, 98%)",
      card: "hsl(0, 0%, 7%)",
      popover: "hsl(0, 0%, 7%)",
      primary: "hsl(0, 0%, 98%)",
      primaryForeground: "hsl(240, 5.9%, 10%)",
      secondary: "hsl(0, 0%, 11%)",
      secondaryForeground: "hsl(0, 0%, 98%)",
      muted: "hsl(0, 0%, 11%)",
      mutedForeground: "hsl(0, 0%, 38%)",
      accent: "hsl(0, 0%, 11%)",
      accentForeground: "hsl(0, 0%, 98%)",
      destructive: "hsl(359, 100%, 61%)",
      destructiveForeground: "hsl(0, 0%, 100%)",
      border: "hsl(0, 0%, 11%)",
      input: "hsl(0, 0%, 11%)",
      ring: "hsl(240, 4.9%, 83.9%)",
    },
  },
  typography: {
    fontFamily: {
      sans: "var(--font-hedvig-sans)",
      serif: "var(--font-hedvig-serif)",
      mono: "var(--font-hedvig-sans)",
    },
  },
  borderRadius: {
    sm: "calc(0.5rem - 4px)",
    md: "calc(0.5rem - 2px)",
    lg: "0.5rem",
  },
  screens: {
    sm: "640px",
    md: "768px",
    lg: "1024px",
    xl: "1280px",
    "2xl": "1536px",
    "3xl": "1800px",
  },
};

// ============================================================================
// COMPONENT CATALOGS
// ============================================================================

const formControls = {
  Input: "./components/input",
  Textarea: "./components/textarea",
  Checkbox: "./components/checkbox",
  RadioGroup: "./components/radio-group",
  Switch: "./components/switch",
  Slider: "./components/slider",
  Select: "./components/select",
  Combobox: "./components/combobox",
  ComboboxDropdown: "./components/combobox-dropdown",
  MultipleSelector: "./components/multiple-selector",
  CurrencyInput: "./components/currency-input",
  QuantityInput: "./components/quantity-input",
  DateRangePicker: "./components/date-range-picker",
  TimeRangeInput: "./components/time-range-input",
  Calendar: "./components/calendar",
  Form: "./components/form",
  Label: "./components/label",
  SubmitButton: "./components/submit-button",
};

const buttonVariants = {
  variants: {
    default: "bg-primary text-primary-foreground hover:bg-primary/90",
    destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
    outline: "border border bg-transparent hover:bg-accent hover:text-accent-foreground",
    secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
    ghost: "hover:bg-accent hover:text-accent-foreground",
    link: "text-primary underline-offset-4 hover:underline",
  },
  sizes: {
    default: "h-9 px-4 py-2",
    sm: "h-8 px-3 text-xs",
    lg: "h-10 px-8",
    icon: "h-9 w-9",
  },
};

const layoutComponents = {
  Card: "./components/card",
  Accordion: "./components/accordion",
  Tabs: "./components/tabs",
  Collapsible: "./components/collapsible",
  ScrollArea: "./components/scroll-area",
  Separator: "./components/separator",
  Carousel: "./components/carousel",
};

const dialogComponents = {
  Dialog: "./components/dialog",
  AlertDialog: "./components/alert-dialog",
  Drawer: "./components/drawer",
  Sheet: "./components/sheet",
  Popover: "./components/popover",
  HoverCard: "./components/hover-card",
  Tooltip: "./components/tooltip",
};

const navigationComponents = {
  DropdownMenu: "./components/dropdown-menu",
  ContextMenu: "./components/context-menu",
  NavigationMenu: "./components/navigation-menu",
  Command: "./components/command",
};

const dataDisplayComponents = {
  Table: "./components/table",
  DataTable: "./components/data-table",
  Chart: "./components/chart",
  GanttChart: "./components/gantt-chart",
  Progress: "./components/progress",
  Badge: "./components/badge",
  Pill: "./components/pill",
  Avatar: "./components/avatar",
};

const feedbackComponents = {
  Alert: "./components/alert",
  Toast: "./components/toast",
  Toaster: "./components/toaster",
  useToast: "./components/use-toast",
  Skeleton: "./components/skeleton",
  Spinner: "./components/spinner",
  Loader: "./components/loader",
};

const dashboardComponents = {
  layout: {
    Sidebar: "components/sidebar",
    Header: "components/header",
    MobileMenu: "components/mobile-menu",
  },
  transactions: {
    DataTable: "components/tables/transactions/data-table",
    TransactionSheet: "components/transaction-sheet",
  },
  invoices: {
    Invoice: "components/invoice",
    InvoiceSheet: "components/invoice-sheet",
  },
  purchaseOrders: {
    PurchaseOrder: "components/purchase-order",
  },
};


// ============================================================================
// CSS CONTENT
// ============================================================================

const globalsCss = `@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0, 0%, 100%;
    --foreground: 0, 0%, 7%;
    --card: 45 18% 96%;
    --card-foreground: 240 10% 3.9%;
    --popover: 45 18% 96%;
    --popover-foreground: 240 10% 3.9%;
    --primary: 240 5.9% 10%;
    --primary-foreground: 0 0% 98%;
    --secondary: 40, 11%, 89%;
    --secondary-foreground: 240 5.9% 10%;
    --muted: 40, 11%, 89%;
    --muted-foreground: 240 3.8% 46.1%;
    --accent: 40, 10%, 94%;
    --accent-foreground: 240 5.9% 10%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 0 0% 98%;
    --border: 45, 5%, 85%;
    --input: 240 5.9% 90%;
    --ring: 240 5.9% 10%;
    --radius: 0.5rem;
  }

  .dark {
    --background: 0, 0%, 5%;
    --foreground: 0 0% 98%;
    --card: 0, 0%, 7%;
    --card-foreground: 0 0% 98%;
    --popover: 0, 0%, 7%;
    --popover-foreground: 0 0% 98%;
    --primary: 0 0% 98%;
    --primary-foreground: 240 5.9% 10%;
    --secondary: 0, 0%, 11%;
    --secondary-foreground: 0 0% 98%;
    --muted: 0, 0%, 11%;
    --muted-foreground: 240 5% 64.9%;
    --accent: 0, 0%, 11%;
    --accent-foreground: 0 0% 98%;
    --destructive: 359, 100%, 61%;
    --destructive-foreground: 0, 0%, 100%;
    --border: 0, 0%, 11%;
    --input: 0, 0%, 11%;
    --ring: 240 4.9% 83.9%;
  }
}`;

const codeExamples = {
  button: `import { Button } from "@/components/ui/button";

<Button>Default</Button>
<Button variant="secondary">Secondary</Button>
<Button variant="destructive">Destructive</Button>
<Button variant="outline">Outline</Button>
<Button variant="ghost">Ghost</Button>
<Button variant="link">Link</Button>`,

  card: `import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";

<Card>
  <CardHeader>
    <CardTitle>Card Title</CardTitle>
    <CardDescription>Card description</CardDescription>
  </CardHeader>
  <CardContent>Content here</CardContent>
  <CardFooter>Footer actions</CardFooter>
</Card>`,

  dialog: `import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

<Dialog>
  <DialogTrigger asChild><Button>Open</Button></DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Title</DialogTitle>
    </DialogHeader>
    Content here
  </DialogContent>
</Dialog>`,

  form: `import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

<div className="space-y-2">
  <Label htmlFor="email">Email</Label>
  <Input id="email" type="email" placeholder="email@example.com" />
</div>`,
};

const animations = {
  accordion: "animate-accordion-down | animate-accordion-up",
  caret: "animate-caret-blink",
  shimmer: "animate-shimmer",
  scroll: "animate-scroll",
  spin: "animate-spin",
};

const summary = {
  totalComponents: {
    uiComponents: 57,
  },
  keyDependencies: [
    "Next.js 16",
    "React 19",
    "Radix UI",
    "Tailwind CSS",
    "Class Variance Authority",
    "React Hook Form + Zod",
    "TanStack React Table",
    "Recharts",
    "Lucide Icons",
  ],
};

// ============================================================================
// COMPONENT TREE HELPER
// ============================================================================

function ComponentTree({ data, title }: { data: Record<string, unknown>; title: string }) {
  const [expanded, setExpanded] = React.useState<Record<string, boolean>>({});

  const toggleExpand = (key: string) => {
    setExpanded(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const renderObject = (obj: Record<string, unknown>) => {
    return Object.entries(obj).map(([key, value]) => {
      const isObject = typeof value === "object" && value !== null && !Array.isArray(value);
      const isExpanded = expanded[key] ?? false;

      return (
        <div key={key} className="ml-4">
          {isObject ? (
            <>
              <button
                onClick={() => toggleExpand(key)}
                className="flex items-center gap-1 hover:text-foreground text-muted-foreground py-0.5"
              >
                {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                <span className="font-medium text-sm">{key}</span>
                <Badge variant="secondary" className="ml-2 text-xs">
                  {Object.keys(value as Record<string, unknown>).length}
                </Badge>
              </button>
              {isExpanded && renderObject(value as Record<string, unknown>)}
            </>
          ) : (
            <div className="flex items-center gap-2 py-0.5 ml-4">
              <span className="text-sm text-foreground">{key}</span>
              <code className="text-xs text-muted-foreground">{String(value)}</code>
            </div>
          )}
        </div>
      );
    });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent className="max-h-96 overflow-y-auto">
        {renderObject(data)}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// COMPONENT SHOWCASE SECTION
// ============================================================================

function ComponentShowcase({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold">{title}</h3>
      <Card>
        <CardContent className="pt-6">
          {children}
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// MAIN PAGE COMPONENT
// ============================================================================

export default function DesignSystemPage() {
  const [copiedCode, setCopiedCode] = React.useState<string | null>(null);
  const [progress, setProgress] = React.useState(45);
  const [sliderValue, setSliderValue] = React.useState([50]);
  const [isCollapsibleOpen, setIsCollapsibleOpen] = React.useState(false);

  const copyToClipboard = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(id);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  return (
    <TooltipProvider>
      <div className="max-w-7xl mx-auto space-y-12 pb-12">
        {/* Header */}
        <div className="border-b pb-6">
          <h1 className="text-3xl font-bold font-serif">Teeem Design System</h1>
          <p className="text-muted-foreground mt-2">
            Complete UI component library with live examples. Internal reference only.
          </p>
          <div className="flex gap-2 mt-4">
            <Badge>57 UI Components</Badge>
            <Badge variant="secondary">Live Examples</Badge>
          </div>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="live" className="space-y-6">
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="live">Live Components</TabsTrigger>
            <TabsTrigger value="tokens">Design Tokens</TabsTrigger>
            <TabsTrigger value="css">CSS Variables</TabsTrigger>
            <TabsTrigger value="catalog">Component Catalog</TabsTrigger>
            <TabsTrigger value="patterns">Code Patterns</TabsTrigger>
          </TabsList>

          {/* ============================================================ */}
          {/* LIVE COMPONENTS TAB */}
          {/* ============================================================ */}
          <TabsContent value="live" className="space-y-8">

            {/* BUTTONS */}
            <ComponentShowcase title="Buttons">
              <div className="space-y-6">
                <div>
                  <p className="text-sm text-muted-foreground mb-3">Variants</p>
                  <div className="flex flex-wrap gap-3">
                    <Button>Default</Button>
                    <Button variant="secondary">Secondary</Button>
                    <Button variant="destructive">Destructive</Button>
                    <Button variant="outline">Outline</Button>
                    <Button variant="ghost">Ghost</Button>
                    <Button variant="link">Link</Button>
                  </div>
                </div>
                <Separator />
                <div>
                  <p className="text-sm text-muted-foreground mb-3">Sizes</p>
                  <div className="flex flex-wrap items-center gap-3">
                    <Button size="sm">Small</Button>
                    <Button>Default</Button>
                    <Button size="lg">Large</Button>
                    <Button size="icon"><Plus className="h-4 w-4" /></Button>
                  </div>
                </div>
                <Separator />
                <div>
                  <p className="text-sm text-muted-foreground mb-3">With Icons</p>
                  <div className="flex flex-wrap gap-3">
                    <Button><Plus className="h-4 w-4 mr-2" />Create New</Button>
                    <Button variant="outline"><Search className="h-4 w-4 mr-2" />Search</Button>
                    <Button variant="secondary"><Download className="h-4 w-4 mr-2" />Download</Button>
                    <Button variant="destructive"><Trash className="h-4 w-4 mr-2" />Delete</Button>
                  </div>
                </div>
                <Separator />
                <div>
                  <p className="text-sm text-muted-foreground mb-3">States</p>
                  <div className="flex flex-wrap gap-3">
                    <Button disabled>Disabled</Button>
                    <Button disabled><Loader className="mr-2" size={16} />Loading</Button>
                  </div>
                </div>
              </div>
            </ComponentShowcase>

            {/* BADGES & PILLS */}
            <ComponentShowcase title="Badges & Pills">
              <div className="space-y-6">
                <div>
                  <p className="text-sm text-muted-foreground mb-3">Badge Variants</p>
                  <div className="flex flex-wrap gap-2">
                    <Badge>Default</Badge>
                    <Badge variant="secondary">Secondary</Badge>
                    <Badge variant="outline">Outline</Badge>
                    <Badge variant="destructive">Destructive</Badge>
                  </div>
                </div>
                <Separator />
                <div>
                  <p className="text-sm text-muted-foreground mb-3">Status Badges (Custom Colors)</p>
                  <div className="flex flex-wrap gap-2">
                    <Badge className="bg-green-100 text-green-800">Approved</Badge>
                    <Badge className="bg-blue-100 text-blue-800">Sent</Badge>
                    <Badge className="bg-orange-100 text-orange-800">Pending</Badge>
                    <Badge className="bg-purple-100 text-purple-800">Received</Badge>
                    <Badge className="bg-gray-100 text-gray-800">Draft</Badge>
                  </div>
                </div>
                <Separator />
                <div>
                  <p className="text-sm text-muted-foreground mb-3">Pill Variants</p>
                  <div className="flex flex-wrap gap-2">
                    <Pill>Default</Pill>
                    <Pill variant="primary">Primary</Pill>
                    <Pill variant="secondary">Secondary</Pill>
                    <Pill variant="success">Success</Pill>
                    <Pill variant="warning">Warning</Pill>
                    <Pill variant="error">Error</Pill>
                    <Pill variant="info">Info</Pill>
                    <Pill variant="outline">Outline</Pill>
                  </div>
                </div>
                <Separator />
                <div>
                  <p className="text-sm text-muted-foreground mb-3">Status Pills (Pre-configured)</p>
                  <div className="flex flex-wrap gap-2">
                    <StatusPill status="active" />
                    <StatusPill status="pending" />
                    <StatusPill status="completed" />
                    <StatusPill status="processing" />
                    <StatusPill status="failed" />
                    <StatusPill status="cancelled" />
                    <StatusPill status="draft" />
                  </div>
                </div>
                <Separator />
                <div>
                  <p className="text-sm text-muted-foreground mb-3">Pill Sizes</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Pill size="sm" variant="success">Small</Pill>
                    <Pill variant="info">Default</Pill>
                    <Pill size="lg" variant="warning">Large</Pill>
                  </div>
                </div>
                <Separator />
                <div>
                  <p className="text-sm text-muted-foreground mb-3">Removable Pills</p>
                  <div className="flex flex-wrap gap-2">
                    <Pill variant="secondary" removable onRemove={() => {}}>Tag 1</Pill>
                    <Pill variant="secondary" removable onRemove={() => {}}>Tag 2</Pill>
                    <Pill variant="secondary" removable onRemove={() => {}}>Tag 3</Pill>
                  </div>
                </div>
              </div>
            </ComponentShowcase>

            {/* FORM INPUTS */}
            <ComponentShowcase title="Form Inputs">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="default-input">Default Input</Label>
                    <Input id="default-input" placeholder="Enter text..." />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email-input">Email Input</Label>
                    <Input id="email-input" type="email" placeholder="email@example.com" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password-input">Password Input</Label>
                    <Input id="password-input" type="password" placeholder="••••••••" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="disabled-input">Disabled Input</Label>
                    <Input id="disabled-input" disabled placeholder="Disabled" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="search-input">Input with Icon</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input id="search-input" className="pl-9" placeholder="Search..." />
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="textarea">Textarea</Label>
                    <Textarea id="textarea" placeholder="Enter longer text..." rows={4} />
                  </div>
                  <div className="space-y-2">
                    <Label>Select</Label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="Select option..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">Option 1</SelectItem>
                        <SelectItem value="2">Option 2</SelectItem>
                        <SelectItem value="3">Option 3</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </ComponentShowcase>

            {/* CHECKBOXES, SWITCHES, RADIOS */}
            <ComponentShowcase title="Checkboxes, Switches & Radio Groups">
              <div className="grid md:grid-cols-3 gap-6">
                <div className="space-y-4">
                  <p className="text-sm font-medium">Checkboxes</p>
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <Checkbox id="check1" />
                      <Label htmlFor="check1" className="font-normal">Unchecked</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox id="check2" defaultChecked />
                      <Label htmlFor="check2" className="font-normal">Checked</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox id="check3" disabled />
                      <Label htmlFor="check3" className="font-normal text-muted-foreground">Disabled</Label>
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <p className="text-sm font-medium">Switches</p>
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <Switch id="switch1" />
                      <Label htmlFor="switch1" className="font-normal">Off</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch id="switch2" defaultChecked />
                      <Label htmlFor="switch2" className="font-normal">On</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch id="switch3" disabled />
                      <Label htmlFor="switch3" className="font-normal text-muted-foreground">Disabled</Label>
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <p className="text-sm font-medium">Radio Group</p>
                  <RadioGroup defaultValue="option1">
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="option1" id="r1" />
                      <Label htmlFor="r1" className="font-normal">Option 1</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="option2" id="r2" />
                      <Label htmlFor="r2" className="font-normal">Option 2</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="option3" id="r3" />
                      <Label htmlFor="r3" className="font-normal">Option 3</Label>
                    </div>
                  </RadioGroup>
                </div>
              </div>
            </ComponentShowcase>

            {/* SLIDERS & PROGRESS */}
            <ComponentShowcase title="Sliders & Progress">
              <div className="space-y-6">
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">Slider: {sliderValue[0]}%</p>
                  <Slider value={sliderValue} onValueChange={setSliderValue} max={100} step={1} />
                </div>
                <Separator />
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">Progress: {progress}%</p>
                  <Progress value={progress} />
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setProgress(Math.max(0, progress - 10))}>-10%</Button>
                    <Button size="sm" variant="outline" onClick={() => setProgress(Math.min(100, progress + 10))}>+10%</Button>
                  </div>
                </div>
              </div>
            </ComponentShowcase>

            {/* AVATARS */}
            <ComponentShowcase title="Avatars">
              <div className="space-y-6">
                <div>
                  <p className="text-sm text-muted-foreground mb-3">Sizes</p>
                  <div className="flex items-center gap-4">
                    <Avatar className="h-8 w-8"><AvatarFallback>JB</AvatarFallback></Avatar>
                    <Avatar className="h-10 w-10"><AvatarFallback>JB</AvatarFallback></Avatar>
                    <Avatar className="h-12 w-12"><AvatarFallback>JB</AvatarFallback></Avatar>
                    <Avatar className="h-16 w-16"><AvatarFallback>JB</AvatarFallback></Avatar>
                  </div>
                </div>
                <Separator />
                <div>
                  <p className="text-sm text-muted-foreground mb-3">Colored Backgrounds</p>
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-sm text-white font-medium">JB</div>
                    <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center text-sm text-white font-medium">SC</div>
                    <div className="w-10 h-10 rounded-full bg-purple-500 flex items-center justify-center text-sm text-white font-medium">DT</div>
                    <div className="w-10 h-10 rounded-full bg-orange-500 flex items-center justify-center text-sm text-white font-medium">MH</div>
                    <div className="w-10 h-10 rounded-full bg-pink-500 flex items-center justify-center text-sm text-white font-medium">LK</div>
                    <div className="w-10 h-10 rounded-full bg-teal-500 flex items-center justify-center text-sm text-white font-medium">RW</div>
                  </div>
                </div>
              </div>
            </ComponentShowcase>

            {/* LOADING STATES */}
            <ComponentShowcase title="Loading States">
              <div className="grid md:grid-cols-3 gap-6">
                <div className="space-y-4">
                  <p className="text-sm font-medium">Spinner</p>
                  <div className="flex items-center gap-4">
                    <Spinner size={16} />
                    <Spinner size={24} />
                    <Spinner size={32} />
                  </div>
                </div>
                <div className="space-y-4">
                  <p className="text-sm font-medium">Loader</p>
                  <div className="flex items-center gap-4">
                    <Loader size={16} />
                    <Loader size={24} />
                    <Loader size={32} />
                  </div>
                </div>
                <div className="space-y-4">
                  <p className="text-sm font-medium">Skeleton</p>
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                </div>
              </div>
            </ComponentShowcase>

            {/* ALERTS */}
            <ComponentShowcase title="Alerts">
              <div className="space-y-4">
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertTitle>Default Alert</AlertTitle>
                  <AlertDescription>This is a default alert message.</AlertDescription>
                </Alert>
                <Alert variant="destructive">
                  <XCircle className="h-4 w-4" />
                  <AlertTitle>Destructive Alert</AlertTitle>
                  <AlertDescription>Something went wrong. Please try again.</AlertDescription>
                </Alert>
              </div>
            </ComponentShowcase>

            {/* CARDS */}
            <ComponentShowcase title="Cards">
              <div className="grid md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Basic Card</CardTitle>
                    <CardDescription>With title and description</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">Card content goes here.</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Revenue</span>
                    </div>
                    <p className="text-2xl font-bold mt-1 font-mono">$125,450</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle>With Footer</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">Content here</p>
                  </CardContent>
                  <CardFooter>
                    <Button size="sm">Action</Button>
                  </CardFooter>
                </Card>
              </div>
            </ComponentShowcase>

            {/* ACCORDION */}
            <ComponentShowcase title="Accordion">
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="item-1">
                  <AccordionTrigger>Is it accessible?</AccordionTrigger>
                  <AccordionContent>
                    Yes. It adheres to the WAI-ARIA design pattern.
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="item-2">
                  <AccordionTrigger>Is it styled?</AccordionTrigger>
                  <AccordionContent>
                    Yes. It comes with default styles that match your design system.
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="item-3">
                  <AccordionTrigger>Is it animated?</AccordionTrigger>
                  <AccordionContent>
                    Yes. It has smooth expand/collapse animations.
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </ComponentShowcase>

            {/* COLLAPSIBLE */}
            <ComponentShowcase title="Collapsible">
              <Collapsible open={isCollapsibleOpen} onOpenChange={setIsCollapsibleOpen} className="space-y-2">
                <CollapsibleTrigger>
                  Toggle Content
                </CollapsibleTrigger>
                <div className="rounded-md border px-4 py-3 text-sm">Always visible content</div>
                <CollapsibleContent className="space-y-2">
                  <div className="rounded-md border px-4 py-3 text-sm">Hidden content 1</div>
                  <div className="rounded-md border px-4 py-3 text-sm">Hidden content 2</div>
                </CollapsibleContent>
              </Collapsible>
            </ComponentShowcase>

            {/* TABLES */}
            <ComponentShowcase title="Table">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">Michael Harrison</TableCell>
                    <TableCell className="text-muted-foreground">michael@example.com</TableCell>
                    <TableCell><StatusPill status="active" /></TableCell>
                    <TableCell className="text-right font-mono">$125,000</TableCell>
                    <TableCell><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Sarah Chen</TableCell>
                    <TableCell className="text-muted-foreground">sarah@example.com</TableCell>
                    <TableCell><StatusPill status="pending" /></TableCell>
                    <TableCell className="text-right font-mono">$89,500</TableCell>
                    <TableCell><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">David Thompson</TableCell>
                    <TableCell className="text-muted-foreground">david@example.com</TableCell>
                    <TableCell><StatusPill status="completed" /></TableCell>
                    <TableCell className="text-right font-mono">$45,200</TableCell>
                    <TableCell><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </ComponentShowcase>

            {/* DIALOGS & OVERLAYS */}
            <ComponentShowcase title="Dialogs, Sheets & Popovers">
              <div className="flex flex-wrap gap-3">
                {/* Dialog */}
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline">Open Dialog</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Dialog Title</DialogTitle>
                      <DialogDescription>This is a dialog description.</DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                      <p className="text-sm text-muted-foreground">Dialog content goes here.</p>
                    </div>
                    <DialogFooter>
                      <Button variant="outline">Cancel</Button>
                      <Button>Save</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                {/* Sheet */}
                <Sheet>
                  <SheetTrigger asChild>
                    <Button variant="outline">Open Sheet</Button>
                  </SheetTrigger>
                  <SheetContent>
                    <SheetHeader>
                      <SheetTitle>Sheet Title</SheetTitle>
                      <SheetDescription>This is a sheet description.</SheetDescription>
                    </SheetHeader>
                    <div className="py-4">
                      <p className="text-sm text-muted-foreground">Sheet content goes here.</p>
                    </div>
                    <SheetFooter>
                      <Button>Save Changes</Button>
                    </SheetFooter>
                  </SheetContent>
                </Sheet>

                {/* Alert Dialog */}
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive">Delete Item</Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This action cannot be undone. This will permanently delete your data.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction>Delete</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>

                {/* Popover */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline">Open Popover</Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80">
                    <div className="space-y-2">
                      <h4 className="font-medium">Popover Title</h4>
                      <p className="text-sm text-muted-foreground">This is popover content.</p>
                    </div>
                  </PopoverContent>
                </Popover>

                {/* Hover Card */}
                <HoverCard>
                  <HoverCardTrigger asChild>
                    <Button variant="link">Hover Me</Button>
                  </HoverCardTrigger>
                  <HoverCardContent className="w-80">
                    <div className="flex gap-4">
                      <Avatar><AvatarFallback>JB</AvatarFallback></Avatar>
                      <div className="space-y-1">
                        <h4 className="text-sm font-semibold">Jake Baird</h4>
                        <p className="text-sm text-muted-foreground">Hover card content here.</p>
                      </div>
                    </div>
                  </HoverCardContent>
                </HoverCard>

                {/* Tooltip */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline">Hover for Tooltip</Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>This is a tooltip</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </ComponentShowcase>

            {/* DROPDOWN MENU */}
            <ComponentShowcase title="Dropdown Menu">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline">
                    Open Menu <ChevronDown className="ml-2 h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56">
                  <DropdownMenuLabel>My Account</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem><User className="mr-2 h-4 w-4" />Profile</DropdownMenuItem>
                  <DropdownMenuItem><Settings className="mr-2 h-4 w-4" />Settings</DropdownMenuItem>
                  <DropdownMenuItem><Bell className="mr-2 h-4 w-4" />Notifications</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-destructive"><Trash className="mr-2 h-4 w-4" />Delete</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </ComponentShowcase>

            {/* ICONS */}
            <ComponentShowcase title="Icons (Lucide)">
              <div className="grid grid-cols-8 md:grid-cols-12 gap-4">
                {[
                  { icon: Home, name: "Home" },
                  { icon: User, name: "User" },
                  { icon: Users, name: "Users" },
                  { icon: Settings, name: "Settings" },
                  { icon: Bell, name: "Bell" },
                  { icon: Mail, name: "Mail" },
                  { icon: Calendar, name: "Calendar" },
                  { icon: Search, name: "Search" },
                  { icon: Plus, name: "Plus" },
                  { icon: X, name: "X" },
                  { icon: Check, name: "Check" },
                  { icon: CheckCircle, name: "CheckCircle" },
                  { icon: XCircle, name: "XCircle" },
                  { icon: AlertTriangle, name: "AlertTriangle" },
                  { icon: Info, name: "Info" },
                  { icon: FileText, name: "FileText" },
                  { icon: Folder, name: "Folder" },
                  { icon: Download, name: "Download" },
                  { icon: Upload, name: "Upload" },
                  { icon: Trash, name: "Trash" },
                  { icon: Edit, name: "Edit" },
                  { icon: Eye, name: "Eye" },
                  { icon: EyeOff, name: "EyeOff" },
                  { icon: Lock, name: "Lock" },
                  { icon: DollarSign, name: "DollarSign" },
                  { icon: CreditCard, name: "CreditCard" },
                  { icon: ShoppingCart, name: "ShoppingCart" },
                  { icon: Package, name: "Package" },
                  { icon: Truck, name: "Truck" },
                  { icon: Building2, name: "Building2" },
                  { icon: Briefcase, name: "Briefcase" },
                  { icon: Phone, name: "Phone" },
                  { icon: MapPin, name: "MapPin" },
                  { icon: Clock, name: "Clock" },
                  { icon: BarChart3, name: "BarChart3" },
                  { icon: TrendingUp, name: "TrendingUp" },
                ].map(({ icon: Icon, name }) => (
                  <Tooltip key={name}>
                    <TooltipTrigger asChild>
                      <div className="flex flex-col items-center gap-1 cursor-pointer">
                        <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center hover:bg-accent transition-colors">
                          <Icon className="h-5 w-5" />
                        </div>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>{name}</TooltipContent>
                  </Tooltip>
                ))}
              </div>
            </ComponentShowcase>

          </TabsContent>

          {/* ============================================================ */}
          {/* DESIGN TOKENS TAB */}
          {/* ============================================================ */}
          <TabsContent value="tokens" className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Light Theme Colors</CardTitle>
                  <CardDescription>HSL format CSS variables</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {Object.entries(designTokens.colors.light).map(([name, value]) => (
                    <div key={name} className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded border" style={{ backgroundColor: value }} />
                      <code className="text-xs flex-1">--{name}</code>
                      <span className="text-xs text-muted-foreground">{value}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Dark Theme Colors</CardTitle>
                  <CardDescription>HSL format CSS variables</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {Object.entries(designTokens.colors.dark).map(([name, value]) => (
                    <div key={name} className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded border" style={{ backgroundColor: value }} />
                      <code className="text-xs flex-1">--{name}</code>
                      <span className="text-xs text-muted-foreground">{value}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader><CardTitle>Typography</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  {Object.entries(designTokens.typography.fontFamily).map(([name, value]) => (
                    <div key={name} className="flex justify-between items-center">
                      <code className="text-sm">font-{name}</code>
                      <span className="text-sm text-muted-foreground">{value}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>Border Radius</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  {Object.entries(designTokens.borderRadius).map(([name, value]) => (
                    <div key={name} className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-primary" style={{ borderRadius: value }} />
                      <div>
                        <code className="text-sm">rounded-{name}</code>
                        <p className="text-xs text-muted-foreground">{value}</p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
            <Card>
              <CardHeader><CardTitle>Breakpoints</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
                  {Object.entries(designTokens.screens).map(([name, value]) => (
                    <div key={name} className="text-center">
                      <code className="text-sm font-bold">{name}</code>
                      <p className="text-xs text-muted-foreground">{value}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ============================================================ */}
          {/* CSS VARIABLES TAB */}
          {/* ============================================================ */}
          <TabsContent value="css" className="space-y-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>globals.css</CardTitle>
                  <CardDescription>Complete CSS file with all variables</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => copyToClipboard(globalsCss, "globals")}>
                  {copiedCode === "globals" ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                  Copy
                </Button>
              </CardHeader>
              <CardContent>
                <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-xs max-h-[600px] overflow-y-auto">
                  <code>{globalsCss}</code>
                </pre>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ============================================================ */}
          {/* COMPONENT CATALOG TAB */}
          {/* ============================================================ */}
          <TabsContent value="catalog" className="space-y-6">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              <ComponentTree data={formControls} title="Form Controls (18)" />
              <ComponentTree data={layoutComponents} title="Layout Components (7)" />
              <ComponentTree data={dialogComponents} title="Dialogs & Overlays (7)" />
              <ComponentTree data={navigationComponents} title="Navigation & Menus (4)" />
              <ComponentTree data={dataDisplayComponents} title="Data Display (8)" />
              <ComponentTree data={feedbackComponents} title="Feedback & Status (7)" />
            </div>
            <Card>
              <CardHeader><CardTitle>Button Variants Reference</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm font-medium mb-2">Variants</p>
                  <div className="space-y-2">
                    {Object.entries(buttonVariants.variants).map(([name, value]) => (
                      <div key={name} className="flex items-center gap-3">
                        <Badge>{name}</Badge>
                        <code className="text-xs text-muted-foreground">{value}</code>
                      </div>
                    ))}
                  </div>
                </div>
                <Separator />
                <div>
                  <p className="text-sm font-medium mb-2">Sizes</p>
                  <div className="space-y-2">
                    {Object.entries(buttonVariants.sizes).map(([name, value]) => (
                      <div key={name} className="flex items-center gap-3">
                        <Badge variant="outline">{name}</Badge>
                        <code className="text-xs text-muted-foreground">{value}</code>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ============================================================ */}
          {/* CODE PATTERNS TAB */}
          {/* ============================================================ */}
          <TabsContent value="patterns" className="space-y-6">
            {Object.entries(codeExamples).map(([name, code]) => (
              <Card key={name}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-lg capitalize">{name}</CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => copyToClipboard(code, name)}>
                    {copiedCode === name ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </CardHeader>
                <CardContent>
                  <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-xs">
                    <code>{code}</code>
                  </pre>
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        </Tabs>

        {/* Summary Section */}
        <section className="space-y-6">
          <h2 className="text-2xl font-bold font-serif border-b pb-2">Summary</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle>Component Counts</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {Object.entries(summary.totalComponents).map(([name, count]) => (
                    <div key={name} className="flex justify-between items-center">
                      <span className="capitalize">{name.replace(/([A-Z])/g, ' $1').trim()}</span>
                      <Badge>{count}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Key Dependencies</CardTitle></CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {summary.keyDependencies.map((dep) => (
                    <Badge key={dep} variant="outline" className="text-xs">{dep}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Footer */}
        <div className="text-center text-sm text-muted-foreground pt-8 border-t">
          <p>Teeem Design System</p>
          <p className="mt-1">Last updated: December 2024</p>
        </div>
      </div>
    </TooltipProvider>
  );
}
