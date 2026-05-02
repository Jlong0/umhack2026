import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { forwardRef } from "react";

/**
 * Modal — Unified centered dialog built on Radix Dialog.
 *
 * Provides: focus trap, ESC close, overlay click-to-dismiss,
 * fade/scale animation, and proper ARIA attributes.
 *
 * Usage:
 *   <Modal open={isOpen} onOpenChange={setIsOpen}>
 *     <ModalContent title="Resolve Conflict">
 *       ... content ...
 *     </ModalContent>
 *   </Modal>
 */

const Modal = DialogPrimitive.Root;
const ModalTrigger = DialogPrimitive.Trigger;
const ModalClose = DialogPrimitive.Close;
const ModalPortal = DialogPrimitive.Portal;

const ModalOverlay = forwardRef(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className,
    )}
    {...props}
  />
));
ModalOverlay.displayName = "ModalOverlay";

const ModalContent = forwardRef(
  ({ className, children, title, description, ...props }, ref) => (
    <ModalPortal>
      <ModalOverlay />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          "fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-card p-6 shadow-2xl",
          "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]",
          "duration-200",
          className,
        )}
        {...props}
      >
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <div className="min-w-0 flex-1">
            {title && (
              <DialogPrimitive.Title className="font-bold text-foreground">
                {title}
              </DialogPrimitive.Title>
            )}
            {description && (
              <DialogPrimitive.Description className="mt-1 text-xs text-muted-foreground">
                {description}
              </DialogPrimitive.Description>
            )}
          </div>
          <DialogPrimitive.Close className="ml-4 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2">
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        </div>

        {/* Body */}
        {children}
      </DialogPrimitive.Content>
    </ModalPortal>
  ),
);
ModalContent.displayName = "ModalContent";

export { Modal, ModalTrigger, ModalContent, ModalClose, ModalOverlay };
