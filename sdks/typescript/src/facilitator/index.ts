/**
 * Facilitator API client for NANDA Points
 * Handles communication with the x402 facilitator service
 */

import fetch from 'node-fetch';
import {
  PaymentPayload,
  PaymentRequirements,
  VerificationResponse,
  SettlementResponse,
  SupportedResponse,
  NPPaymentError,
  NPNetworkError,
  NPTimeoutError,
} from '../types/index.js';

export interface FacilitatorClientOptions {
  facilitatorUrl: string;
  timeout?: number;
  retryCount?: number;
  retryDelay?: number;
}

export class FacilitatorClient {
  private readonly baseUrl: string;
  private readonly timeout: number;
  private readonly retryCount: number;
  private readonly retryDelay: number;

  constructor(options: FacilitatorClientOptions) {
    this.baseUrl = options.facilitatorUrl.replace(/\/$/, ''); // Remove trailing slash
    this.timeout = options.timeout ?? 30000; // 30 seconds default
    this.retryCount = options.retryCount ?? 3;
    this.retryDelay = options.retryDelay ?? 1000; // 1 second default
  }

  /**
   * Verify a payment with the facilitator
   */
  async verify(
    payment: PaymentPayload,
    requirements: PaymentRequirements
  ): Promise<VerificationResponse> {
    return this.withRetry(async () => {
      const response = await this.makeRequest('/verify', {
        method: 'POST',
        body: JSON.stringify({
          payment,
          paymentRequirements: requirements,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        return {
          isValid: false,
          invalidReason: error.invalidReason || 'Verification failed',
        };
      }

      return await response.json() as VerificationResponse;
    });
  }

  /**
   * Settle a payment with the facilitator
   */
  async settle(
    payment: PaymentPayload,
    requirements: PaymentRequirements
  ): Promise<SettlementResponse> {
    return this.withRetry(async () => {
      const response = await this.makeRequest('/settle', {
        method: 'POST',
        body: JSON.stringify({
          payment,
          paymentRequirements: requirements,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new NPPaymentError(
          'Settlement failed',
          'SETTLEMENT_ERROR',
          result
        );
      }

      return result as SettlementResponse;
    });
  }

  /**
   * Get supported payment schemes from the facilitator
   */
  async supported(): Promise<SupportedResponse> {
    return this.withRetry(async () => {
      const response = await this.makeRequest('/supported', {
        method: 'GET',
      });

      if (!response.ok) {
        throw new NPPaymentError(
          'Failed to get supported schemes',
          'FACILITATOR_ERROR'
        );
      }

      return await response.json() as SupportedResponse;
    });
  }

  /**
   * Check facilitator health
   */
  async health(): Promise<{ status: string; timestamp: number }> {
    try {
      const response = await this.makeRequest('/health', {
        method: 'GET',
      });

      if (!response.ok) {
        throw new NPNetworkError('Facilitator health check failed');
      }

      const data = await response.json();
      return {
        status: data.status || 'unknown',
        timestamp: Date.now(),
      };
    } catch (error) {
      throw new NPNetworkError(
        'Failed to check facilitator health',
        error
      );
    }
  }

  /**
   * Make an HTTP request with timeout and error handling
   */
  private async makeRequest(
    endpoint: string,
    options: {
      method: string;
      body?: string;
      headers?: Record<string, string>;
    }
  ): Promise<Response> {
    const url = `${this.baseUrl}${endpoint}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method: options.method,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': '@nanda/payments-sdk',
          ...options.headers,
        },
        body: options.body,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response as any;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new NPTimeoutError(
            `Request timed out after ${this.timeout}ms`,
            { url, timeout: this.timeout }
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
   * Execute a function with retry logic
   */
  private async withRetry<T>(
    operation: () => Promise<T>,
    attempt = 1
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      // Don't retry certain types of errors
      if (
        error instanceof NPPaymentError &&
        ['VERIFICATION_FAILED', 'SETTLEMENT_FAILED'].includes(error.code)
      ) {
        throw error;
      }

      // If we've exhausted retries, throw the error
      if (attempt >= this.retryCount) {
        throw error;
      }

      // Wait before retrying
      await new Promise(resolve =>
        setTimeout(resolve, this.retryDelay * attempt)
      );

      // Recursive retry with incremented attempt counter
      return this.withRetry(operation, attempt + 1);
    }
  }
}