import { toast } from "sonner";

/**
 * Safe toast wrapper that prevents React error #310
 * 
 * React error #310 occurs when state updates are triggered synchronously
 * during event handling. This wrapper delays toast calls to the next event
 * loop using setTimeout, ensuring they execute after React's render cycle.
 * 
 * Usage:
 * ```typescript
 * import { safeToast } from "@/lib/safeToast";
 * 
 * // In event handlers
 * onClick={() => {
 *   safeToast.success("Operation successful!");
 * }}
 * ```
 */

export const safeToast = {
  /**
   * Display a success toast message
   * @param message - The message to display
   * @param options - Optional toast configuration
   */
  success: (message: string, options?: Parameters<typeof toast.success>[1]) => {
    setTimeout(() => {
      toast.success(message, options);
    }, 0);
  },

  /**
   * Display an error toast message
   * @param message - The message to display
   * @param options - Optional toast configuration
   */
  error: (message: string, options?: Parameters<typeof toast.error>[1]) => {
    setTimeout(() => {
      toast.error(message, options);
    }, 0);
  },

  /**
   * Display an info toast message
   * @param message - The message to display
   * @param options - Optional toast configuration
   */
  info: (message: string, options?: Parameters<typeof toast.info>[1]) => {
    setTimeout(() => {
      toast.info(message, options);
    }, 0);
  },

  /**
   * Display a warning toast message
   * @param message - The message to display
   * @param options - Optional toast configuration
   */
  warning: (message: string, options?: Parameters<typeof toast.warning>[1]) => {
    setTimeout(() => {
      toast.warning(message, options);
    }, 0);
  },
};
