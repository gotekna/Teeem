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
import { Trash2, ExternalLink, Star, DollarSign } from "lucide-react";
import Link from "next/link";

export function BrandGuidelinesTab() {
  const [showDeleteDialog, setShowDeleteDialog] = React.useState(false);

  return (
    <div className="space-y-8 pb-32">
      <div>
        <h2 className="text-lg font-semibold">Brand Guidelines</h2>
        <p className="text-sm text-muted-foreground">
          Comprehensive design system documentation for Teeem.
        </p>
      </div>

      <Separator />

      {/* Typography */}
      <section className="space-y-6">
        <div>
          <h3 className="text-xl font-medium mb-1">Typography</h3>
          <p className="text-sm text-[#606060]">Font families, sizes, and usage guidelines.</p>
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
                <p className="text-[11px] text-[#878787]">CSS Variable</p>
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
                <p className="text-[11px] text-[#878787]">CSS Variable</p>
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
                <p className="text-[11px] text-[#878787]">CSS Variable</p>
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
                  <span className="text-[11px] text-[#878787]">Large headings</span>
                </div>
                <div className="flex items-baseline justify-between border-b pb-2">
                  <span className="text-[21px]">21px</span>
                  <span className="text-[11px] text-[#878787]">Document titles, totals</span>
                </div>
                <div className="flex items-baseline justify-between border-b pb-2">
                  <span className="text-[14px]">14px</span>
                  <span className="text-[11px] text-[#878787]">Body text (default)</span>
                </div>
                <div className="flex items-baseline justify-between border-b pb-2">
                  <span className="text-[12px]">12px</span>
                  <span className="text-[11px] text-[#878787]">Small text, badges</span>
                </div>
                <div className="flex items-baseline justify-between border-b pb-2">
                  <span className="text-[11px]">11px</span>
                  <span className="text-[11px] text-[#878787]">Labels, invoice body</span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-[10px]">10px</span>
                  <span className="text-[11px] text-[#878787]">Small pills, tags</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <Separator />

      {/* Product Branding */}
      <section className="space-y-6">
        <div>
          <h3 className="text-xl font-medium mb-1">Product Branding</h3>
          <p className="text-sm text-[#606060]">Internal product names and logos.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* T.A.S. */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <div className="w-8 h-8 bg-foreground text-background flex items-center justify-center">
                  <DollarSign className="h-5 w-5" />
                </div>
                T.A.S.
              </CardTitle>
              <CardDescription>Teeem Accounting System</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-foreground text-background flex items-center justify-center">
                    <DollarSign className="h-7 w-7" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Primary Logo</p>
                    <p className="text-[11px] text-[#878787]">$ in black square</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 border-2 border-foreground flex items-center justify-center">
                    <DollarSign className="h-7 w-7" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Outline Variant</p>
                    <p className="text-[11px] text-[#878787]">For light backgrounds</p>
                  </div>
                </div>
              </div>
              <div className="pt-4 border-t space-y-2 text-[11px]">
                <p><strong>Full Name:</strong> Teeem Accounting System</p>
                <p><strong>Short Name:</strong> T.A.S.</p>
                <p><strong>Icon:</strong> DollarSign (lucide-react)</p>
                <p><strong>Navigation:</strong> Finance → T.A.S.</p>
                <p><strong>URL:</strong> /financial/tas</p>
              </div>
            </CardContent>
          </Card>

          {/* Teeem Main */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Teeem (Parent Brand)</CardTitle>
              <CardDescription>Main product branding</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-foreground text-background flex items-center justify-center font-serif font-bold text-xl">
                    t
                  </div>
                  <div>
                    <p className="text-sm font-medium">Primary Logo</p>
                    <p className="text-[11px] text-[#878787]">Lowercase t in black square</p>
                  </div>
                </div>
              </div>
              <div className="pt-4 border-t space-y-2 text-[11px]">
                <p><strong>Full Name:</strong> Teeem</p>
                <p><strong>Pronunciation:</strong> &quot;Team&quot; with 3 e&apos;s</p>
                <p><strong>Font:</strong> Hedvig Letters Serif (bold)</p>
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
          <p className="text-sm text-[#606060]">Core palette with light and dark mode support.</p>
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
                    <p className="text-[11px] text-[#878787]">Primary text</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#606060] border" />
                  <div>
                    <p className="text-sm font-medium">#606060</p>
                    <p className="text-[11px] text-[#878787]">Descriptions, secondary</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#878787] border" />
                  <div>
                    <p className="text-sm font-medium">#878787</p>
                    <p className="text-[11px] text-[#878787]">Labels, muted text</p>
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
                    <p className="text-[11px] text-[#878787]">Light: #fff / Dark: #0d0d0d</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#F2F1EF] dark:bg-[#1D1D1D] border" />
                  <div>
                    <p className="text-sm font-medium">Secondary</p>
                    <p className="text-[11px] text-[#878787]">#F2F1EF / #1D1D1D</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-card border" />
                  <div>
                    <p className="text-sm font-medium">Card</p>
                    <p className="text-[11px] text-[#878787]">Elevated surfaces</p>
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
                    <p className="text-[11px] text-[#878787]">Completed, active</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#FEF3C7] dark:bg-[#78350F] border" />
                  <div>
                    <p className="text-sm font-medium">Warning</p>
                    <p className="text-[11px] text-[#878787]">Pending, attention</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#FEE2E2] dark:bg-[#7F1D1D] border" />
                  <div>
                    <p className="text-sm font-medium">Error</p>
                    <p className="text-[11px] text-[#878787]">Failed, destructive</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#DBEAFE] dark:bg-[#1E3A8A] border" />
                  <div>
                    <p className="text-sm font-medium">Info</p>
                    <p className="text-[11px] text-[#878787]">Processing, info</p>
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
          <p className="text-sm text-[#606060]">All UI elements use square corners for a sharp, professional look.</p>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="text-center space-y-3">
                <div className="w-20 h-20 bg-primary mx-auto" />
                <div>
                  <p className="text-sm font-medium">Buttons</p>
                  <p className="text-[11px] text-[#878787]">rounded-none</p>
                </div>
              </div>
              <div className="text-center space-y-3">
                <div className="w-20 h-20 border-2 border-border mx-auto" />
                <div>
                  <p className="text-sm font-medium">Cards</p>
                  <p className="text-[11px] text-[#878787]">rounded-none</p>
                </div>
              </div>
              <div className="text-center space-y-3">
                <div className="w-20 h-6 bg-[#F2F1EF] dark:bg-[#1D1D1D] mx-auto" />
                <div>
                  <p className="text-sm font-medium">Pills/Tags</p>
                  <p className="text-[11px] text-[#878787]">rounded-none</p>
                </div>
              </div>
              <div className="text-center space-y-3">
                <div className="w-20 h-10 border border-border mx-auto" />
                <div>
                  <p className="text-sm font-medium">Inputs</p>
                  <p className="text-[11px] text-[#878787]">rounded-none</p>
                </div>
              </div>
            </div>
            <div className="mt-6 pt-6 border-t">
              <p className="text-[11px] text-[#878787]">CSS Variable</p>
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
          <p className="text-sm text-[#606060]">Consistent spacing using Tailwind&apos;s scale.</p>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-1 h-6 bg-primary" />
                <span className="text-sm w-16">4px</span>
                <span className="text-[11px] text-[#878787]">gap-1, p-1, m-1</span>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-2 h-6 bg-primary" />
                <span className="text-sm w-16">8px</span>
                <span className="text-[11px] text-[#878787]">gap-2, p-2, m-2</span>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-3 h-6 bg-primary" />
                <span className="text-sm w-16">12px</span>
                <span className="text-[11px] text-[#878787]">gap-3, p-3, m-3</span>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-4 h-6 bg-primary" />
                <span className="text-sm w-16">16px</span>
                <span className="text-[11px] text-[#878787]">gap-4, p-4, m-4</span>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-6 h-6 bg-primary" />
                <span className="text-sm w-16">24px</span>
                <span className="text-[11px] text-[#878787]">gap-6, p-6, m-6</span>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-8 h-6 bg-primary" />
                <span className="text-sm w-16">32px</span>
                <span className="text-[11px] text-[#878787]">gap-8, p-8, m-8</span>
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
          <p className="text-sm text-[#606060]">Invoice and Purchase Order specifications.</p>
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
                <div className="grid grid-cols-[1.5fr_15%_15%_15%] gap-4 p-3 bg-secondary text-[11px] text-[#878787]">
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
              <p className="text-[11px] text-[#878787] mt-3">
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
          <p className="text-sm text-[#606060]">Key UI components and their usage.</p>
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
              <div className="pt-4 border-t text-[11px] text-[#878787] space-y-1">
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
              <div className="pt-4 border-t text-[11px] text-[#878787] space-y-1">
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
              <div className="pt-4 border-t text-[11px] text-[#878787] space-y-1">
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
              <div className="pt-4 border-t text-[11px] text-[#878787] space-y-1">
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
          <p className="text-sm text-[#606060]">Data table specifications and styling.</p>
        </div>

        {/* Gold Standard Table Link */}
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Star className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium">Gold Standard Table</p>
                  <p className="text-sm text-[#606060]">Live demo showing all 31 column types with filters, sorting, and inline editing</p>
                </div>
              </div>
              <Link
                href="/admin/system?tab=components"
                className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline font-medium"
              >
                View demo
                <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Table Example</CardTitle>
            <CardDescription>Common cell types: IDs, status pills, text, currency, dates, percentages</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Paid %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-mono">INV-2024-001</TableCell>
                  <TableCell><Pill variant="success" size="sm">Paid</Pill></TableCell>
                  <TableCell>Acme Corporation</TableCell>
                  <TableCell className="text-[#606060]">15/12/2024</TableCell>
                  <TableCell className="text-right font-mono">$1,200.00</TableCell>
                  <TableCell className="text-right font-mono">100%</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-mono">INV-2024-002</TableCell>
                  <TableCell><Pill variant="warning" size="sm">Pending</Pill></TableCell>
                  <TableCell>Globex Inc.</TableCell>
                  <TableCell className="text-[#606060]">12/12/2024</TableCell>
                  <TableCell className="text-right font-mono">$3,450.00</TableCell>
                  <TableCell className="text-right font-mono">50%</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-mono">INV-2024-003</TableCell>
                  <TableCell><Pill variant="error" size="sm">Overdue</Pill></TableCell>
                  <TableCell>Initech LLC</TableCell>
                  <TableCell className="text-[#606060]">01/12/2024</TableCell>
                  <TableCell className="text-right font-mono">$890.00</TableCell>
                  <TableCell className="text-right font-mono">0%</TableCell>
                </TableRow>
              </TableBody>
            </Table>
            <div className="pt-4 border-t text-[11px] text-[#878787] space-y-2">
              <p className="font-medium text-foreground text-xs mb-2">Cell Type Formatting</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1">
                <p><strong>IDs/Codes:</strong> font-mono</p>
                <p><strong>Currency:</strong> font-mono, text-right, $ prefix</p>
                <p><strong>Percentage:</strong> font-mono, text-right, % suffix</p>
                <p><strong>Dates:</strong> DD/MM/YYYY, text-[#606060]</p>
                <p><strong>Status:</strong> Pill component</p>
                <p><strong>Text:</strong> Default styling</p>
              </div>

              <p className="font-medium text-foreground text-xs mt-4 mb-2">Typography & Sizing</p>
              <p><strong>Table Headers:</strong> 14px, uppercase, font-medium (500), letter-spacing 0.05em</p>
              <p><strong>Cascading Headers:</strong> 13px, bold (700)</p>
              <p><strong>Table Cells:</strong> 13px, py-0.25 (1px vertical padding), px-1.5</p>

              <p className="font-medium text-foreground text-xs mt-4 mb-2">Layout & Spacing</p>
              <p><strong>Table Layout:</strong> tableLayout: &apos;auto&apos; (fills container width)</p>
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

        {/* Column Types Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">31 Column Types</CardTitle>
            <CardDescription>TeeemTableView supports all these column types via the Foundation API</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-[11px]">
              <div className="space-y-1">
                <p className="text-[#878787] font-medium">Text (6)</p>
                <p>single_line_text</p>
                <p>multiple_lines_text</p>
                <p>email</p>
                <p>phone</p>
                <p>mobile</p>
                <p>url</p>
              </div>
              <div className="space-y-1">
                <p className="text-[#878787] font-medium">Numbers (4)</p>
                <p>number</p>
                <p>whole_number</p>
                <p>currency</p>
                <p>percentage</p>
                <p className="text-[#878787] font-medium mt-3">Date/Time (2)</p>
                <p>date</p>
                <p>date_and_time</p>
              </div>
              <div className="space-y-1">
                <p className="text-[#878787] font-medium">Selection (2)</p>
                <p>boolean</p>
                <p>choice</p>
                <p className="text-[#878787] font-medium mt-3">Relationships (3)</p>
                <p>lookup</p>
                <p>multiple_lookups</p>
                <p>user</p>
              </div>
              <div className="space-y-1">
                <p className="text-[#878787] font-medium">Australian (6)</p>
                <p>abn</p>
                <p>acn</p>
                <p>bsb</p>
                <p>bank_account</p>
                <p>postcode</p>
                <p>tfn</p>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t">
              <Link
                href="/admin/system?tab=components"
                className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
              >
                See all column types in action
                <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          </CardContent>
        </Card>
      </section>

      <Separator />

      {/* CSS Variables Reference */}
      <section className="space-y-6">
        <div>
          <h3 className="text-xl font-medium mb-1">CSS Variables Reference</h3>
          <p className="text-sm text-[#606060]">Complete list of design tokens.</p>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2 text-[11px] font-mono">
              <div className="space-y-2">
                <p className="text-[#878787] font-sans text-xs font-medium mb-3">Layout</p>
                <p>--radius: 0rem</p>
                <p>--font-geist-sans</p>
                <p>--font-geist-mono</p>
                <p>--font-hedvig-serif</p>
              </div>
              <div className="space-y-2">
                <p className="text-[#878787] font-sans text-xs font-medium mb-3">Light Mode</p>
                <p>--background: 0, 0%, 100%</p>
                <p>--foreground: 0, 0%, 7%</p>
                <p>--border: 45, 5%, 85%</p>
                <p>--muted-foreground: 0, 0%, 38%</p>
              </div>
              <div className="space-y-2 mt-4">
                <p className="text-[#878787] font-sans text-xs font-medium mb-3">Dark Mode</p>
                <p>--background: 0, 0%, 5%</p>
                <p>--foreground: 0, 0%, 98%</p>
                <p>--border: 0, 0%, 11%</p>
                <p>--muted-foreground: 0, 0%, 38%</p>
              </div>
              <div className="space-y-2 mt-4">
                <p className="text-[#878787] font-sans text-xs font-medium mb-3">Semantic Colors</p>
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

      {/* Confirmation Dialogs */}
      <section className="space-y-6">
        <div>
          <h3 className="text-xl font-medium mb-1">Confirmation Dialogs</h3>
          <p className="text-sm text-[#606060]">Destructive action confirmations (&quot;Are you sure?&quot;)</p>
        </div>

        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Live Demo */}
              <div className="space-y-3">
                <p className="text-[11px] text-[#878787] font-medium">Live Demo</p>
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
                <p className="text-[11px] text-[#878787] font-medium">Dialog Structure</p>
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
                <p className="text-[#878787] font-medium">Title</p>
                <ul className="space-y-1">
                  <li>• Use question format: &quot;Delete Item?&quot;</li>
                  <li>• 18px font-medium (text-lg)</li>
                  <li>• Left-aligned on desktop</li>
                </ul>
              </div>
              <div className="space-y-2">
                <p className="text-[#878787] font-medium">Description</p>
                <ul className="space-y-1">
                  <li>• Explain consequences clearly</li>
                  <li>• Include &quot;cannot be undone&quot; if permanent</li>
                  <li>• 14px text-text-secondary</li>
                </ul>
              </div>
              <div className="space-y-2">
                <p className="text-[#878787] font-medium">Buttons</p>
                <ul className="space-y-1">
                  <li>• Cancel: variant=&quot;outline&quot; (left)</li>
                  <li>• Confirm: variant=&quot;destructive&quot; (right)</li>
                  <li>• Action verb matches title: &quot;Delete&quot;</li>
                </ul>
              </div>
            </div>

            <div className="pt-2 border-t text-[11px] text-[#878787] space-y-1">
              <p><strong>Overlay:</strong> bg-[#f6f6f3]/60 (light) • bg-[#0C0C0C]/80 (dark)</p>
              <p><strong>Content:</strong> max-w-lg • p-6 • border • bg-background</p>
              <p><strong>Animation:</strong> fade-in + zoom-in-95 + slide-in-from-top</p>
            </div>
          </CardContent>
        </Card>
      </section>

      <Separator />

      {/* Status Indicators */}
      <section className="space-y-6">
        <div>
          <h3 className="text-xl font-medium mb-1">Status Indicators</h3>
          <p className="text-sm text-[#606060]">Visual state communication</p>
        </div>

        <Card>
          <CardContent className="pt-6 space-y-3 text-[11px]">
            <div className="space-y-1">
              <p className="text-[#878787]">Status Types</p>
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
              <p className="text-[#878787]">Usage</p>
              <p>Pills for status • Badges for counts</p>
            </div>
          </CardContent>
        </Card>
      </section>

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
