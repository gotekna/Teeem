"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { BackButton } from "@/components/ui/back-button";
import { api } from "@/lib/api";

interface LineItem {
  description: string;
  quantity: string;
  unit_price: string;
}

interface POFormData {
  supplier_id: string;
  job_id: string;
  notes: string;
  line_items: LineItem[];
}

export default function NewPurchaseOrderPage() {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);
  const [formData, setFormData] = React.useState<POFormData>({
    supplier_id: "",
    job_id: "",
    notes: "",
    line_items: [{ description: "", quantity: "1", unit_price: "" }],
  });

  const handleChange = (field: keyof POFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleLineItemChange = (index: number, field: keyof LineItem, value: string) => {
    setFormData((prev) => ({
      ...prev,
      line_items: prev.line_items.map((item, i) =>
        i === index ? { ...item, [field]: value } : item
      ),
    }));
  };

  const addLineItem = () => {
    setFormData((prev) => ({
      ...prev,
      line_items: [...prev.line_items, { description: "", quantity: "1", unit_price: "" }],
    }));
  };

  const removeLineItem = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      line_items: prev.line_items.filter((_, i) => i !== index),
    }));
  };

  const calculateTotal = () => {
    return formData.line_items.reduce((sum, item) => {
      const qty = parseFloat(item.quantity) || 0;
      const price = parseFloat(item.unit_price) || 0;
      return sum + qty * price;
    }, 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await api.post("/api/v1/purchase_orders", {
        purchase_order: {
          supplier_id: parseInt(formData.supplier_id),
          job_id: parseInt(formData.job_id),
          notes: formData.notes,
          line_items: formData.line_items.map((item) => ({
            description: item.description,
            quantity: parseFloat(item.quantity),
            unit_price: parseFloat(item.unit_price),
          })),
        },
      });

      router.push(`/purchase_orders`);
    } catch (error) {
      console.error("Failed to create purchase order:", error);
      router.push("/purchase_orders");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <BackButton fallbackHref="/purchase_orders" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-serif">Create Purchase Order</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Create a new purchase order for a job
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Details */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Order Details</CardTitle>
              <CardDescription>Supplier and job information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="supplier">Supplier *</Label>
                  <Select
                    value={formData.supplier_id}
                    onValueChange={(value) => handleChange("supplier_id", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select supplier" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Steel Supply Co</SelectItem>
                      <SelectItem value="2">Concrete Works</SelectItem>
                      <SelectItem value="3">BuildRight Materials</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="job">Job *</Label>
                  <Select
                    value={formData.job_id}
                    onValueChange={(value) => handleChange("job_id", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select job" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Project Alpha - Commercial Building</SelectItem>
                      <SelectItem value="2">Residential Complex - Phase 2</SelectItem>
                      <SelectItem value="3">Office Renovation - Tech Hub</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Line Items */}
              <div className="space-y-4 pt-4">
                <div className="flex items-center justify-between">
                  <Label>Line Items</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addLineItem}>
                    <Plus className="h-4 w-4 mr-1" />
                    Add Item
                  </Button>
                </div>

                <div className="space-y-3">
                  {formData.line_items.map((item, index) => (
                    <div key={index} className="flex gap-3 items-start">
                      <div className="flex-1 space-y-2">
                        <Input
                          placeholder="Description"
                          value={item.description}
                          onChange={(e) => handleLineItemChange(index, "description", e.target.value)}
                        />
                      </div>
                      <div className="w-24 space-y-2">
                        <Input
                          type="number"
                          placeholder="Qty"
                          value={item.quantity}
                          onChange={(e) => handleLineItemChange(index, "quantity", e.target.value)}
                        />
                      </div>
                      <div className="w-32 space-y-2">
                        <Input
                          type="number"
                          placeholder="Unit Price"
                          value={item.unit_price}
                          onChange={(e) => handleLineItemChange(index, "unit_price", e.target.value)}
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeLineItem(index)}
                        disabled={formData.line_items.length === 1}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2 pt-4">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  placeholder="Additional notes for the supplier..."
                  value={formData.notes}
                  onChange={(e) => handleChange("notes", e.target.value)}
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {/* Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Summary</CardTitle>
              <CardDescription>Order total and actions</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>${calculateTotal().toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">GST (10%)</span>
                  <span>${(calculateTotal() * 0.1).toFixed(2)}</span>
                </div>
                <div className="border-t pt-2 flex justify-between font-medium">
                  <span>Total</span>
                  <span>${(calculateTotal() * 1.1).toFixed(2)}</span>
                </div>
              </div>

              <div className="flex flex-col gap-2 pt-4">
                <Button type="submit" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create PO"
                  )}
                </Button>
                <Button type="button" variant="outline" asChild>
                  <Link href="/purchase_orders">Cancel</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </form>
    </div>
  );
}
