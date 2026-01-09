"use client";

import { Provider, createStore } from "jotai";
import { ReactNode } from "react";

// Create a single store instance to be used across the entire app
// This fixes the "multiple Jotai instances" warning caused by multiple package-lock.json files
const store = createStore();

interface JotaiProviderProps {
  children: ReactNode;
}

export function JotaiProvider({ children }: JotaiProviderProps) {
  return <Provider store={store}>{children}</Provider>;
}
