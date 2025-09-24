# Expert Agent Example: Before & After x402 Monetization

This example demonstrates how to transform a standard free MCP server into a monetized service using the NANDA x402 ecosystem.

## Overview

**Before**: A standard MCP server providing free search and summarization tools
**After**: The same server with x402 payment protection, earning NANDA Points for usage

## Key Changes

### 1. Transport Layer
- **Before**: Could use stdio transport
- **After**: Uses Streamable HTTP transport for web compatibility

### 2. Tool Access
- **Before**: All tools are free
- **After**: Premium tools require NP payment

### 3. Payment Integration
- **Before**: No payment logic
- **After**: Integrated with NANDA Facilitator for verification/settlement

## Running the Examples

### Before (Free MCP Server)
```bash
cd before/
npm install
npm run dev
# Accessible at http://localhost:3001/mcp
```

### After (Monetized with x402)
```bash
cd after/
npm install
npm run dev
# Accessible at http://localhost:3002/mcp
```

## Developer Journey

This example shows the **minimal changes** needed to monetize an existing MCP server:

1. **Add NANDA SDK**: `npm install @nanda/x402-facilitator`
2. **Wrap premium tools**: Apply payment middleware to selected tools
3. **Configure pricing**: Set NP costs per tool
4. **Update transport**: Use Streamable HTTP for web clients

The result: **Earn NANDA Points for providing valuable AI agent services** while maintaining full compatibility with the MCP ecosystem.

## Files Structure

```
before/                 # Original free MCP server
├── src/
│   ├── server.ts      # Standard MCP server
│   └── tools/         # Free tools (search, summarize)
└── package.json

after/                  # Monetized version
├── src/
│   ├── server.ts      # MCP server with x402 protection
│   └── tools/         # Mix of free and paid tools
└── package.json
```

## Next Steps

After reviewing this example, you can:
1. **Integrate your existing MCP server** using the patterns shown
2. **Use the NANDA SDK** for simple framework integration
3. **Configure your facilitator** connection and pricing
4. **Start earning NANDA Points** for your AI agent services