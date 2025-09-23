/**
 * Core payment client for NANDA Points with x402 protocol support
 */

import fetch from 'node-fetch';
import {
  PaymentPayload,
  PaymentRequirements,
  PaymentOptions,
  RequestOptions,
  PaymentRequiredResponse,
  SuccessfulResponse,
  NPPaymentError,
  NPNetworkError,
  NPTimeoutError,
  NandaPaymentsClientConfig,
} from '../types/index.js';
import { FacilitatorClient } from '../facilitator/index.js';

export class PaymentClient {
  private readonly agentName: string;
  private readonly facilitator: FacilitatorClient;
  private readonly timeout: number;

  constructor(config: NandaPaymentsClientConfig) {
    this.agentName = config.agentName;
    this.facilitator = new FacilitatorClient({
      facilitatorUrl: config.facilitatorUrl,
      timeout: config.timeout,
      retryCount: config.retryCount,
      retryDelay: config.retryDelay,
    });
    this.timeout = config.timeout || 30000;
  }

  /**
   * Make an x402-compliant request to a resource
   */
  async makeRequest<T = unknown>(
    url: string,
    options: RequestOptions = {},
    payment?: PaymentPayload
  ): Promise<SuccessfulResponse<T>> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': '@nanda/payments-sdk',
      ...options.headers,
    };

    // Add payment header if provided
    if (payment) {
      headers['X-PAYMENT'] = this.encodePayment(payment);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      options.timeout || this.timeout
    );

    try {
      const response = await fetch(url, {
        method: options.method || 'GET',
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Handle x402 Payment Required
      if (response.status === 402) {
        const paymentRequired = await response.json() as PaymentRequiredResponse;
        return {
          data: null as T,
          headers: this.headersToObject(response.headers),
          status: 402,
          paymentRequired: paymentRequired,
        } as SuccessfulResponse<T> & { paymentRequired: PaymentRequiredResponse };
      }

      // Handle successful responses
      if (response.ok) {
        const data = await response.json() as T;
        const responseHeaders = this.headersToObject(response.headers);

        // Parse payment response header if present
        let paymentResponse;
        const paymentResponseHeader = response.headers.get('X-PAYMENT-RESPONSE');
        if (paymentResponseHeader) {
          try {
            paymentResponse = JSON.parse(atob(paymentResponseHeader));
          } catch (error) {
            console.warn('Failed to parse X-PAYMENT-RESPONSE header:', error);
          }
        }

        return {
          data,
          headers: responseHeaders,
          status: response.status,
          paymentResponse,
        };
      }

      // Handle other HTTP errors
      const errorData = await response.json().catch(() => ({}));
      throw new NPNetworkError(
        `HTTP ${response.status}: ${response.statusText}`,
        { status: response.status, url, errorData }
      );
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof NPNetworkError) {
        throw error;
      }

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new NPTimeoutError(
            `Request timed out after ${options.timeout || this.timeout}ms`,
            { url, timeout: options.timeout || this.timeout }
          );
        }

        throw new NPNetworkError(
          `Network request failed: ${error.message}`,
          { url, originalError: error }
        );
      }

      throw new NPNetworkError('Unknown network error', { url });
    }
  }

  /**
   * Create a payment for a specific amount and recipient
   */
  async createPayment(options: PaymentOptions): Promise<PaymentPayload> {
    // Generate a unique transaction ID
    const txId = this.generateTransactionId();

    const payment: PaymentPayload = {
      x402Version: 1,
      scheme: "nanda-points",
      network: "nanda-network",
      payTo: options.recipient,
      amount: options.amount.toString(),
      from: this.agentName,
      txId,
      timestamp: Date.now(),
      extra: options.description ? { description: options.description } : undefined,
    };

    return payment;
  }

  /**
   * Make a payment request with automatic payment handling
   */
  async makePaymentRequest<T = unknown>(
    url: string,
    paymentOptions: PaymentOptions,
    requestOptions: RequestOptions = {}
  ): Promise<SuccessfulResponse<T>> {
    // First, try the request without payment to see if payment is required
    const initialResponse = await this.makeRequest<T>(url, requestOptions);

    // If no payment required, return the response
    if (initialResponse.status !== 402) {
      return initialResponse;
    }

    // Payment is required - get payment requirements
    const paymentRequired = (initialResponse as any).paymentRequired;
    if (!paymentRequired || !paymentRequired.accepts?.[0]) {
      throw new NPPaymentError(
        'Invalid payment requirements in 402 response',
        'INVALID_PAYMENT_REQUIREMENTS',
        paymentRequired
      );
    }

    const requirements = paymentRequired.accepts[0];

    // Create payment
    const payment = await this.createPayment({
      amount: parseInt(requirements.maxAmountRequired),
      recipient: requirements.payTo,
      description: paymentOptions.description || requirements.description,
      timeout: paymentOptions.timeout,
    });

    // Verify payment with facilitator first
    const verification = await this.facilitator.verify(payment, requirements);
    if (!verification.isValid) {
      throw new NPPaymentError(
        `Payment verification failed: ${verification.invalidReason}`,
        'VERIFICATION_FAILED',
        verification
      );
    }

    // Make the request again with payment
    const paidResponse = await this.makeRequest<T>(url, requestOptions, payment);

    // If payment was successful, settle it
    if (paidResponse.status < 400) {
      try {
        await this.facilitator.settle(payment, requirements);
      } catch (error) {
        console.warn('Payment settlement failed (request succeeded):', error);
        // Don't fail the response for settlement issues
      }
    }

    return paidResponse;
  }

  /**
   * Encode payment payload for X-PAYMENT header
   */
  private encodePayment(payload: PaymentPayload): string {
    try {
      return btoa(JSON.stringify(payload));
    } catch (error) {
      throw new NPPaymentError(
        'Failed to encode payment payload',
        'ENCODING_ERROR',
        error
      );
    }
  }

  /**
   * Convert Headers object to plain object
   */
  private headersToObject(headers: any): Record<string, string> {
    const result: Record<string, string> = {};

    if (headers.forEach) {
      headers.forEach((value: string, key: string) => {
        result[key] = value;
      });
    } else if (headers.entries) {
      for (const [key, value] of headers.entries()) {
        result[key] = value;
      }
    }

    return result;
  }

  /**
   * Generate a unique transaction ID
   */
  private generateTransactionId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2);
    return `np_${timestamp}_${random}`;
  }
}