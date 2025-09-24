#!/usr/bin/env node

/**
 * Standard Free MCP Server Example
 *
 * This is a basic MCP server providing free search and summarization tools.
 * All tools are accessible without any payment requirements.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';

// Tool input schemas
const SearchArgsSchema = z.object({
  query: z.string().describe("Search query"),
  maxResults: z.number().optional().default(5).describe("Maximum number of results")
});

const SummarizeArgsSchema = z.object({
  text: z.string().describe("Text to summarize"),
  maxLength: z.number().optional().default(100).describe("Maximum length of summary")
});

// Create MCP server
const server = new Server({
  name: "expert-agent-free",
  version: "1.0.0"
}, {
  capabilities: {
    tools: {}
  }
});

// Free search tool
server.addTool({
  name: "search",
  description: "Search for information on any topic",
  inputSchema: SearchArgsSchema.shape,
  handler: async (args) => {
    const { query, maxResults } = SearchArgsSchema.parse(args);

    // Simulate search results
    const results = Array.from({ length: Math.min(maxResults, 3) }, (_, i) => ({
      title: `${query} - Result ${i + 1}`,
      url: `https://example.com/result-${i + 1}`,
      snippet: `This is a search result for "${query}". Lorem ipsum dolor sit amet, consectetur adipiscing elit.`
    }));

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            query,
            results,
            totalResults: results.length
          }, null, 2)
        }
      ]
    };
  }
});

// Free summarization tool
server.addTool({
  name: "summarize",
  description: "Summarize text content",
  inputSchema: SummarizeArgsSchema.shape,
  handler: async (args) => {
    const { text, maxLength } = SummarizeArgsSchema.parse(args);

    // Simple summarization (truncate to maxLength)
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
            summary
          }, null, 2)
        }
      ]
    };
  }
});

// Free info tool
server.addTool({
  name: "getServerInfo",
  description: "Get information about this MCP server",
  inputSchema: {},
  handler: async () => {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            name: "Expert Agent (Free)",
            version: "1.0.0",
            description: "Standard MCP server providing free search and summarization tools",
            tools: ["search", "summarize", "getServerInfo"],
            pricing: "All tools are free",
            transport: "Streamable HTTP"
          }, null, 2)
        }
      ]
    };
  }
});

// Start server with Streamable HTTP transport
async function main() {
  const port = parseInt(process.env.PORT || '3001');
  const host = process.env.HOST || 'localhost';

  const transport = new StreamableHTTPServerTransport(`http://${host}:${port}/mcp`);

  await server.connect(transport);

  console.log(`✅ Expert Agent (Free) MCP Server running on http://${host}:${port}/mcp`);
  console.log(`📋 Available tools: search, summarize, getServerInfo`);
  console.log(`💰 All tools are FREE - no payment required`);
  console.log(`🔗 Test with: curl -X GET http://${host}:${port}/health`);
}

// Health check endpoint
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
            server: "expert-agent-free"
          }, null, 2)
        }
      ]
    };
  }
});

main().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});