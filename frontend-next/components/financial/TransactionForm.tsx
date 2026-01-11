"use client";

import { useState, useEffect } from "react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { api } from "@/lib/api";

interface Transaction {
  id: number;
  transaction_type: string;
  amount: number;
  transaction_date: string;
  description?: string;
  category?: string;
  construction_id?: number;
}

interface Construction {
  id: number;
  name?: string;
}

interface TransactionFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (transaction: Transaction) => void;
  transaction?: Transaction | null;
  type?: "income" | "expense";
}

interface FormData {
  transaction_type: string;
  amount: string;
  transaction_date: string;
  description: string;
  category: string;
  construction_id: string;
  auto_post: boolean;
}

export default function TransactionForm({
  isOpen,
  onClose,
  onSuccess,
  transaction = null,
  type = "expense",
}: TransactionFormProps) {
  const [formData, setFormData] = useState<FormData>({
    transaction_type: type,
    amount: "",
    transaction_date: new Date().toISOString().split("T")[0],
    description: "",
    category: "",
    construction_id: "",
    auto_post: true,
  });
  const [receipt, setReceipt] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [jobs, setJobs] = useState<Construction[]>([]);

  // Load categories and jobs when form opens
  useEffect(() => {
    if (isOpen) {
      loadCategories();
      loadJobs();

      if (transaction) {
        // Edit mode - populate form with existing transaction
        setFormData({
          transaction_type: transaction.transaction_type,
          amount: transaction.amount.toString(),
          transaction_date: transaction.transaction_date,
          description: transaction.description || "",
          category: transaction.category || "",
          construction_id: transaction.construction_id?.toString() || "",
          auto_post: false, // Don't auto-post when editing
        });
      } else {
        // Create mode - reset form
        setFormData({
          transaction_type: type,
          amount: "",
          transaction_date: new Date().toISOString().split("T")[0],
          description: "",
          category: "",
          construction_id: "",
          auto_post: true,
        });
        setReceipt(null);
      }
      setError(null);
    }
     
  }, [isOpen, transaction, type]);

  const loadCategories = async () => {
    try {
      const response = await api.get<{ success: boolean; categories: string[] }>(
        `/api/v1/financial_transactions/categories?transaction_type=${type}`
      );
      if (response?.success) {
        setCategories(response.categories);
        // Set default category
        if (!transaction && response.categories.length > 0) {
          setFormData((prev) => ({ ...prev, category: response.categories[0] }));
        }
      }
    } catch (err) {
      console.error("Failed to load categories:", err);
    }
  };

  const loadJobs = async () => {
    try {
      const response = await api.get<{ success: boolean; constructions: Construction[] }>(
        "/api/v1/jobs?per_page=100"
      );
      if (response?.success) {
        setJobs(response.constructions || []);
      }
    } catch (err) {
      console.error("Failed to load jobs:", err);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type: inputType } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    setFormData((prev) => ({
      ...prev,
      [name]: inputType === "checkbox" ? checked : value,
    }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setError("File size must be less than 5MB");
        return;
      }
      setReceipt(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Validate
      if (!formData.amount || parseFloat(formData.amount) <= 0) {
        throw new Error("Amount must be greater than 0");
      }

      if (!formData.transaction_date) {
        throw new Error("Transaction date is required");
      }

      if (!formData.category) {
        throw new Error("Category is required");
      }

      // Prepare form data
      const submitData = new FormData();
      Object.keys(formData).forEach((key) => {
        const value = formData[key as keyof FormData];
        if (value !== "" && value !== null) {
          submitData.append(`transaction[${key}]`, value.toString());
        }
      });

      if (receipt) {
        submitData.append("transaction[receipt]", receipt);
      }

      // Submit using FormData methods
      let response;
      if (transaction) {
        // Update existing transaction
        response = await api.putFormData<{ success: boolean; transaction: Transaction; error?: string }>(
          `/api/v1/financial_transactions/${transaction.id}`,
          submitData
        );
      } else {
        // Create new transaction
        response = await api.postFormData<{ success: boolean; transaction: Transaction; error?: string }>(
          "/api/v1/financial_transactions",
          submitData
        );
      }

      if (response?.success) {
        onSuccess(response.transaction);
        onClose();
      } else {
        throw new Error(response?.error || "Failed to save transaction");
      }
    } catch (err: any) {
      setError(err.message || "Failed to save transaction");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const title = transaction
    ? `Edit ${formData.transaction_type === "income" ? "Income" : "Expense"}`
    : `Record ${type === "income" ? "Income" : "Expense"}`;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        {/* Background overlay */}
        <div
          className="fixed inset-0 bg-muted0 bg-opacity-75 transition-opacity"
          onClick={onClose}
        ></div>

        {/* Modal panel */}
        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
          {/* Header */}
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div className="flex items-start justify-between">
              <h3 className="text-lg leading-6 font-medium text-foreground">
                {title}
              </h3>
              <button
                onClick={onClose}
                className="rounded-md text-muted-foreground hover:text-muted-foreground focus:outline-none"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            {/* Error message */}
            {error && (
              <div className="mt-4 bg-red-50 border border-red-200 rounded-md p-3">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              {/* Amount */}
              <div>
                <label
                  htmlFor="amount"
                  className="block text-sm font-medium text-foreground"
                >
                  Amount *
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-muted-foreground sm:text-sm">$</span>
                  </div>
                  <input
                    type="number"
                    name="amount"
                    id="amount"
                    step="0.01"
                    min="0"
                    required
                    value={formData.amount}
                    onChange={handleChange}
                    className="pl-7 block w-full rounded-md border-border focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="0.00"
                  />
                </div>
              </div>

              {/* Date */}
              <div>
                <label
                  htmlFor="transaction_date"
                  className="block text-sm font-medium text-foreground"
                >
                  Date *
                </label>
                <input
                  type="date"
                  name="transaction_date"
                  id="transaction_date"
                  required
                  value={formData.transaction_date}
                  onChange={handleChange}
                  max={new Date().toISOString().split("T")[0]}
                  className="mt-1 block w-full rounded-md border-border focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>

              {/* Category */}
              <div>
                <label
                  htmlFor="category"
                  className="block text-sm font-medium text-foreground"
                >
                  Category *
                </label>
                <select
                  name="category"
                  id="category"
                  required
                  value={formData.category}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md border-border focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                >
                  <option value="">Select a category</option>
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              {/* Job (optional) */}
              <div>
                <label
                  htmlFor="construction_id"
                  className="block text-sm font-medium text-foreground"
                >
                  Job (optional)
                </label>
                <select
                  name="construction_id"
                  id="construction_id"
                  value={formData.construction_id}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md border-border focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                >
                  <option value="">Not linked to a job</option>
                  {jobs.map((job) => (
                    <option key={job.id} value={job.id}>
                      {job.name || `Job #${job.id}`}
                    </option>
                  ))}
                </select>
              </div>

              {/* Description */}
              <div>
                <label
                  htmlFor="description"
                  className="block text-sm font-medium text-foreground"
                >
                  Description
                </label>
                <textarea
                  name="description"
                  id="description"
                  rows={3}
                  value={formData.description}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md border-border focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="Additional details..."
                />
              </div>

              {/* Receipt upload */}
              <div>
                <label
                  htmlFor="receipt"
                  className="block text-sm font-medium text-foreground"
                >
                  Receipt (optional)
                </label>
                <input
                  type="file"
                  name="receipt"
                  id="receipt"
                  accept="image/*,.pdf"
                  onChange={handleFileChange}
                  className="mt-1 block w-full text-sm text-muted-foreground
                    file:mr-4 file:py-2 file:px-4
                    file:rounded-md file:border-0
                    file:text-sm file:font-semibold
                    file:bg-blue-50 file:text-blue-700
                    hover:file:bg-blue-100"
                />
                {receipt && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    Selected: {receipt.name}
                  </p>
                )}
              </div>

              {/* Auto-post checkbox (only for new transactions) */}
              {!transaction && (
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    name="auto_post"
                    id="auto_post"
                    checked={formData.auto_post}
                    onChange={handleChange}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-border rounded"
                  />
                  <label
                    htmlFor="auto_post"
                    className="ml-2 block text-sm text-foreground"
                  >
                    Post to books immediately (recommended)
                  </label>
                </div>
              )}
            </form>
          </div>

          {/* Footer */}
          <div className="bg-muted px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
            <button
              type="submit"
              onClick={handleSubmit}
              disabled={loading}
              className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Saving..." : transaction ? "Update" : "Save"}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="mt-3 w-full inline-flex justify-center rounded-md border border-border shadow-sm px-4 py-2 bg-white text-base font-medium text-foreground hover:bg-muted focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
