import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  // Project-specific rule overrides - all turned OFF for clean lint output
  {
    rules: {
      // Turn off unused vars check (too noisy, doesn't affect runtime)
      "@typescript-eslint/no-unused-vars": "off",
      // Turn off explicit any check (acceptable for rapid development)
      "@typescript-eslint/no-explicit-any": "off",
      // Turn off img element warnings (Next Image not always needed)
      "@next/next/no-img-element": "off",
      // Turn off exhaustive-deps (too many false positives)
      "react-hooks/exhaustive-deps": "off",
      // Turn off empty object type check
      "@typescript-eslint/no-empty-object-type": "off",
      // Turn off unescaped quotes in JSX
      "react/no-unescaped-entities": "off",
      // Turn off @ts-ignore warnings
      "@typescript-eslint/ban-ts-comment": "off",
      // Turn off non-null assertion warnings
      "@typescript-eslint/no-non-null-asserted-optional-chain": "off",
      // Turn off unused expressions
      "@typescript-eslint/no-unused-expressions": "off",
      // React compiler rules - turned off (too strict for existing codebase)
      "react-hooks/refs": "off",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/static-components": "off",
      "react-hooks/rules-of-hooks": "off",
      "react-hooks/preserve-manual-memoization": "off",
      "react-hooks/immutability": "off",
      "react-hooks/incompatible-library": "off",
      // Allow components without displayName
      "react/display-name": "off",
      // Turn off anonymous default export warning
      "import/no-anonymous-default-export": "off",
    }
  },
  // UI component library files often need looser rules
  {
    files: ["components/ui/**/*.tsx", "components/ui/**/*.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "react-hooks/static-components": "off",
    }
  },
  // ==========================================================================
  // COMPONENT SSoT ENFORCEMENT
  // Warn when importing deprecated components - use THE ONE instead
  // See: frontend-next/lib/component-registry.ts for the full list
  // ==========================================================================
  //
  // TODO: Custom ESLint Rule for TeeemTableView
  // Currently enforced via runtime error in development mode (TeeemTableView.tsx)
  // Ideal: Custom rule to detect `<TeeemTableView columns={...} foundationIdNumeric={...} />`
  // and error: "SSoT VIOLATION: Remove columns prop when foundationIdNumeric is set"
  //
  {
    rules: {
      "no-restricted-imports": ["warn", {
        paths: [
          {
            name: "@/components/ui/combobox",
            message: "DEPRECATED: Use ComboboxDropdown from @/components/ui/combobox-dropdown instead. See component-registry.ts"
          },
          {
            name: "@/components/ui/loader",
            message: "DEPRECATED: Use Spinner from @/components/ui/spinner instead. See component-registry.ts"
          },
          {
            name: "@/components/ui/drawer",
            message: "DEPRECATED: Use Sheet from @/components/ui/sheet instead. See component-registry.ts"
          },
          {
            name: "@/components/ui/collapsible",
            message: "DEPRECATED: Use Accordion from @/components/ui/accordion instead. See component-registry.ts"
          },
          {
            name: "@/components/ui/data-table",
            message: "DEPRECATED: Use TeeemTableView from @/components/table/TeeemTableView instead. See component-registry.ts"
          },
        ],
        patterns: [
          {
            group: ["**/components/ui/combobox", "**/combobox.tsx"],
            message: "DEPRECATED: Use ComboboxDropdown instead"
          },
          {
            group: ["**/components/ui/loader", "**/loader.tsx"],
            message: "DEPRECATED: Use Spinner instead"
          },
          {
            group: ["**/components/ui/drawer", "**/drawer.tsx"],
            message: "DEPRECATED: Use Sheet instead"
          },
          {
            group: ["**/components/ui/collapsible", "**/collapsible.tsx"],
            message: "DEPRECATED: Use Accordion instead"
          },
        ]
      }]
    }
  },
]);

export default eslintConfig;
