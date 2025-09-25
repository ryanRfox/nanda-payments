#!/usr/bin/env node

/**
 * Expert Agent MCP Server - Free Version
 *
 * This is the "before" version showing a standard MCP server
 * before adding x402 payment integration. All tools are free.
 *
 * Features:
 * - Streamable HTTP transport for MCP communication
 * - Multiple AI tools (search, analyze, summarize)
 * - Server info and health check endpoints
 * - No payment requirements
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';

// Configuration
const port = parseInt(process.env.PORT || '3001');
const host = process.env.HOST || 'localhost';

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
const server = new McpServer({
  name: "expert-agent-free",
  version: "1.0.0"
});

/**
 * FREE: Basic search tool
 * Simple search functionality without payment
 */
server.tool(
  "search",
  "🔍 Free search for information",
  SearchArgsSchema.shape,
  async (args) => {
    const { query, maxResults } = SearchArgsSchema.parse(args);

    // Basic search results (limited quality)
    const results = Array.from({ length: Math.min(maxResults, 3) }, (_, i) => ({
      title: `Basic: ${query} - Result ${i + 1}`,
      url: `https://example.com/result-${i + 1}`,
      snippet: `Basic search result for "${query}". Limited content and basic insights.`,
      relevanceScore: 0.7 - (i * 0.1),
      source: "Free Database"
    }));

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            query,
            results,
            totalResults: results.length,
            premium: false,
            cost: "Free",
            limitation: "Basic results with limited depth and accuracy"
          }, null, 2)
        }
      ]
    };
  }
);

/**
 * FREE: Basic analysis tool
 * Simple text analysis without payment
 */
server.tool(
  "analyze",
  "📊 Free basic text analysis",
AnalyzeArgsSchema.shape,
  async (args) => {
    const { text, analysisType } = AnalyzeArgsSchema.parse(args);

    let analysis;
    switch (analysisType) {
      case "sentiment":
        analysis = {
          type: "sentiment",
          score: 0.5,  // Basic neutral analysis
          label: "neutral",
          confidence: 0.6  // Lower confidence
        };
        break;
      case "keywords":
        analysis = {
          type: "keywords",
          keywords: ["text", "analysis"],  // Limited keywords
          relevance: [0.6, 0.5]  // Lower relevance
        };
        break;
      case "entities":
        analysis = {
          type: "entities",
          entities: [
            { text: "text", type: "CONCEPT", confidence: 0.6 }
          ]  // Basic entity recognition
        };
        break;
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            text: text.substring(0, 50) + (text.length > 50 ? "..." : ""),
            textLength: text.length,
            analysisType,
            analysis,
            premium: false,
            cost: "Free",
            limitation: "Basic analysis with limited accuracy and depth"
          }, null, 2)
        }
      ]
    };
  }
);

/**
 * FREE: Basic summarization tool
 * Simple text summarization
 */
server.tool(
  "summarize",
  "📝 Free text summarization",
SummarizeArgsSchema.shape,
  async (args) => {
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
);

/**
 * FREE: Server information tool
 */
server.tool(
  "getServerInfo",
  "ℹ️ Get information about this free MCP server",
{},
  async () => {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            name: "Expert Agent (Free Version)",
            version: "1.0.0",
            description: "Standard MCP server with free tools - no payment system",
            transport: "Streamable HTTP",
            tools: {
              free: ["search", "analyze", "summarize", "getServerInfo", "health"],
              paid: "none - all tools are free with basic functionality"
            },
            monetization: "none",
            endpoint: `http://${host}:${port}/mcp`,
            limitations: [
              "Search limited to 3 basic results",
              "Analysis provides basic insights only",
              "No premium features or enhanced accuracy"
            ]
          }, null, 2)
        }
      ]
    };
  }
);

/**
 * FREE: Health check tool
 */
server.tool(
  "health",
  "🏥 Health check for the free server",
{},
  async () => {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            status: "healthy",
            timestamp: new Date().toISOString(),
            server: "expert-agent-free",
            transport: "Streamable HTTP",
            endpoint: `http://${host}:${port}/mcp`,
            paymentSystem: "none - all tools are free",
            limitations: "Basic functionality only"
          }, null, 2)
        }
      ]
    };
  }
);

// Start server
async function main() {
  try {
    const transport = new StreamableHTTPServerTransport();

    await server.connect(transport);

    console.log(`✅ Expert Agent (Free) MCP Server running`);
    console.log(`🌐 Endpoint: http://${host}:${port}/mcp`);
    console.log(`💰 Payment System: None - All tools are free`);
    console.log();
    console.log(`📋 Available Tools (All Free):`);
    console.log(`   🔍 search - Basic search with limited results`);
    console.log(`   📊 analyze - Basic text analysis`);
    console.log(`   📝 summarize - Text summarization`);
    console.log(`   ℹ️  getServerInfo - Server information`);
    console.log(`   🏥 health - Health check`);
    console.log();
    console.log(`⚠️  Limitations:`);
    console.log(`   - Search limited to 3 basic results`);
    console.log(`   - Analysis provides basic insights only`);
    console.log(`   - No premium features or enhanced accuracy`);
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