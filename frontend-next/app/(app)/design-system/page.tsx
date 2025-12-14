"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import {
  AlertCircle,
  CheckCircle2,
  Info,
  AlertTriangle,
  MapPin,
  DollarSign,
  Plus,
  Search,
  LayoutGrid,
  List,
  TrendingUp,
  Clock,
  Calendar,
  User,
  Building2,
  Phone,
  Mail,
  FileText,
  Settings,
  ChevronRight,
} from "lucide-react";

// Sample Kanban data
const PIPELINE_COLUMNS = [
  { status: "new", label: "New", color: "text-gray-700", bgColor: "bg-gray-100", borderColor: "#6b7280" },
  { status: "contacted", label: "Contacted", color: "text-blue-700", bgColor: "bg-blue-100", borderColor: "#3b82f6" },
  { status: "qualified", label: "Qualified", color: "text-purple-700", bgColor: "bg-purple-100", borderColor: "#a855f7" },
  { status: "proposal", label: "Proposal", color: "text-yellow-700", bgColor: "bg-yellow-100", borderColor: "#eab308" },
  { status: "contract_sent", label: "Contract Sent", color: "text-orange-700", bgColor: "bg-orange-100", borderColor: "#f97316" },
  { status: "won", label: "Won", color: "text-green-700", bgColor: "bg-green-100", borderColor: "#22c55e" },
  { status: "lost", label: "Lost", color: "text-red-700", bgColor: "bg-red-100", borderColor: "#ef4444" },
];

const SAMPLE_LEADS = [
  { id: 1, title: "32 McIlwraith Ave Renovation", client: "Smith Family", suburb: "Balmoral", value: 450000, status: "new" },
  { id: 2, title: "New Build - Surfers Paradise", client: "Johnson Corp", suburb: "Surfers Paradise", value: 1200000, status: "new" },
  { id: 3, title: "Kitchen Extension", client: "Williams", suburb: "Coorparoo", value: 85000, status: "contacted" },
  { id: 4, title: "Duplex Development", client: "Horizon Invest", suburb: "Carindale", value: 890000, status: "qualified" },
  { id: 5, title: "Heritage Renovation", client: "Heritage Trust", suburb: "New Farm", value: 320000, status: "proposal" },
  { id: 6, title: "Commercial Fitout", client: "Tech Solutions", suburb: "Fortitude Valley", value: 175000, status: "contract_sent" },
  { id: 7, title: "Granny Flat Build", client: "Peters Family", suburb: "Mt Gravatt", value: 120000, status: "won" },
];

// Kanban Card Component
function KanbanCard({ lead }: { lead: typeof SAMPLE_LEADS[0] }) {
  const formatCurrency = (value: number) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value}`;
  };

  return (
    <Card className="cursor-pointer hover:shadow-md transition-shadow w-full">
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-medium text-sm line-clamp-2">{lead.title}</h3>
        </div>
        <p className="text-xs text-muted-foreground">{lead.client}</p>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin className="h-3 w-3" />
          <span className="truncate">{lead.suburb}</span>
        </div>
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-1 text-xs font-medium text-green-600 dark:text-green-400">
            <DollarSign className="h-3 w-3" />
            {formatCurrency(lead.value)}
          </div>
          <span className="text-[10px] text-muted-foreground font-mono">
            LEAD-{String(lead.id).padStart(3, "0")}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

// Kanban Pipeline Component
function KanbanPipelineDemo() {
  const getLeadsByStatus = (status: string) => SAMPLE_LEADS.filter(l => l.status === status);
  const getTotalValue = (status: string) =>
    SAMPLE_LEADS.filter(l => l.status === status).reduce((sum, l) => sum + l.value, 0);

  const formatCurrency = (value: number) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value}`;
  };

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {PIPELINE_COLUMNS.map((col) => {
        const columnLeads = getLeadsByStatus(col.status);
        const totalValue = getTotalValue(col.status);

        return (
          <div key={col.status} className="flex-shrink-0 w-[240px]">
            {/* Column Header */}
            <div
              className={cn("rounded-t-lg px-2 py-2 border-b-2", col.bgColor)}
              style={{ borderBottomColor: col.borderColor }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={cn("font-medium text-sm", col.color)}>
                    {col.label}
                  </span>
                  <span className="text-xs bg-background px-1.5 py-0.5 rounded-full font-mono">
                    {columnLeads.length}
                  </span>
                </div>
                <span className="text-xs font-medium text-muted-foreground">
                  {formatCurrency(totalValue)}
                </span>
              </div>
            </div>

            {/* Column Content */}
            <div className="min-h-[200px] bg-muted/30 rounded-b-lg p-2 space-y-2">
              {columnLeads.map((lead) => (
                <KanbanCard key={lead.id} lead={lead} />
              ))}
              {columnLeads.length === 0 && (
                <div className="flex items-center justify-center h-20 text-xs text-muted-foreground">
                  No leads
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Stats Card Component
function StatsCardDemo() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Total Pipeline</span>
          </div>
          <div className="text-2xl font-bold font-mono mt-1">$3.24M</div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-blue-500" />
            <span className="text-xs text-muted-foreground">Active Leads</span>
          </div>
          <div className="text-2xl font-bold font-mono text-blue-600 mt-1">6</div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <span className="text-xs text-muted-foreground">Won</span>
          </div>
          <div className="text-2xl font-bold font-mono text-green-600 mt-1">1</div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Total Value</span>
          </div>
          <div className="text-2xl font-bold font-mono mt-1">$3.36M</div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function DesignSystemPage() {
  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight font-serif">Teeem Design System</h1>
        <p className="text-muted-foreground mt-2">
          Component library and design guidelines for the Teeem construction management platform.
          Built with Next.js 15, React 19, Tailwind CSS, and shadcn/ui.
        </p>
      </div>

      <Tabs defaultValue="kanban" className="space-y-6">
        <TabsList>
          <TabsTrigger value="kanban">Kanban & Pipeline</TabsTrigger>
          <TabsTrigger value="cards">Cards & Stats</TabsTrigger>
          <TabsTrigger value="buttons">Buttons & Badges</TabsTrigger>
          <TabsTrigger value="forms">Forms & Inputs</TabsTrigger>
          <TabsTrigger value="tables">Tables</TabsTrigger>
          <TabsTrigger value="feedback">Feedback</TabsTrigger>
          <TabsTrigger value="colors">Colors</TabsTrigger>
        </TabsList>

        {/* Kanban & Pipeline Tab */}
        <TabsContent value="kanban" className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>Kanban Pipeline</CardTitle>
              <CardDescription>
                Drag-and-drop pipeline view for leads, jobs, and workflow stages.
                Cards are 240px wide with colored status headers.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <KanbanPipelineDemo />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Pipeline Column Anatomy</CardTitle>
              <CardDescription>
                Structure of a single pipeline column with header and card container.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-8">
                {/* Annotated column */}
                <div className="w-[280px]">
                  <div className="space-y-2">
                    <div className="text-xs text-muted-foreground">Column Header (rounded-t-lg, px-2, border-b-2)</div>
                    <div className="rounded-t-lg px-2 py-2 border-b-2 bg-blue-100" style={{ borderBottomColor: "#3b82f6" }}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm text-blue-700">Contacted</span>
                          <span className="text-xs bg-background px-1.5 py-0.5 rounded-full font-mono">3</span>
                        </div>
                        <span className="text-xs font-medium text-muted-foreground">$245K</span>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">Card Container (bg-muted/30, p-2, min-h-[500px])</div>
                    <div className="bg-muted/30 rounded-b-lg p-2 space-y-2">
                      <div className="text-xs text-muted-foreground mb-2">Lead Card (gap-2 spacing)</div>
                      <Card className="cursor-pointer hover:shadow-md transition-shadow">
                        <CardContent className="p-3 space-y-2">
                          <h3 className="font-medium text-sm">Kitchen Extension</h3>
                          <p className="text-xs text-muted-foreground">Williams</p>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <MapPin className="h-3 w-3" />
                            <span>Coorparoo</span>
                          </div>
                          <div className="flex items-center justify-between pt-1">
                            <div className="flex items-center gap-1 text-xs font-medium text-green-600">
                              <DollarSign className="h-3 w-3" />
                              $85K
                            </div>
                            <span className="text-[10px] text-muted-foreground font-mono">LEAD-003</span>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                </div>

                {/* Specs */}
                <div className="space-y-4 flex-1">
                  <h4 className="font-medium">Column Specifications</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Column Width</p>
                      <p className="font-mono">280px (flex-shrink-0)</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Column Gap</p>
                      <p className="font-mono">gap-4 (16px)</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Card Padding</p>
                      <p className="font-mono">p-3 (12px)</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Card Gap</p>
                      <p className="font-mono">space-y-2 (8px)</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Header Border</p>
                      <p className="font-mono">border-b-2</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Min Height</p>
                      <p className="font-mono">min-h-[500px]</p>
                    </div>
                  </div>

                  <h4 className="font-medium pt-4">Status Colors</h4>
                  <div className="space-y-2">
                    {PIPELINE_COLUMNS.map(col => (
                      <div key={col.status} className="flex items-center gap-3">
                        <div className="w-4 h-4 rounded" style={{ backgroundColor: col.borderColor }} />
                        <span className="text-sm w-28">{col.label}</span>
                        <code className="text-xs text-muted-foreground">{col.borderColor}</code>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>View Mode Toggle</CardTitle>
              <CardDescription>
                Switch between Pipeline (Kanban) and Table views.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Button variant="default" size="sm">
                  <LayoutGrid className="h-4 w-4 mr-1" />
                  Pipeline
                </Button>
                <Button variant="outline" size="sm">
                  <List className="h-4 w-4 mr-1" />
                  Table
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Cards & Stats Tab */}
        <TabsContent value="cards" className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>Stats Cards</CardTitle>
              <CardDescription>
                Summary statistics displayed at the top of list pages.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <StatsCardDemo />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Info Cards</CardTitle>
              <CardDescription>
                Standard cards for displaying grouped information.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <User className="h-5 w-5 text-blue-600" />
                    </div>
                    <CardTitle className="text-base">Contact Details</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span>john@example.com</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>0412 345 678</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-100 rounded-lg">
                      <Building2 className="h-5 w-5 text-green-600" />
                    </div>
                    <CardTitle className="text-base">Site Details</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span>32 McIlwraith Ave</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span>Lot 12 RP123456</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-100 rounded-lg">
                      <Calendar className="h-5 w-5 text-purple-600" />
                    </div>
                    <CardTitle className="text-base">Timeline</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Start</span>
                    <span>15 Jan 2025</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Duration</span>
                    <span>12 weeks</span>
                  </div>
                </CardContent>
              </Card>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Buttons & Badges Tab */}
        <TabsContent value="buttons" className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>Button Variants</CardTitle>
              <CardDescription>Primary actions, secondary actions, and destructive operations.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-3">
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Primary Action
                </Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="outline">Outline</Button>
                <Button variant="ghost">Ghost</Button>
                <Button variant="destructive">Delete</Button>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button size="sm">Small</Button>
                <Button size="default">Default</Button>
                <Button size="lg">Large</Button>
                <Button size="icon">
                  <Settings className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Badges & Status Pills</CardTitle>
              <CardDescription>Status indicators and labels.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Badge>Default</Badge>
                <Badge variant="secondary">Secondary</Badge>
                <Badge variant="outline">Outline</Badge>
                <Badge variant="destructive">Destructive</Badge>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge className="bg-gray-100 text-gray-800">New</Badge>
                <Badge className="bg-blue-100 text-blue-800">Contacted</Badge>
                <Badge className="bg-purple-100 text-purple-800">Qualified</Badge>
                <Badge className="bg-yellow-100 text-yellow-800">Proposal</Badge>
                <Badge className="bg-orange-100 text-orange-800">Contract Sent</Badge>
                <Badge className="bg-green-100 text-green-800">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Won
                </Badge>
                <Badge className="bg-red-100 text-red-800">Lost</Badge>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Forms & Inputs Tab */}
        <TabsContent value="forms" className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>Form Controls</CardTitle>
              <CardDescription>Input fields, selects, checkboxes, and switches.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="text">Text Input</Label>
                  <Input id="text" placeholder="Enter text..." />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="search">Search Input</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input id="search" placeholder="Search..." className="pl-9" />
                  </div>
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
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox id="terms" />
                    <Label htmlFor="terms">Accept terms</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch id="notifications" />
                    <Label htmlFor="notifications">Enable notifications</Label>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tables Tab */}
        <TabsContent value="tables" className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>Data Table</CardTitle>
              <CardDescription>Standard table for listing data with actions.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Lead</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {SAMPLE_LEADS.slice(0, 4).map((lead) => (
                    <TableRow key={lead.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{lead.title}</p>
                          <p className="text-xs text-muted-foreground font-mono">LEAD-{String(lead.id).padStart(3, "0")}</p>
                        </div>
                      </TableCell>
                      <TableCell>{lead.client}</TableCell>
                      <TableCell>{lead.suburb}</TableCell>
                      <TableCell className="font-mono">${(lead.value / 1000).toFixed(0)}K</TableCell>
                      <TableCell>
                        <Badge className={cn(
                          PIPELINE_COLUMNS.find(c => c.status === lead.status)?.bgColor,
                          PIPELINE_COLUMNS.find(c => c.status === lead.status)?.color
                        )}>
                          {PIPELINE_COLUMNS.find(c => c.status === lead.status)?.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm">
                          View
                          <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Feedback Tab */}
        <TabsContent value="feedback" className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>Alerts</CardTitle>
              <CardDescription>Contextual feedback messages.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>Information</AlertTitle>
                <AlertDescription>This is an informational message.</AlertDescription>
              </Alert>
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>Something went wrong. Please try again.</AlertDescription>
              </Alert>
              <Alert className="border-green-200 bg-green-50 text-green-800">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertTitle className="text-green-800">Success</AlertTitle>
                <AlertDescription className="text-green-700">Your changes have been saved.</AlertDescription>
              </Alert>
              <Alert className="border-yellow-200 bg-yellow-50 text-yellow-800">
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
                <AlertTitle className="text-yellow-800">Warning</AlertTitle>
                <AlertDescription className="text-yellow-700">Please review before proceeding.</AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Loading States</CardTitle>
              <CardDescription>Spinners and loading indicators.</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center gap-8">
              <div className="flex flex-col items-center gap-2">
                <Spinner />
                <span className="text-xs text-muted-foreground">Default</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                <span className="text-xs text-muted-foreground">Spinner</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <Button disabled>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Loading...
                </Button>
                <span className="text-xs text-muted-foreground">Button Loading</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Colors Tab */}
        <TabsContent value="colors" className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>Status Colors</CardTitle>
              <CardDescription>Pipeline and workflow status color palette.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {PIPELINE_COLUMNS.map(col => (
                  <div key={col.status} className="space-y-2">
                    <div
                      className="h-16 rounded-lg flex items-end p-2"
                      style={{ backgroundColor: col.borderColor }}
                    >
                      <span className="text-white text-sm font-medium">{col.label}</span>
                    </div>
                    <code className="text-xs text-muted-foreground block">{col.borderColor}</code>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Semantic Colors</CardTitle>
              <CardDescription>Colors for success, warning, error states.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <div className="h-16 rounded-lg bg-green-500 flex items-end p-2">
                    <span className="text-white text-sm font-medium">Success</span>
                  </div>
                  <code className="text-xs text-muted-foreground">#22c55e</code>
                </div>
                <div className="space-y-2">
                  <div className="h-16 rounded-lg bg-yellow-500 flex items-end p-2">
                    <span className="text-white text-sm font-medium">Warning</span>
                  </div>
                  <code className="text-xs text-muted-foreground">#eab308</code>
                </div>
                <div className="space-y-2">
                  <div className="h-16 rounded-lg bg-red-500 flex items-end p-2">
                    <span className="text-white text-sm font-medium">Error</span>
                  </div>
                  <code className="text-xs text-muted-foreground">#ef4444</code>
                </div>
                <div className="space-y-2">
                  <div className="h-16 rounded-lg bg-blue-500 flex items-end p-2">
                    <span className="text-white text-sm font-medium">Info</span>
                  </div>
                  <code className="text-xs text-muted-foreground">#3b82f6</code>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
