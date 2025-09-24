#!/usr/bin/env node

/**
 * Monetized MCP Server Example with x402 Integration
 *
 * This MCP server demonstrates how to add NANDA Points payment requirements
 * to premium tools while keeping some tools free.
 *
 * Key changes from the free version:
 * 1. Import NANDA SDK for payment integration
 * 2. Wrap premium tools with payment requirements
 * 3. Configure facilitator connection
 * 4. Set pricing per tool
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
// import { withNandaPayment, NandaPaymentConfig } from '@nanda/x402-facilitator';

// TODO: Replace with actual NANDA SDK when published
// For now, we'll simulate the payment wrapper
interface NandaPaymentConfig {
  facilitatorUrl: string;
  agentName: string;
  pricing: Record<string, string>;
}

function withNandaPayment(handler: any, config: NandaPaymentConfig) {
  return async (args: any) => {
    // TODO: Implement actual payment verification
    // For now, simulate payment check
    console.log(`💰 Payment check for tool - Agent: ${config.agentName}`);
    return handler(args);
  };
}

// Tool input schemas (same as before)
const SearchArgsSchema = z.object({
  query: z.string().describe("Search query"),
  maxResults: z.number().optional().default(5).describe("Maximum number of results")
});

const SummarizeArgsSchema = z.object({
  text: z.string().describe("Text to summarize"),
  maxLength: z.number().optional().default(100).describe("Maximum length of summary")
});

const AnalyzeArgsSchema = z.object({
  text: z.string().describe("Text to analyze"),
  analysisType: z.enum(["sentiment", "keywords", "entities"]).describe("Type of analysis")
});

// Payment configuration
const paymentConfig: NandaPaymentConfig = {
  facilitatorUrl: process.env.FACILITATOR_URL || 'http://localhost:3000',
  agentName: process.env.AGENT_NAME || 'search-agent',
  pricing: {
    'search': '5 NP',        // 5 NANDA Points per search
    'analyze': '10 NP',      // 10 NANDA Points per analysis
    // summarize is free
  }
};

// Create MCP server
const server = new Server({
  name: "expert-agent-monetized",
  version: "1.0.0"
}, {
  capabilities: {
    tools: {}
  }
});

// PAID search tool (5 NP)
server.addTool({
  name: "search",
  description: "🔒 Premium search for information on any topic (5 NP)",
  inputSchema: SearchArgsSchema.shape,
  handler: withNandaPayment(async (args: any) => {
    const { query, maxResults } = SearchArgsSchema.parse(args);

    // Enhanced search results (premium quality)
    const results = Array.from({ length: Math.min(maxResults, 5) }, (_, i) => ({
      title: `🔍 Premium: ${query} - Result ${i + 1}`,
      url: `https://premium.example.com/result-${i + 1}`,
      snippet: `Premium search result for "${query}". Enhanced content with deeper insights and analysis.`,
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
            cost: "5 NP"
          }, null, 2)
        }
      ]
    };
  }, paymentConfig)
});

// FREE summarization tool (no payment required)
server.addTool({
  name: "summarize",
  description: "📝 Free text summarization (no payment required)",
  inputSchema: SummarizeArgsSchema.shape,
  handler: async (args) => {
    const { text, maxLength } = SummarizeArgsSchema.parse(args);

    // Basic summarization (same as free version)
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

// PAID analysis tool (10 NP)
server.addTool({
  name: "analyze",
  description: "🔒 Premium text analysis - sentiment, keywords, entities (10 NP)",
  inputSchema: AnalyzeArgsSchema.shape,
  handler: withNandaPayment(async (args: any) => {
    const { text, analysisType } = AnalyzeArgsSchema.parse(args);

    let analysis;
    switch (analysisType) {
      case "sentiment":
        analysis = {
          type: "sentiment",
          score: 0.7,
          label: "positive",
          confidence: 0.85
        };
        break;
      case "keywords":
        analysis = {
          type: "keywords",
          keywords: ["example", "analysis", "premium"],
          relevance: [0.9, 0.8, 0.7]
        };
        break;
      case "entities":
        analysis = {
          type: "entities",
          entities: [
            { text: "analysis", type: "CONCEPT", confidence: 0.9 }
          ]
        };
        break;
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            text: text.substring(0, 100) + "...",
            analysisType,
            analysis,
            premium: true,
            cost: "10 NP"
          }, null, 2)
        }
      ]
    };
  }, paymentConfig)
});

// FREE server info tool
server.addTool({
  name: "getServerInfo",
  description: "ℹ️ Get information about this monetized MCP server",
  inputSchema: {},
  handler: async () => {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            name: "Expert Agent (Monetized)",
            version: "1.0.0",
            description: "MCP server with NANDA Points payment integration",
            tools: {
              free: ["summarize", "getServerInfo", "health"],
              paid: {
                "search": "5 NP per search",
                "analyze": "10 NP per analysis"
              }
            },
            facilitator: paymentConfig.facilitatorUrl,
            agentName: paymentConfig.agentName,
            transport: "Streamable HTTP with x402 payment integration"
          }, null, 2)
        }
      ]
    };
  }
});

// FREE health check
server.addTool({
  name: "health",
  description: "Health check endpoint",
  inputSchema: {},
  handler: async () => {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            status: "healthy",
            timestamp: new Date().toISOString(),
            server: "expert-agent-monetized",
            facilitator: paymentConfig.facilitatorUrl,
            paymentStatus: "integrated"
          }, null, 2)
        }
      ]
    };
  }
});

// Start server with Streamable HTTP transport
async function main() {
  const port = parseInt(process.env.PORT || '3002');
  const host = process.env.HOST || 'localhost';

  const transport = new StreamableHTTPServerTransport(`http://${host}:${port}/mcp`);

  await server.connect(transport);

  console.log(`✅ Expert Agent (Monetized) MCP Server running on http://${host}:${port}/mcp`);
  console.log(`📋 Free tools: summarize, getServerInfo, health`);
  console.log(`💰 Paid tools: search (5 NP), analyze (10 NP)`);
  console.log(`🏦 Facilitator: ${paymentConfig.facilitatorUrl}`);
  console.log(`🔗 Test with: curl -X GET http://${host}:${port}/health`);
}

main().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});