export {};

declare global {
  interface RazorpayCheckoutResponse {
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
  }

  interface RazorpayCheckoutOptions {
    key: string;
    amount: number;
    currency: string;
    name: string;
    description: string;
    order_id: string;
    prefill?: { name?: string; email?: string; contact?: string };
    notes?: Record<string, string>;
    theme?: { color?: string };
    modal?: { ondismiss?: () => void };
    handler: (response: RazorpayCheckoutResponse) => void | Promise<void>;
  }

  interface RazorpayCheckoutInstance {
    open(): void;
    on(event: string, handler: (response: unknown) => void): void;
  }

  interface Window {
    Razorpay?: new (options: RazorpayCheckoutOptions) => RazorpayCheckoutInstance;
  }
}
