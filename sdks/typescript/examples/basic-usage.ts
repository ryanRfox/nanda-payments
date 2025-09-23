/**
 * Basic usage example for NANDA Payments SDK
 */

import { NandaPaymentsClient, createMockFacilitator } from '../src/index.js';

async function basicExample() {
  // Start a mock facilitator for testing
  const mockFacilitator = createMockFacilitator({ port: 3001 });
  await mockFacilitator.start();

  try {
    // Create a client
    const client = new NandaPaymentsClient({
      agentName: 'example-app',
      facilitatorUrl: 'http://localhost:3001',
    });

    console.log('🚀 NANDA Payments SDK Example');
    console.log('===============================\n');

    // Test connection
    console.log('Testing connection...');
    const isConnected = await client.testConnection();
    console.log(`Connection: ${isConnected ? '✅ Success' : '❌ Failed'}\n`);

    // Get supported schemes
    console.log('Getting supported payment schemes...');
    const supported = await client.getSupportedSchemes();
    console.log(`Supported schemes: ${supported.kinds.length}\n`);

    // Set initial balance for testing
    mockFacilitator.setAgentBalance('example-app', 100);

    // Get balance
    console.log('Getting agent balance...');
    const balance = await client.getBalance();
    console.log(`Current balance: ${balance.balance} ${balance.currency}\n`);

    // Simulate making a request that requires payment
    console.log('Making a payment request...');
    try {
      const response = await client.makePaymentRequest(
        'https://api.example.com/premium-content',
        {
          amount: 10,
          recipient: 'content-provider',
          description: 'Access to premium content',
        },
        {
          method: 'GET',
        }
      );

      console.log('Payment request completed!');
      console.log(`Status: ${response.status}`);
      if (response.paymentResponse) {
        console.log(`Transaction ID: ${response.paymentResponse.txId}`);
        console.log(`Amount: ${response.paymentResponse.amount} NP`);
      }
    } catch (error: any) {
      console.log(`Payment request failed: ${error.message}`);
    }

    console.log('\n🎉 Example completed successfully!');

  } finally {
    // Clean up
    await mockFacilitator.stop();
  }
}

async function agentManagementExample() {
  const mockFacilitator = createMockFacilitator({ port: 3002 });
  await mockFacilitator.start();

  try {
    const client = new NandaPaymentsClient({
      agentName: 'agent-example',
      facilitatorUrl: 'http://localhost:3002',
    });

    console.log('\n📊 Agent Management Example');
    console.log('============================\n');

    // Set up some test data
    mockFacilitator.setAgentBalance('agent-example', 500);

    // Get agent summary
    console.log('Getting agent summary...');
    const summary = await client.getSummary();
    console.log(`Balance: ${summary.balance} NP`);
    console.log(`Total sent: ${summary.totalSent} NP`);
    console.log(`Total received: ${summary.totalReceived} NP`);
    console.log(`Transaction count: ${summary.transactionCount}`);
    console.log(`Last activity: ${summary.lastActivity || 'None'}\n`);

    // Get agent info
    console.log('Getting agent information...');
    const agentInfo = await client.getAgentInfo();
    console.log(`Agent name: ${agentInfo.agent_name}`);
    console.log(`Wallet ID: ${agentInfo.walletId}`);
    console.log(`Service charge: ${agentInfo.serviceCharge}%\n`);

    // Get wallet info
    console.log('Getting wallet information...');
    const walletInfo = await client.getWalletInfo();
    console.log(`Wallet ID: ${walletInfo.walletId}`);
    console.log(`Balance: ${walletInfo.balanceMinor} ${walletInfo.currency}`);
    console.log(`Scale: ${walletInfo.scale}`);

  } finally {
    await mockFacilitator.stop();
  }
}

// Run examples
async function runExamples() {
  try {
    await basicExample();
    await agentManagementExample();
  } catch (error) {
    console.error('Example failed:', error);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runExamples();
}