#!/usr/bin/env node

/**
 * Simple Expert Agent for Testing
 *
 * This creates a basic HTTP server that simulates an expert agent with:
 * - FREE endpoints: /health, /info
 * - PAID endpoints: /search, /analyze (returns x402 responses when no payment)
 */

const http = require('http');
const url = require('url');

const port = 3001;

// Mock payment verification
function createX402Response(cost, description, endpoint) {
  return {
    error: 'Payment Required',
    x402: {
      cost: cost,
      description: description,
      currency: 'NP',
      facilitatorUrl: 'http://localhost:3000',
      scheme: 'exact',
      network: 'nanda-network',
      resource: endpoint
    }
  };
}

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const path = parsedUrl.pathname;
  const method = req.method;

  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-payment');

  if (method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Helper to send JSON response
  function sendJson(statusCode, data) {
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data, null, 2));
  }

  // FREE: Health check
  if (path === '/health' && method === 'GET') {
    sendJson(200, {
      status: 'healthy',
      server: 'test-expert-agent',
      port: port,
      timestamp: new Date().toISOString(),
      facilitator: 'http://localhost:3000'
    });
    return;
  }

  // FREE: Service info
  if (path === '/info' && method === 'GET') {
    sendJson(200, {
      name: 'Test Expert Agent',
      version: '1.0.0',
      description: 'Simple expert agent for testing x402 payments',
      endpoints: {
        free: [
          'GET /health - Health check',
          'GET /info - Service information'
        ],
        paid: [
          'POST /search - AI search service (5.00 NP)',
          'POST /analyze - Text analysis service (10.00 NP)'
        ]
      },
      facilitator: 'http://localhost:3000',
      pricing: {
        search: '5.00 NP',
        analyze: '10.00 NP'
      }
    });
    return;
  }

  // PAID: Search service (5.00 NP)
  if (path === '/search' && method === 'POST') {
    const paymentHeader = req.headers['x-payment'];

    if (!paymentHeader) {
      sendJson(402, createX402Response(500, 'AI search service', '/search'));
      return;
    }

    // If we have a payment header, simulate successful search
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', () => {
      try {
        const { query } = JSON.parse(body);
        sendJson(200, {
          query: query || 'example search',
          results: [
            {
              title: 'Premium Search Result 1',
              snippet: 'High-quality search result with detailed information...',
              url: 'https://example.com/result1',
              relevance: 0.95
            },
            {
              title: 'Premium Search Result 2',
              snippet: 'Another excellent search result with valuable content...',
              url: 'https://example.com/result2',
              relevance: 0.88
            }
          ],
          premium: true,
          cost: '5.00 NP',
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        sendJson(400, { error: 'Invalid JSON in request body' });
      }
    });
    return;
  }

  // PAID: Analysis service (10.00 NP)
  if (path === '/analyze' && method === 'POST') {
    const paymentHeader = req.headers['x-payment'];

    if (!paymentHeader) {
      sendJson(402, createX402Response(1000, 'Text analysis service', '/analyze'));
      return;
    }

    // If we have a payment header, simulate successful analysis
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', () => {
      try {
        const { text, analysisType } = JSON.parse(body);
        let analysis;

        switch (analysisType) {
          case 'sentiment':
            analysis = {
              sentiment: 'positive',
              score: 0.75,
              confidence: 0.89
            };
            break;
          case 'keywords':
            analysis = {
              keywords: ['example', 'analysis', 'premium', 'content'],
              relevance: [0.9, 0.8, 0.7, 0.6]
            };
            break;
          default:
            analysis = {
              sentiment: 'neutral',
              score: 0.0,
              confidence: 0.95,
              keywords: ['text', 'analysis'],
              entities: []
            };
        }

        sendJson(200, {
          text: (text || 'example text').substring(0, 100) + '...',
          analysisType: analysisType || 'comprehensive',
          analysis: analysis,
          premium: true,
          cost: '10.00 NP',
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        sendJson(400, { error: 'Invalid JSON in request body' });
      }
    });
    return;
  }

  // 404 for unknown endpoints
  sendJson(404, {
    error: 'Not Found',
    message: 'Endpoint not found',
    availableEndpoints: [
      'GET /health',
      'GET /info',
      'POST /search (requires payment)',
      'POST /analyze (requires payment)'
    ]
  });
});

server.listen(port, () => {
  console.log(`🤖 Test Expert Agent running on http://localhost:${port}`);
  console.log(`📋 Free endpoints: /health, /info`);
  console.log(`💰 Paid endpoints: /search (5.00 NP), /analyze (10.00 NP)`);
  console.log(`🔗 Facilitator: http://localhost:3000`);
  console.log(`🧪 Test with: curl http://localhost:${port}/health`);
});