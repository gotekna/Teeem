"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Send, Loader2, CheckCircle2 } from "lucide-react";
import { submitEnquiry } from "@/lib/api";

const enquirySchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.string().email("Valid email is required"),
  phone: z.string().optional(),
  message: z.string().min(10, "Message must be at least 10 characters"),
  ndis_number: z.string().optional(),
});

type EnquiryData = z.infer<typeof enquirySchema>;

interface EnquiryFormProps {
  slug: string;
  listingType: string;
}

export function EnquiryForm({ slug, listingType }: EnquiryFormProps) {
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<EnquiryData>({
    resolver: zodResolver(enquirySchema),
  });

  const onSubmit = async (data: EnquiryData) => {
    setError(null);
    try {
      await submitEnquiry(slug, data);
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit enquiry. Please try again.");
    }
  };

  if (submitted) {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-6 text-center dark:border-green-800 dark:bg-green-900/20">
        <CheckCircle2 className="mx-auto h-10 w-10 text-green-600 dark:text-green-400" />
        <h3 className="mt-3 text-lg font-semibold text-green-900 dark:text-green-100">
          Enquiry Submitted
        </h3>
        <p className="mt-1 text-sm text-green-700 dark:text-green-300">
          Thank you for your interest. We&apos;ll be in touch soon.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
        {listingType === "for_sale" ? "Enquire About This Property" : "Express Interest"}
      </h3>
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Fill in your details and we&apos;ll connect you with the property provider.
      </p>

      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="enq-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Full Name *
          </label>
          <input
            id="enq-name"
            type="text"
            {...register("name")}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          />
          {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>}
        </div>

        <div>
          <label htmlFor="enq-email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Email *
          </label>
          <input
            id="enq-email"
            type="email"
            {...register("email")}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          />
          {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
        </div>

        <div>
          <label htmlFor="enq-phone" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Phone
          </label>
          <input
            id="enq-phone"
            type="tel"
            {...register("phone")}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="enq-ndis" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            NDIS Number <span className="text-gray-400">(optional)</span>
          </label>
          <input
            id="enq-ndis"
            type="text"
            {...register("ndis_number")}
            placeholder="e.g. 431234567"
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="enq-message" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Message *
          </label>
          <textarea
            id="enq-message"
            rows={4}
            {...register("message")}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          />
          {errors.message && <p className="mt-1 text-xs text-red-600">{errors.message.message}</p>}
        </div>
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-600 disabled:opacity-50 sm:w-auto"
      >
        {isSubmitting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Send className="h-4 w-4" />
        )}
        {isSubmitting ? "Submitting..." : "Send Enquiry"}
      </button>
    </form>
  );
}
