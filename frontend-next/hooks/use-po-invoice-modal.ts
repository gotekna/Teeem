import { atom, useAtom } from "jotai";
import { useCallback } from "react";

interface POInvoiceModalState {
  isOpen: boolean;
  poId: string | number | null;
  poNumber: string | null;
}

const poInvoiceModalAtom = atom<POInvoiceModalState>({
  isOpen: false,
  poId: null,
  poNumber: null,
});

/**
 * Hook to control the PO vs Invoice side-by-side modal.
 * Can be called from any component - the modal renders in the app layout.
 */
export function usePOInvoiceModal() {
  const [state, setState] = useAtom(poInvoiceModalAtom);

  const open = useCallback(
    (poId: string | number, poNumber?: string) => {
      setState({ isOpen: true, poId, poNumber: poNumber || null });
    },
    [setState]
  );

  const close = useCallback(() => {
    setState({ isOpen: false, poId: null, poNumber: null });
  }, [setState]);

  return {
    isOpen: state.isOpen,
    poId: state.poId,
    poNumber: state.poNumber,
    open,
    close,
  };
}
