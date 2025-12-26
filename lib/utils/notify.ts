import toast from 'react-hot-toast';

interface PromiseMessages {
  loading: string;
  success: string;
  error: string;
}

class Notify {
  /**
   * Show a success toast notification
   * @param message - The message to display
   */
  success(message: string) {
    return toast.success(message);
  }

  /**
   * Show an error toast notification
   * @param message - The message to display
   */
  error(message: string) {
    return toast.error(message);
  }

  /**
   * Show an info toast notification
   * @param message - The message to display
   */
  info(message: string) {
    return toast(message, {
      icon: 'ℹ️',
      style: {
        border: '1px solid #dbeafe',
        background: '#eff6ff',
        color: '#1e40af',
      },
    });
  }

  /**
   * Show a promise-based toast notification (essential for file downloads)
   * @param promise - The promise to track
   * @param messages - Object containing loading, success, and error messages
   */
  promise<T>(
    promise: Promise<T>,
    messages: PromiseMessages
  ) {
    return toast.promise(promise, {
      loading: messages.loading,
      success: messages.success,
      error: messages.error,
    });
  }

  /**
   * Show a loading toast (returns the toast ID for dismissal)
   * @param message - The loading message
   */
  loading(message: string) {
    return toast.loading(message);
  }

  /**
   * Dismiss a specific toast by ID
   * @param toastId - The toast ID to dismiss
   */
  dismiss(toastId: string) {
    toast.dismiss(toastId);
  }

  /**
   * Dismiss all toasts
   */
  dismissAll() {
    toast.dismiss();
  }
}

// Create a singleton instance
const notify = new Notify();

export { notify };
export default notify;
export type { PromiseMessages };
