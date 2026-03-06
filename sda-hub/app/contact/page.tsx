"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Send, Loader2, CheckCircle2, Mail, MapPin } from "lucide-react";
import type { Metadata } from "next";

const contactSchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.string().email("Valid email is required"),
  phone: z.string().optional(),
  subject: z.string().min(2, "Subject is required"),
  message: z.string().min(10, "Message must be at least 10 characters"),
});

type ContactData = z.infer<typeof contactSchema>;

export default function ContactPage() {
  const [submitted, setSubmitted] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ContactData>({
    resolver: zodResolver(contactSchema),
  });

  const onSubmit = async (data: ContactData) => {
    // For now, simulate submission. In production, this would call a backend endpoint.
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setSubmitted(true);
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 sm:text-4xl dark:text-white">
          Contact Us
        </h1>
        <p className="mt-3 text-base text-gray-600 dark:text-gray-400">
          Have questions about SDA properties? We&apos;re here to help.
        </p>
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-3">
        {/* Contact info */}
        <div className="space-y-6">
          <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-brand-50 p-2 dark:bg-brand-900/30">
                <Mail className="h-5 w-5 text-brand-500" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Email</h3>
                <a href="mailto:hello@sdapropertyhub.com.au" className="text-sm text-brand-500 hover:underline">
                  hello@sdapropertyhub.com.au
                </a>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-brand-50 p-2 dark:bg-brand-900/30">
                <MapPin className="h-5 w-5 text-brand-500" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Location</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">Brisbane, Queensland, Australia</p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-gray-50 p-5 dark:border-gray-800 dark:bg-gray-900">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Powered by TEEEM</h3>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              SDA Property Hub is powered by TEEEM, Australia&apos;s leading property and construction management platform.
            </p>
          </div>
        </div>

        {/* Contact form */}
        <div className="lg:col-span-2">
          {submitted ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-green-200 bg-green-50 p-10 text-center dark:border-green-800 dark:bg-green-900/20">
              <CheckCircle2 className="h-12 w-12 text-green-600 dark:text-green-400" />
              <h2 className="mt-4 text-xl font-bold text-green-900 dark:text-green-100">Message Sent</h2>
              <p className="mt-2 text-sm text-green-700 dark:text-green-300">
                Thank you for reaching out. We&apos;ll get back to you as soon as possible.
              </p>
            </div>
          ) : (
            <form
              onSubmit={handleSubmit(onSubmit)}
              className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="contact-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Full Name *
                  </label>
                  <input
                    id="contact-name"
                    type="text"
                    {...register("name")}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  />
                  {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>}
                </div>

                <div>
                  <label htmlFor="contact-email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Email *
                  </label>
                  <input
                    id="contact-email"
                    type="email"
                    {...register("email")}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  />
                  {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
                </div>

                <div>
                  <label htmlFor="contact-phone" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Phone
                  </label>
                  <input
                    id="contact-phone"
                    type="tel"
                    {...register("phone")}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  />
                </div>

                <div>
                  <label htmlFor="contact-subject" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Subject *
                  </label>
                  <input
                    id="contact-subject"
                    type="text"
                    {...register("subject")}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  />
                  {errors.subject && <p className="mt-1 text-xs text-red-600">{errors.subject.message}</p>}
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="contact-message" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Message *
                  </label>
                  <textarea
                    id="contact-message"
                    rows={5}
                    {...register("message")}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  />
                  {errors.message && <p className="mt-1 text-xs text-red-600">{errors.message.message}</p>}
                </div>
              </div>

              <div className="mt-4">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  {isSubmitting ? "Sending..." : "Send Message"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
