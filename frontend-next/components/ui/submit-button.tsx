"use client";


import { Spinner } from "@/components/ui/spinner";
import * as React from "react";
import { useFormStatus } from "react-dom";
import { cn } from "@/lib/utils";
import { Button, type ButtonProps } from "./button";

export interface SubmitButtonProps extends ButtonProps {
  isSubmitting?: boolean;
  loadingText?: string;
}

const SubmitButton = React.forwardRef<HTMLButtonElement, SubmitButtonProps>(
  (
    {
      className,
      children,
      isSubmitting: isSubmittingProp,
      loadingText,
      disabled,
      ...props
    },
    ref,
  ) => {
    const { pending } = useFormStatus();
    const isSubmitting = isSubmittingProp ?? pending;

    return (
      <Button
        ref={ref}
        type="submit"
        className={cn(className)}
        disabled={disabled || isSubmitting}
        {...props}
      >
        {isSubmitting ? (
          <>
            <Spinner size={16} className="mr-2" />
            {loadingText || children}
          </>
        ) : (
          children
        )}
      </Button>
    );
  },
);
SubmitButton.displayName = "SubmitButton";

export { SubmitButton };
