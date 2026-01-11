"use client";

import * as React from "react";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Pill } from "@/components/ui/pill";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Moon, Sun, Trash2 } from "lucide-react";
import { useTheme } from "next-themes";

export default function Home() {
  const { resolvedTheme, setTheme } = useTheme();
  const [showDeleteDialog, setShowDeleteDialog] = React.useState(false);

  return (
    <div className="h-screen overflow-auto">
    <div className="min-h-screen p-8 space-y-8 max-w-6xl mx-auto pb-32">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-serif">Brand Guidelines</h1>
          <p className="text-sm text-text-secondary mt-1">
            Comprehensive design system documentation for Teeem.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => window.open('/admin', '_self')}>
            View Admin Template
          </Button>
          <Button variant="outline" size="icon" onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}>
            <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          </Button>
        </div>
      </div>

      <Separator />

      {/* Typography */}
      <section className="space-y-6">
        <div>
          <h3 className="text-xl font-medium mb-1">Typography</h3>
          <p className="text-sm text-text-secondary">Font families, sizes, and usage guidelines.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Primary Font */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Primary Font: Geist Sans</CardTitle>
              <CardDescription>Used for all body text, UI elements, and general content.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <p className="text-[32px] font-medium">Aa Bb Cc</p>
                <p className="text-[21px]">The quick brown fox jumps</p>
                <p className="text-[14px]">The quick brown fox jumps over the lazy dog</p>
                <p className="text-[11px]">The quick brown fox jumps over the lazy dog</p>
              </div>
              <div className="pt-4 border-t space-y-1">
                <p className="text-[11px] text-muted-foreground">CSS Variable</p>
                <code className="text-xs bg-secondary px-2 py-1">--font-geist-sans</code>
              </div>
            </CardContent>
          </Card>

          {/* Monospace Font */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Monospace: Geist Mono</CardTitle>
              <CardDescription>Used for numbers, currency, code, and technical content.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 font-mono">
                <p className="text-[32px] font-medium">0123456789</p>
                <p className="text-[21px]">$45,231.89</p>
                <p className="text-[14px]">INV-2024-001 | PO-2024-0042</p>
                <p className="text-[11px]">const total = subtotal + tax;</p>
              </div>
              <div className="pt-4 border-t space-y-1">
                <p className="text-[11px] text-muted-foreground">CSS Variable</p>
                <code className="text-xs bg-secondary px-2 py-1">--font-geist-mono</code>
              </div>
            </CardContent>
          </Card>

          {/* Serif Font */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Serif: Hedvig Letters Serif</CardTitle>
              <CardDescription>Used sparingly for headings and brand elements.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 font-serif">
                <p className="text-[32px] font-bold">Teeem</p>
                <p className="text-[21px]">Dashboard Overview</p>
                <p className="text-[14px]">Financial Reports & Analytics</p>
              </div>
              <div className="pt-4 border-t space-y-1">
                <p className="text-[11px] text-muted-foreground">CSS Variable</p>
                <code className="text-xs bg-secondary px-2 py-1">--font-hedvig-serif</code>
              </div>
            </CardContent>
          </Card>

          {/* Font Sizes */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Font Size Scale</CardTitle>
              <CardDescription>Standard sizes used throughout the system.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-baseline justify-between border-b pb-2">
                  <span className="text-[32px]">32px</span>
                  <span className="text-[11px] text-muted-foreground">Large headings</span>
                </div>
                <div className="flex items-baseline justify-between border-b pb-2">
                  <span className="text-[21px]">21px</span>
                  <span className="text-[11px] text-muted-foreground">Document titles, totals</span>
                </div>
                <div className="flex items-baseline justify-between border-b pb-2">
                  <span className="text-[14px]">14px</span>
                  <span className="text-[11px] text-muted-foreground">Body text (default)</span>
                </div>
                <div className="flex items-baseline justify-between border-b pb-2">
                  <span className="text-[12px]">12px</span>
                  <span className="text-[11px] text-muted-foreground">Small text, badges</span>
                </div>
                <div className="flex items-baseline justify-between border-b pb-2">
                  <span className="text-[11px]">11px</span>
                  <span className="text-[11px] text-muted-foreground">Labels, invoice body</span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-[10px]">10px</span>
                  <span className="text-[11px] text-muted-foreground">Small pills, tags</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <Separator />

      {/* Colors */}
      <section className="space-y-6">
        <div>
          <h3 className="text-xl font-medium mb-1">Color System</h3>
          <p className="text-sm text-text-secondary">Core palette with light and dark mode support.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Text Colors */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Text Colors</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-foreground border" />
                  <div>
                    <p className="text-sm font-medium">Foreground</p>
                    <p className="text-[11px] text-muted-foreground">Primary text</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#606060] border" />
                  <div>
                    <p className="text-sm font-medium">#606060</p>
                    <p className="text-[11px] text-muted-foreground">Descriptions, secondary</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#878787] border" />
                  <div>
                    <p className="text-sm font-medium">#878787</p>
                    <p className="text-[11px] text-muted-foreground">Labels, muted text</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Background Colors */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Backgrounds</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-background border" />
                  <div>
                    <p className="text-sm font-medium">Background</p>
                    <p className="text-[11px] text-muted-foreground">Light: #fff / Dark: #0d0d0d</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#F2F1EF] dark:bg-[#1D1D1D] border" />
                  <div>
                    <p className="text-sm font-medium">Secondary</p>
                    <p className="text-[11px] text-muted-foreground">#F2F1EF / #1D1D1D</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-card border" />
                  <div>
                    <p className="text-sm font-medium">Card</p>
                    <p className="text-[11px] text-muted-foreground">Elevated surfaces</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Status Colors */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Status Colors</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#DCFCE7] dark:bg-[#14532D] border" />
                  <div>
                    <p className="text-sm font-medium">Success</p>
                    <p className="text-[11px] text-muted-foreground">Completed, active</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#FEF3C7] dark:bg-[#78350F] border" />
                  <div>
                    <p className="text-sm font-medium">Warning</p>
                    <p className="text-[11px] text-muted-foreground">Pending, attention</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#FEE2E2] dark:bg-[#7F1D1D] border" />
                  <div>
                    <p className="text-sm font-medium">Error</p>
                    <p className="text-[11px] text-muted-foreground">Failed, destructive</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#DBEAFE] dark:bg-[#1E3A8A] border" />
                  <div>
                    <p className="text-sm font-medium">Info</p>
                    <p className="text-[11px] text-muted-foreground">Processing, info</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <Separator />

      {/* Corner Radius */}
      <section className="space-y-6">
        <div>
          <h3 className="text-xl font-medium mb-1">Corner Radius</h3>
          <p className="text-sm text-text-secondary">All UI elements use square corners for a sharp, professional look.</p>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="text-center space-y-3">
                <div className="w-20 h-20 bg-primary mx-auto" />
                <div>
                  <p className="text-sm font-medium">Buttons</p>
                  <p className="text-[11px] text-muted-foreground">rounded-none</p>
                </div>
              </div>
              <div className="text-center space-y-3">
                <div className="w-20 h-20 border-2 border-border mx-auto" />
                <div>
                  <p className="text-sm font-medium">Cards</p>
                  <p className="text-[11px] text-muted-foreground">rounded-none</p>
                </div>
              </div>
              <div className="text-center space-y-3">
                <div className="w-20 h-6 bg-[#F2F1EF] dark:bg-[#1D1D1D] mx-auto" />
                <div>
                  <p className="text-sm font-medium">Pills/Tags</p>
                  <p className="text-[11px] text-muted-foreground">rounded-none</p>
                </div>
              </div>
              <div className="text-center space-y-3">
                <div className="w-20 h-10 border border-border mx-auto" />
                <div>
                  <p className="text-sm font-medium">Inputs</p>
                  <p className="text-[11px] text-muted-foreground">rounded-none</p>
                </div>
              </div>
            </div>
            <div className="mt-6 pt-6 border-t">
              <p className="text-[11px] text-muted-foreground">CSS Variable</p>
              <code className="text-xs bg-secondary px-2 py-1">--radius: 0rem</code>
            </div>
          </CardContent>
        </Card>
      </section>

      <Separator />

      {/* Spacing */}
      <section className="space-y-6">
        <div>
          <h3 className="text-xl font-medium mb-1">Spacing System</h3>
          <p className="text-sm text-text-secondary">Consistent spacing using Tailwind's scale.</p>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-1 h-6 bg-primary" />
                <span className="text-sm w-16">4px</span>
                <span className="text-[11px] text-muted-foreground">gap-1, p-1, m-1</span>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-2 h-6 bg-primary" />
                <span className="text-sm w-16">8px</span>
                <span className="text-[11px] text-muted-foreground">gap-2, p-2, m-2</span>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-3 h-6 bg-primary" />
                <span className="text-sm w-16">12px</span>
                <span className="text-[11px] text-muted-foreground">gap-3, p-3, m-3</span>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-4 h-6 bg-primary" />
                <span className="text-sm w-16">16px</span>
                <span className="text-[11px] text-muted-foreground">gap-4, p-4, m-4</span>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-6 h-6 bg-primary" />
                <span className="text-sm w-16">24px</span>
                <span className="text-[11px] text-muted-foreground">gap-6, p-6, m-6</span>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-8 h-6 bg-primary" />
                <span className="text-sm w-16">32px</span>
                <span className="text-[11px] text-muted-foreground">gap-8, p-8, m-8</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <Separator />

      {/* Document Templates */}
      <section className="space-y-6">
        <div>
          <h3 className="text-xl font-medium mb-1">Document Templates</h3>
          <p className="text-sm text-text-secondary">Invoice and Purchase Order specifications.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Page Format</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex justify-between py-2 border-b">
                  <span className="text-sm">Format</span>
                  <span className="text-sm font-mono">A4</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-sm">Width</span>
                  <span className="text-sm font-mono">595px (72 DPI)</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-sm">Height</span>
                  <span className="text-sm font-mono">842px (72 DPI)</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-sm">Padding</span>
                  <span className="text-sm font-mono">32px (p-8)</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-sm">Print Width</span>
                  <span className="text-sm font-mono">210mm × 297mm</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Document Typography</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex justify-between py-2 border-b">
                  <span className="text-sm">Title</span>
                  <span className="text-sm font-mono">21px medium</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-sm">Labels</span>
                  <span className="text-sm font-mono">11px #878787</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-sm">Body Text</span>
                  <span className="text-sm font-mono">11px foreground</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-sm">Amounts</span>
                  <span className="text-sm font-mono">11px mono</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-sm">Total</span>
                  <span className="text-sm font-mono">21px mono medium</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="text-lg">Line Items Grid</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border">
                <div className="grid grid-cols-[1.5fr_15%_15%_15%] gap-4 p-3 bg-secondary text-[11px] text-muted-foreground">
                  <span>Description (1.5fr)</span>
                  <span className="text-right">Price (15%)</span>
                  <span className="text-right">Qty (15%)</span>
                  <span className="text-right">Total (15%)</span>
                </div>
                <div className="grid grid-cols-[1.5fr_15%_15%_15%] gap-4 p-3 border-t text-[11px]">
                  <span>Example Line Item</span>
                  <span className="text-right font-mono">$100.00</span>
                  <span className="text-right font-mono">2</span>
                  <span className="text-right font-mono">$200.00</span>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground mt-3">
                Grid template: <code className="bg-secondary px-1">grid-cols-[1.5fr_15%_15%_15%]</code>
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      <Separator />

      {/* Components */}
      <section className="space-y-6">
        <div>
          <h3 className="text-xl font-medium mb-1">Component Guidelines</h3>
          <p className="text-sm text-text-secondary">Key UI components and their usage.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Buttons</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Button>Primary</Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="outline">Outline</Button>
                <Button variant="ghost">Ghost</Button>
                <Button variant="destructive">Destructive</Button>
              </div>
              <div className="pt-4 border-t text-[11px] text-muted-foreground space-y-1">
                <p>Height: 36px (h-9)</p>
                <p>Padding: 16px horizontal (px-4)</p>
                <p>Font: 14px medium</p>
                <p>Corners: Square (rounded-none)</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Pills & Tags</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Pill>Default</Pill>
                <Pill variant="success">Success</Pill>
                <Pill variant="warning">Warning</Pill>
                <Pill variant="error">Error</Pill>
                <Pill variant="info">Info</Pill>
              </div>
              <div className="pt-4 border-t text-[11px] text-muted-foreground space-y-1">
                <p>Font: 12px (text-xs)</p>
                <p>Padding: 10px × 4px</p>
                <p>Corners: Square (rounded-none)</p>
                <p>Background: #F2F1EF (light) / #1D1D1D (dark)</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Badges</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Badge>Default</Badge>
                <Badge variant="secondary">Secondary</Badge>
                <Badge variant="outline">Outline</Badge>
                <Badge variant="tag">Tag</Badge>
              </div>
              <div className="pt-4 border-t text-[11px] text-muted-foreground space-y-1">
                <p>Font: 12px semibold</p>
                <p>Padding: 10px × 2px</p>
                <p>Tag variant uses #878787 text</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Cards</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="border p-4 bg-card">
                <p className="text-sm font-medium">Card Title</p>
                <p className="text-[11px] text-[#606060]">Card description text</p>
              </div>
              <div className="pt-4 border-t text-[11px] text-muted-foreground space-y-1">
                <p>Border: 1px border-border</p>
                <p>Padding: 24px (p-6)</p>
                <p>Title: 14px medium</p>
                <p>Description: #606060</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <Separator />

      {/* Tables */}
      <section className="space-y-6">
        <div>
          <h3 className="text-xl font-medium mb-1">Tables</h3>
          <p className="text-sm text-text-secondary">Data table specifications and styling.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Table Example</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-mono">INV-2024-001</TableCell>
                  <TableCell><Pill variant="success" size="sm">Paid</Pill></TableCell>
                  <TableCell>Acme Corporation</TableCell>
                  <TableCell className="text-right font-mono">$1,200.00</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-mono">INV-2024-002</TableCell>
                  <TableCell><Pill variant="warning" size="sm">Pending</Pill></TableCell>
                  <TableCell>Globex Inc.</TableCell>
                  <TableCell className="text-right font-mono">$3,450.00</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-mono">INV-2024-003</TableCell>
                  <TableCell><Pill variant="error" size="sm">Overdue</Pill></TableCell>
                  <TableCell>Initech LLC</TableCell>
                  <TableCell className="text-right font-mono">$890.00</TableCell>
                </TableRow>
              </TableBody>
            </Table>
            <div className="pt-4 border-t text-[11px] text-muted-foreground space-y-2">
              <p className="font-medium text-foreground text-xs mb-2">Typography & Sizing</p>
              <p><strong>Table Headers:</strong> 14px, uppercase, font-medium (500), letter-spacing 0.05em</p>
              <p><strong>Cascading Headers:</strong> 13px, bold (700)</p>
              <p><strong>Table Cells:</strong> 13px, py-0.25 (1px vertical padding), px-1.5</p>
              <p><strong>Amounts:</strong> 13px, font-mono, text-right</p>
              <p><strong>IDs/Codes:</strong> 13px, font-mono</p>

              <p className="font-medium text-foreground text-xs mt-4 mb-2">Layout & Spacing</p>
              <p><strong>Table Layout:</strong> tableLayout: 'auto' (fills container width)</p>
              <p><strong>Page Padding:</strong> py-6 px-4 (24px vertical, 16px horizontal)</p>
              <p><strong>Column Width:</strong> Columns auto-expand to fill available space</p>

              <p className="font-medium text-foreground text-xs mt-4 mb-2">Action Buttons</p>
              <p><strong>Variant:</strong> ghost (no border, no background)</p>
              <p><strong>Size:</strong> h-6 w-6 (24px square)</p>
              <p><strong>Icons:</strong> h-4 w-4 (16px), Edit (Pencil) + Delete (Trash) only</p>
              <p><strong>Hover:</strong> bg-gray-100, delete shows red text</p>
            </div>
          </CardContent>
        </Card>
      </section>

      <Separator />

      {/* CSS Variables Reference */}
      <section className="space-y-6">
        <div>
          <h3 className="text-xl font-medium mb-1">CSS Variables Reference</h3>
          <p className="text-sm text-text-secondary">Complete list of design tokens.</p>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2 text-[11px] font-mono">
              <div className="space-y-2">
                <p className="text-muted-foreground font-sans text-xs font-medium mb-3">Layout</p>
                <p>--radius: 0rem</p>
                <p>--font-geist-sans</p>
                <p>--font-geist-mono</p>
                <p>--font-hedvig-serif</p>
              </div>
              <div className="space-y-2">
                <p className="text-muted-foreground font-sans text-xs font-medium mb-3">Light Mode</p>
                <p>--background: 0, 0%, 100%</p>
                <p>--foreground: 0, 0%, 7%</p>
                <p>--border: 45, 5%, 85%</p>
                <p>--muted-foreground: 0, 0%, 38%</p>
              </div>
              <div className="space-y-2 mt-4">
                <p className="text-muted-foreground font-sans text-xs font-medium mb-3">Dark Mode</p>
                <p>--background: 0, 0%, 5%</p>
                <p>--foreground: 0, 0%, 98%</p>
                <p>--border: 0, 0%, 11%</p>
                <p>--muted-foreground: 0, 0%, 38%</p>
              </div>
              <div className="space-y-2 mt-4">
                <p className="text-muted-foreground font-sans text-xs font-medium mb-3">Semantic Colors</p>
                <p>--primary: 240 5.9% 10%</p>
                <p>--secondary: 40, 11%, 89%</p>
                <p>--destructive: 0 84.2% 60.2%</p>
                <p>--accent: 40, 10%, 94%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <Separator />

      {/* Features */}
      <section className="space-y-6">
        <div>
          <h3 className="text-xl font-medium mb-1">Features & Components</h3>
          <p className="text-sm text-text-secondary">Key application features and their design patterns.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {/* Invoice */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Invoice</CardTitle>
              <CardDescription>Professional invoice generation</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-[11px]">
              <div className="space-y-1">
                <p className="text-muted-foreground">Key Elements</p>
                <ul className="space-y-1 text-foreground">
                  <li>• Invoice number, issue date, due date</li>
                  <li>• From/To address blocks</li>
                  <li>• Line items with description, qty, price, total</li>
                  <li>• Summary with subtotal, VAT/tax, discount, total</li>
                  <li>• Payment details and notes</li>
                </ul>
              </div>
              <div className="pt-2 border-t space-y-1">
                <p className="text-muted-foreground">Format</p>
                <p>A4 (595×842px) • 11px body • 21px totals</p>
              </div>
            </CardContent>
          </Card>

          {/* Purchase Order */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Purchase Order</CardTitle>
              <CardDescription>Vendor ordering documents</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-[11px]">
              <div className="space-y-1">
                <p className="text-muted-foreground">Key Elements</p>
                <ul className="space-y-1 text-foreground">
                  <li>• PO number, issue date, delivery date</li>
                  <li>• From/To vendor blocks</li>
                  <li>• Line items grid (matches invoice)</li>
                  <li>• Summary with subtotal, tax, shipping, total</li>
                  <li>• Terms & conditions, notes</li>
                </ul>
              </div>
              <div className="pt-2 border-t space-y-1">
                <p className="text-muted-foreground">Format</p>
                <p>A4 (595×842px) • Mirrors invoice layout</p>
              </div>
            </CardContent>
          </Card>

          {/* Transactions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Transactions</CardTitle>
              <CardDescription>Financial transaction management</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-[11px]">
              <div className="space-y-1">
                <p className="text-muted-foreground">Key Elements</p>
                <ul className="space-y-1 text-foreground">
                  <li>• Transaction ID (font-mono)</li>
                  <li>• Date, description, category</li>
                  <li>• Status pills (completed, pending, failed)</li>
                  <li>• Amount with +/- indicators</li>
                  <li>• Filtering and search</li>
                </ul>
              </div>
              <div className="pt-2 border-t space-y-1">
                <p className="text-muted-foreground">Table Style</p>
                <p>11px cells • font-mono for IDs/amounts</p>
              </div>
            </CardContent>
          </Card>

          {/* Gantt Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Gantt Chart</CardTitle>
              <CardDescription>Project timeline visualization</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-[11px]">
              <div className="space-y-1">
                <p className="text-muted-foreground">Key Elements</p>
                <ul className="space-y-1 text-foreground">
                  <li>• Task list with names</li>
                  <li>• Timeline grid with date headers</li>
                  <li>• Progress bars with status colors</li>
                  <li>• Drag-to-resize functionality</li>
                  <li>• Today marker line</li>
                </ul>
              </div>
              <div className="pt-2 border-t space-y-1">
                <p className="text-muted-foreground">Colors</p>
                <p>Primary for bars • Muted for grid</p>
              </div>
            </CardContent>
          </Card>

          {/* Dashboard */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Dashboard</CardTitle>
              <CardDescription>Overview and analytics</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-[11px]">
              <div className="space-y-1">
                <p className="text-muted-foreground">Key Elements</p>
                <ul className="space-y-1 text-foreground">
                  <li>• Metric cards with icon, title, value</li>
                  <li>• Charts (bar, line, area)</li>
                  <li>• Recent activity lists</li>
                  <li>• Quick action buttons</li>
                  <li>• Date range selectors</li>
                </ul>
              </div>
              <div className="pt-2 border-t space-y-1">
                <p className="text-muted-foreground">Layout</p>
                <p>4-column grid • Cards with p-6</p>
              </div>
            </CardContent>
          </Card>

          {/* Sidebar Navigation */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Sidebar Navigation</CardTitle>
              <CardDescription>Collapsible navigation panel</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-[11px]">
              <div className="space-y-1">
                <p className="text-muted-foreground">Key Elements</p>
                <ul className="space-y-1 text-foreground">
                  <li>• Logo with brand mark</li>
                  <li>• Icon + label nav items</li>
                  <li>• Hover expand behavior</li>
                  <li>• Active state highlight</li>
                  <li>• User profile section</li>
                  <li>• Theme toggle (light/dark)</li>
                </ul>
              </div>
              <div className="pt-2 border-t space-y-1">
                <p className="text-muted-foreground">Width</p>
                <p>Collapsed: 70px • Expanded: 240px</p>
              </div>
            </CardContent>
          </Card>

          {/* Forms */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Forms & Inputs</CardTitle>
              <CardDescription>Data entry components</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-[11px]">
              <div className="space-y-1">
                <p className="text-muted-foreground">Key Elements</p>
                <ul className="space-y-1 text-foreground">
                  <li>• Text inputs (h-9, square corners)</li>
                  <li>• Select dropdowns</li>
                  <li>• Date pickers (calendar)</li>
                  <li>• Checkboxes and radio buttons</li>
                  <li>• Form validation states</li>
                </ul>
              </div>
              <div className="pt-2 border-t space-y-1">
                <p className="text-muted-foreground">Labels</p>
                <p>11px #878787 above inputs</p>
              </div>
            </CardContent>
          </Card>

          {/* Dialogs & Sheets */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Dialogs & Sheets</CardTitle>
              <CardDescription>Modal and panel overlays</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-[11px]">
              <div className="space-y-1">
                <p className="text-muted-foreground">Key Elements</p>
                <ul className="space-y-1 text-foreground">
                  <li>• Alert dialogs for confirmations</li>
                  <li>• Sheet panels (left/right slide)</li>
                  <li>• Modal overlays with backdrop</li>
                  <li>• Command palette (⌘K)</li>
                  <li>• Toast notifications</li>
                </ul>
              </div>
              <div className="pt-2 border-t space-y-1">
                <p className="text-muted-foreground">Animation</p>
                <p>Scale 0.97→1 • Fade in/out</p>
              </div>
            </CardContent>
          </Card>

          {/* Confirmation Dialogs */}
          <Card className="md:col-span-2 xl:col-span-3">
            <CardHeader>
              <CardTitle className="text-lg">Confirmation Dialogs</CardTitle>
              <CardDescription>Destructive action confirmations ("Are you sure?")</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Live Demo */}
                <div className="space-y-3">
                  <p className="text-[11px] text-muted-foreground font-medium">Live Demo</p>
                  <Button
                    variant="destructive"
                    onClick={() => setShowDeleteDialog(true)}
                    className="gap-2"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete Item
                  </Button>
                  <p className="text-[11px] text-[#606060]">
                    Click to see the confirmation dialog pattern.
                  </p>
                </div>

                {/* Structure */}
                <div className="space-y-3">
                  <p className="text-[11px] text-muted-foreground font-medium">Dialog Structure</p>
                  <div className="border p-4 space-y-3 bg-card">
                    <div className="space-y-1">
                      <p className="text-sm font-medium">AlertDialogTitle</p>
                      <p className="text-[11px] text-[#606060]">AlertDialogDescription</p>
                    </div>
                    <div className="flex gap-2 justify-end pt-2">
                      <Button variant="outline" size="sm">Cancel</Button>
                      <Button variant="destructive" size="sm">Delete</Button>
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Specs */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-[11px]">
                <div className="space-y-2">
                  <p className="text-muted-foreground font-medium">Title</p>
                  <ul className="space-y-1">
                    <li>• Use question format: "Delete Item?"</li>
                    <li>• 18px font-medium (text-lg)</li>
                    <li>• Left-aligned on desktop</li>
                  </ul>
                </div>
                <div className="space-y-2">
                  <p className="text-muted-foreground font-medium">Description</p>
                  <ul className="space-y-1">
                    <li>• Explain consequences clearly</li>
                    <li>• Include "cannot be undone" if permanent</li>
                    <li>• 14px text-text-secondary</li>
                  </ul>
                </div>
                <div className="space-y-2">
                  <p className="text-muted-foreground font-medium">Buttons</p>
                  <ul className="space-y-1">
                    <li>• Cancel: variant="outline" (left)</li>
                    <li>• Confirm: variant="destructive" (right)</li>
                    <li>• Action verb matches title: "Delete"</li>
                  </ul>
                </div>
              </div>

              <Separator />

              {/* Code Example */}
              <div className="space-y-2">
                <p className="text-[11px] text-muted-foreground font-medium">Usage Pattern</p>
                <pre className="text-[10px] bg-secondary p-4 overflow-x-auto font-mono">
{`<AlertDialog open={showDialog} onOpenChange={setShowDialog}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Delete Item?</AlertDialogTitle>
      <AlertDialogDescription>
        Are you sure you want to delete this item?
        This action cannot be undone.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancel</AlertDialogCancel>
      <AlertDialogAction
        onClick={handleDelete}
        className="bg-destructive text-destructive-foreground"
      >
        Delete
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>`}
                </pre>
              </div>

              <div className="pt-2 border-t text-[11px] text-muted-foreground space-y-1">
                <p><strong>Overlay:</strong> bg-[#f6f6f3]/60 (light) • bg-[#0C0C0C]/80 (dark)</p>
                <p><strong>Content:</strong> max-w-lg • p-6 • border • bg-background</p>
                <p><strong>Animation:</strong> fade-in + zoom-in-95 + slide-in-from-top</p>
              </div>
            </CardContent>
          </Card>

          {/* Status Indicators */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Status Indicators</CardTitle>
              <CardDescription>Visual state communication</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-[11px]">
              <div className="space-y-1">
                <p className="text-muted-foreground">Status Types</p>
                <div className="flex flex-wrap gap-1 mt-2">
                  <Pill variant="success" size="sm">Active</Pill>
                  <Pill variant="success" size="sm">Completed</Pill>
                  <Pill variant="warning" size="sm">Pending</Pill>
                  <Pill variant="info" size="sm">Processing</Pill>
                  <Pill variant="error" size="sm">Failed</Pill>
                  <Pill size="sm">Inactive</Pill>
                </div>
              </div>
              <div className="pt-2 border-t space-y-1">
                <p className="text-muted-foreground">Usage</p>
                <p>Pills for status • Badges for counts</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>

      {/* Delete Confirmation Dialog Demo */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Item?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this item? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => setShowDeleteDialog(false)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
