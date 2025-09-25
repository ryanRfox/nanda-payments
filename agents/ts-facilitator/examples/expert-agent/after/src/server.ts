#!/usr/bin/env node

/**
 * Expert Agent MCP Server with x402 Payment Integration
 *
 * This MCP server demonstrates proper x402 payment integration using:
 * - Streamable HTTP transport for MCP communication
 * - x402-axios for automatic payment handling
 * - NANDA facilitator for payment processing
 * - Mixed free/paid tool architecture
 *
 * Based on Coinbase x402 MCP example but adapted for HTTP transport
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import axios from 'axios';
import { config } from 'dotenv';
import { Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { withPaymentInterceptor } from 'x402-axios';
import { z } from 'zod';

config();

// Configuration from environment
const privateKey = process.env.PRIVATE_KEY as Hex;
const facilitatorUrl = process.env.FACILITATOR_URL || 'http://localhost:3000';
const port = parseInt(process.env.PORT || '3002');
const host = process.env.HOST || 'localhost';

if (!privateKey) {
  console.error('❌ Missing PRIVATE_KEY environment variable');
  console.log('Please set PRIVATE_KEY to a valid private key for payment signing');
  process.exit(1);
}

// Create payment-enabled HTTP client
const account = privateKeyToAccount(privateKey);
const paymentClient = withPaymentInterceptor(axios.create(), account);

// Tool input schemas
const SearchArgsSchema = z.object({
  query: z.string().describe("Search query"),
  maxResults: z.number().optional().default(5).describe("Maximum number of results")
});

const AnalyzeArgsSchema = z.object({
  text: z.string().describe("Text to analyze"),
  analysisType: z.enum(["sentiment", "keywords", "entities"]).describe("Type of analysis")
});

const SummarizeArgsSchema = z.object({
  text: z.string().describe("Text to summarize"),
  maxLength: z.number().optional().default(100).describe("Maximum length of summary")
});

// Create MCP server
const server = new Server({
  name: "expert-agent-with-x402",
  version: "1.0.0"
}, {
  capabilities: {
    tools: {}
  }
});

/**
 * PAID: Premium search tool (5 NP)
 * Uses payment-enabled client to make requests to paid endpoints
 */
server.addTool({
  name: "search",
  description: "🔒 Premium search for information (5 NP)",
  inputSchema: SearchArgsSchema.shape,
  handler: async (args) => {
    const { query, maxResults } = SearchArgsSchema.parse(args);

    try {
      // This will trigger x402 payment flow if needed
      const response = await paymentClient.post(`${facilitatorUrl}/api/tools/search`, {
        query,
        maxResults
      });

      const results = Array.from({ length: Math.min(maxResults, 5) }, (_, i) => ({
        title: `🔍 Premium: ${query} - Result ${i + 1}`,
        url: `https://premium.example.com/result-${i + 1}`,
        snippet: `Premium search result for "${query}". Enhanced content with deeper insights.`,
        relevanceScore: 0.95 - (i * 0.1),
        source: "Premium Database"
      }));

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              query,
              results,
              totalResults: results.length,
              premium: true,
              cost: "5 NP",
              paymentConfirmed: true
            }, null, 2)
          }
        ]
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              error: "Payment required for premium search",
              details: error.message,
              cost: "5 NP",
              facilitator: facilitatorUrl
            }, null, 2)
          }
        ]
      };
    }
  }
});

/**
 * PAID: Premium analysis tool (10 NP)
 * Advanced text analysis with payment requirement
 */
server.addTool({
  name: "analyze",
  description: "🔒 Premium text analysis - sentiment, keywords, entities (10 NP)",
  inputSchema: AnalyzeArgsSchema.shape,
  handler: async (args) => {
    const { text, analysisType } = AnalyzeArgsSchema.parse(args);

    try {
      // This will trigger x402 payment flow if needed
      const response = await paymentClient.post(`${facilitatorUrl}/api/tools/analyze`, {
        text,
        analysisType
      });

      let analysis;
      switch (analysisType) {
        case "sentiment":
          analysis = {
            type: "sentiment",
            score: 0.7,
            label: "positive",
            confidence: 0.85,
            aspects: ["clarity", "tone", "engagement"]
          };
          break;
        case "keywords":
          analysis = {
            type: "keywords",
            keywords: ["innovation", "technology", "analysis", "premium"],
            relevance: [0.95, 0.88, 0.82, 0.75],
            density: 0.12
          };
          break;
        case "entities":
          analysis = {
            type: "entities",
            entities: [
              { text: "analysis", type: "CONCEPT", confidence: 0.92 },
              { text: "premium", type: "FEATURE", confidence: 0.88 }
            ],
            entityCount: 2
          };
          break;
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              text: text.substring(0, 100) + (text.length > 100 ? "..." : ""),
              textLength: text.length,
              analysisType,
              analysis,
              premium: true,
              cost: "10 NP",
              paymentConfirmed: true
            }, null, 2)
          }
        ]
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              error: "Payment required for premium analysis",
              details: error.message,
              cost: "10 NP",
              facilitator: facilitatorUrl
            }, null, 2)
          }
        ]
      };
    }
  }
});

/**
 * FREE: Basic summarization tool
 * No payment required for basic functionality
 */
server.addTool({
  name: "summarize",
  description: "📝 Free text summarization (no payment required)",
  inputSchema: SummarizeArgsSchema.shape,
  handler: async (args) => {
    const { text, maxLength } = SummarizeArgsSchema.parse(args);

    const summary = text.length > maxLength
      ? text.substring(0, maxLength - 3) + "..."
      : text;

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            originalLength: text.length,
            summaryLength: summary.length,
            summary,
            premium: false,
            cost: "Free"
          }, null, 2)
        }
      ]
    };
  }
});

/**
 * FREE: Server information tool
 * Provides details about available tools and pricing
 */
server.addTool({
  name: "getServerInfo",
  description: "ℹ️ Get information about this MCP server and its pricing",
  inputSchema: {},
  handler: async () => {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            name: "Expert Agent with x402",
            version: "1.0.0",
            description: "MCP server with x402 payment integration via NANDA facilitator",
            transport: "Streamable HTTP",
            tools: {
              free: ["summarize", "getServerInfo", "health"],
              paid: {
                "search": "5 NP per search - Premium search with enhanced results",
                "analyze": "10 NP per analysis - Advanced text analysis (sentiment, keywords, entities)"
              }
            },
            facilitator: facilitatorUrl,
            paymentMethod: "x402 Protocol with NANDA Points",
            wallet: account.address,
            endpoint: `http://${host}:${port}/mcp`
          }, null, 2)
        }
      ]
    };
  }
});

/**
 * FREE: Health check tool
 * System health and connectivity status
 */
server.addTool({
  name: "health",
  description: "🏥 Health check for server and payment system",
  inputSchema: {},
  handler: async () => {
    let facilitatorStatus = "unknown";
    try {
      const response = await axios.get(`${facilitatorUrl}/health`, { timeout: 5000 });
      facilitatorStatus = response.status === 200 ? "healthy" : "unhealthy";
    } catch (error) {
      facilitatorStatus = "unreachable";
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            status: "healthy",
            timestamp: new Date().toISOString(),
            server: "expert-agent-with-x402",
            transport: "Streamable HTTP",
            endpoint: `http://${host}:${port}/mcp`,
            facilitator: {
              url: facilitatorUrl,
              status: facilitatorStatus
            },
            paymentSystem: {
              type: "x402 Protocol",
              currency: "NANDA Points",
              wallet: account.address
            }
          }, null, 2)
        }
      ]
    };
  }
});

// Start server
async function main() {
  try {
    const transport = new StreamableHTTPServerTransport(`http://${host}:${port}/mcp`);

    await server.connect(transport);

    console.log(`✅ Expert Agent MCP Server with x402 running`);
    console.log(`🌐 Endpoint: http://${host}:${port}/mcp`);
    console.log(`💰 Payment System: x402 Protocol with NANDA Points`);
    console.log(`🏦 Facilitator: ${facilitatorUrl}`);
    console.log(`👛 Wallet: ${account.address}`);
    console.log();
    console.log(`📋 Available Tools:`);
    console.log(`   FREE: summarize, getServerInfo, health`);
    console.log(`   PAID: search (5 NP), analyze (10 NP)`);
    console.log();
    console.log(`🧪 Test commands:`);
    console.log(`   curl -X POST http://${host}:${port}/mcp -H "Content-Type: application/json" -d '{"method":"tools/call","params":{"name":"health","arguments":{}}}'`);

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('❌ Unhandled error:', error);
  process.exit(1);
});