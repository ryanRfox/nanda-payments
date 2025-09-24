import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { NandaClient } from '@nanda/sdk';
import 'dotenv/config';

/**
 * Example Processing Service with x402 Payment for Compute Resources
 *
 * This example demonstrates a compute service that charges for processing power:
 * - Variable pricing based on computational complexity
 * - Background job processing with status tracking
 * - Resource estimation and cost calculation
 * - Queue management with priority based on payment
 */

const app = new Hono();

// Initialize NANDA client
const nandaClient = new NandaClient({
  facilitatorUrl: process.env.FACILITATOR_URL || 'http://localhost:8080',
  agentName: 'processing-service-demo',
});

// Mock job storage (in production, use Redis or database)
const jobStorage = new Map<string, any>();
const jobQueue: any[] = [];

// Processing job types with different costs
const PROCESSING_JOBS = {
  'image-resize': {
    baseCost: 10, // 0.10 NP
    costPerMB: 5,  // 0.05 NP per MB
    description: 'Image resizing and optimization',
    estimatedTime: '1-5 seconds'
  },
  'video-transcode': {
    baseCost: 100, // 1.00 NP
    costPerMB: 20,  // 0.20 NP per MB
    description: 'Video transcoding and compression',
    estimatedTime: '30-300 seconds'
  },
  'data-analysis': {
    baseCost: 200, // 2.00 NP
    costPerRow: 1,  // 0.01 NP per 1000 rows
    description: 'Statistical data analysis',
    estimatedTime: '10-60 seconds'
  },
  'ml-inference': {
    baseCost: 300, // 3.00 NP
    costPerSample: 5, // 0.05 NP per sample
    description: 'Machine learning model inference',
    estimatedTime: '5-30 seconds'
  },
  'report-generation': {
    baseCost: 150, // 1.50 NP
    costPerPage: 10, // 0.10 NP per page
    description: 'PDF report generation',
    estimatedTime: '15-45 seconds'
  }
};

// Calculate job cost based on parameters
const calculateJobCost = (jobType: string, parameters: any): number => {
  const jobConfig = PROCESSING_JOBS[jobType as keyof typeof PROCESSING_JOBS];
  if (!jobConfig) return 0;

  let cost = jobConfig.baseCost;

  switch (jobType) {
    case 'image-resize':
    case 'video-transcode':
      if (parameters.fileSizeMB) {
        cost += Math.ceil(parameters.fileSizeMB) * (jobConfig.costPerMB || 0);
      }
      break;
    case 'data-analysis':
      if (parameters.rowCount) {
        cost += Math.ceil(parameters.rowCount / 1000) * (jobConfig.costPerRow || 0);
      }
      break;
    case 'ml-inference':
      if (parameters.sampleCount) {
        cost += parameters.sampleCount * (jobConfig.costPerSample || 0);
      }
      break;
    case 'report-generation':
      if (parameters.pageCount) {
        cost += parameters.pageCount * (jobConfig.costPerPage || 0);
      }
      break;
  }

  return Math.max(cost, jobConfig.baseCost);
};

// Job processing simulation
const processJob = async (jobId: string, jobType: string, parameters: any): Promise<any> => {
  const job = jobStorage.get(jobId);
  if (!job) throw new Error('Job not found');

  job.status = 'processing';
  job.startedAt = new Date().toISOString();

  // Simulate processing time based on job complexity
  const processingTime = calculateProcessingTime(jobType, parameters);
  await new Promise(resolve => setTimeout(resolve, processingTime));

  // Generate mock results
  const result = generateMockResult(jobType, parameters);

  job.status = 'completed';
  job.completedAt = new Date().toISOString();
  job.result = result;
  job.processingTimeMs = processingTime;

  return job;
};

const calculateProcessingTime = (jobType: string, parameters: any): number => {
  // Simulate realistic processing times
  const baseTime = {
    'image-resize': 1000,
    'video-transcode': 5000,
    'data-analysis': 3000,
    'ml-inference': 2000,
    'report-generation': 4000
  }[jobType] || 1000;

  const complexityMultiplier = Math.max(1, (parameters.fileSizeMB || parameters.rowCount / 1000 || parameters.sampleCount / 10 || parameters.pageCount || 1));

  return Math.floor(baseTime * complexityMultiplier * (0.8 + Math.random() * 0.4));
};

const generateMockResult = (jobType: string, parameters: any): any => {
  switch (jobType) {
    case 'image-resize':
      return {
        originalSize: `${parameters.width || 1920}x${parameters.height || 1080}`,
        newSize: `${parameters.targetWidth || 800}x${parameters.targetHeight || 600}`,
        compressionRatio: 0.65,
        outputUrl: `https://cdn.example.com/processed/${Date.now()}.jpg`
      };
    case 'video-transcode':
      return {
        originalFormat: parameters.inputFormat || 'mp4',
        outputFormat: parameters.outputFormat || 'webm',
        originalBitrate: '2.5 Mbps',
        outputBitrate: '1.2 Mbps',
        duration: '00:05:23',
        outputUrl: `https://cdn.example.com/processed/${Date.now()}.webm`
      };
    case 'data-analysis':
      return {
        totalRows: parameters.rowCount || 1000,
        summary: {
          mean: Math.random() * 100,
          median: Math.random() * 100,
          standardDeviation: Math.random() * 30
        },
        correlations: [
          { variables: ['A', 'B'], coefficient: Math.random() * 2 - 1 }
        ],
        reportUrl: `https://reports.example.com/analysis/${Date.now()}.pdf`
      };
    case 'ml-inference':
      return {
        model: parameters.modelType || 'classification',
        predictions: Array.from({ length: parameters.sampleCount || 1 }, () => ({
          class: Math.random() > 0.5 ? 'positive' : 'negative',
          confidence: Math.random()
        })),
        averageConfidence: Math.random(),
        processingRate: `${Math.floor(Math.random() * 1000)} samples/sec`
      };
    case 'report-generation':
      return {
        totalPages: parameters.pageCount || 5,
        sections: ['Executive Summary', 'Data Analysis', 'Conclusions'],
        charts: parameters.includeCharts ? Math.floor(Math.random() * 5) + 1 : 0,
        reportUrl: `https://reports.example.com/generated/${Date.now()}.pdf`
      };
    default:
      return { message: 'Processing completed successfully' };
  }
};

// Middleware for job payment
const requireJobPayment = () => {
  return async (c: any, next: any) => {
    const jobType = c.req.valid('json').jobType;
    const parameters = c.req.valid('json').parameters || {};

    const cost = calculateJobCost(jobType, parameters);
    const jobConfig = PROCESSING_JOBS[jobType as keyof typeof PROCESSING_JOBS];

    const paymentHeader = c.req.header('x-payment');

    if (!paymentHeader) {
      return c.json({
        error: 'Payment Required',
        job: {
          type: jobType,
          description: jobConfig?.description,
          estimatedCost: cost,
          estimatedTime: jobConfig?.estimatedTime,
          parameters
        },
        x402: {
          cost,
          description: `Processing job: ${jobType}`,
          currency: 'NP',
          facilitatorUrl: process.env.FACILITATOR_URL || 'http://localhost:8080',
        }
      }, 402);
    }

    try {
      const paymentData = JSON.parse(paymentHeader);
      const verification = await nandaClient.verifyPayment(paymentData);

      if (!verification.valid) {
        return c.json({
          error: 'Invalid Payment',
          reason: verification.reason
        }, 402);
      }

      c.set('paymentSession', verification.sessionId);
      c.set('jobCost', cost);

      await next();

      // Settle payment after job completion
      if (verification.sessionId) {
        await nandaClient.settlePayment({
          sessionId: verification.sessionId,
          paymentPayload: paymentData.paymentPayload
        });
      }
    } catch (error) {
      console.error('Payment processing error:', error);
      return c.json({
        error: 'Payment Processing Failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      }, 402);
    }
  };
};

// Routes
app.get('/', (c) => {
  return c.json({
    service: 'NANDA Processing Service Demo',
    version: '1.0.0',
    description: 'Compute service with usage-based x402 payments',
    availableJobs: Object.entries(PROCESSING_JOBS).map(([type, config]) => ({
      type,
      description: config.description,
      baseCost: config.baseCost,
      estimatedTime: config.estimatedTime
    }))
  });
});

// Job cost estimation endpoint (free)
const estimateSchema = z.object({
  jobType: z.enum(['image-resize', 'video-transcode', 'data-analysis', 'ml-inference', 'report-generation']),
  parameters: z.object({
    fileSizeMB: z.number().optional(),
    rowCount: z.number().optional(),
    sampleCount: z.number().optional(),
    pageCount: z.number().optional(),
    width: z.number().optional(),
    height: z.number().optional()
  }).optional()
});

app.post('/estimate',
  zValidator('json', estimateSchema),
  (c) => {
    const { jobType, parameters = {} } = c.req.valid('json');
    const cost = calculateJobCost(jobType, parameters);
    const jobConfig = PROCESSING_JOBS[jobType as keyof typeof PROCESSING_JOBS];

    return c.json({
      jobType,
      parameters,
      estimatedCost: cost,
      costBreakdown: {
        baseCost: jobConfig.baseCost,
        variableCost: cost - jobConfig.baseCost,
        total: cost
      },
      estimatedTime: jobConfig.estimatedTime,
      description: jobConfig.description
    });
  }
);

// Submit job endpoint (requires payment)
const jobSchema = z.object({
  jobType: z.enum(['image-resize', 'video-transcode', 'data-analysis', 'ml-inference', 'report-generation']),
  parameters: z.object({
    fileSizeMB: z.number().optional(),
    rowCount: z.number().optional(),
    sampleCount: z.number().optional(),
    pageCount: z.number().optional(),
    width: z.number().optional(),
    height: z.number().optional(),
    targetWidth: z.number().optional(),
    targetHeight: z.number().optional(),
    inputFormat: z.string().optional(),
    outputFormat: z.string().optional(),
    modelType: z.string().optional(),
    includeCharts: z.boolean().optional()
  }).optional(),
  priority: z.enum(['low', 'normal', 'high']).optional().default('normal')
});

app.post('/jobs',
  zValidator('json', jobSchema),
  requireJobPayment(),
  async (c) => {
    const { jobType, parameters = {}, priority } = c.req.valid('json');
    const paymentSession = c.get('paymentSession');
    const jobCost = c.get('jobCost');

    // Generate job ID
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2)}`;

    // Create job record
    const job = {
      id: jobId,
      type: jobType,
      parameters,
      priority,
      status: 'queued',
      cost: jobCost,
      paymentSession,
      createdAt: new Date().toISOString(),
      estimatedTime: PROCESSING_JOBS[jobType as keyof typeof PROCESSING_JOBS].estimatedTime
    };

    jobStorage.set(jobId, job);
    jobQueue.push(job);

    // Start processing immediately (in production, use proper queue system)
    processJob(jobId, jobType, parameters).catch(error => {
      console.error(`Job ${jobId} failed:`, error);
      const failedJob = jobStorage.get(jobId);
      if (failedJob) {
        failedJob.status = 'failed';
        failedJob.error = error.message;
      }
    });

    return c.json({
      jobId,
      status: 'queued',
      type: jobType,
      parameters,
      cost: jobCost,
      estimatedTime: job.estimatedTime,
      statusUrl: `/jobs/${jobId}`,
      createdAt: job.createdAt
    });
  }
);

// Job status endpoint (free)
app.get('/jobs/:id', (c) => {
  const jobId = c.req.param('id');
  const job = jobStorage.get(jobId);

  if (!job) {
    return c.json({ error: 'Job not found' }, 404);
  }

  return c.json({
    id: job.id,
    type: job.type,
    status: job.status,
    parameters: job.parameters,
    cost: job.cost,
    createdAt: job.createdAt,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
    processingTimeMs: job.processingTimeMs,
    result: job.result,
    error: job.error
  });
});

// List jobs endpoint (free)
app.get('/jobs', (c) => {
  const status = c.req.query('status');
  const limit = parseInt(c.req.query('limit') || '10');

  let jobs = Array.from(jobStorage.values());

  if (status) {
    jobs = jobs.filter(job => job.status === status);
  }

  jobs = jobs
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit);

  return c.json({
    jobs: jobs.map(job => ({
      id: job.id,
      type: job.type,
      status: job.status,
      cost: job.cost,
      createdAt: job.createdAt,
      completedAt: job.completedAt
    })),
    total: jobs.length,
    queue: {
      pending: Array.from(jobStorage.values()).filter(job => job.status === 'queued').length,
      processing: Array.from(jobStorage.values()).filter(job => job.status === 'processing').length,
      completed: Array.from(jobStorage.values()).filter(job => job.status === 'completed').length,
      failed: Array.from(jobStorage.values()).filter(job => job.status === 'failed').length
    }
  });
});

// Service statistics (free)
app.get('/stats', (c) => {
  const jobs = Array.from(jobStorage.values());
  const totalJobs = jobs.length;
  const totalRevenue = jobs.reduce((sum, job) => sum + (job.cost || 0), 0);

  const jobsByType = Object.keys(PROCESSING_JOBS).map(type => ({
    type,
    count: jobs.filter(job => job.type === type).length,
    revenue: jobs.filter(job => job.type === type).reduce((sum, job) => sum + (job.cost || 0), 0)
  }));

  return c.json({
    totalJobs,
    totalRevenue,
    averageJobCost: totalJobs > 0 ? Math.round(totalRevenue / totalJobs) : 0,
    jobsByType,
    uptime: Math.floor(process.uptime()),
    memoryUsage: process.memoryUsage(),
    queueSize: jobQueue.length
  });
});

// Error handling
app.onError((err, c) => {
  console.error('Server error:', err);
  return c.json({
    error: 'Internal Server Error',
    message: err.message
  }, 500);
});

app.notFound((c) => {
  return c.json({
    error: 'Not Found',
    message: 'The requested resource does not exist',
    available_endpoints: [
      'GET /',
      'POST /estimate',
      'POST /jobs',
      'GET /jobs',
      'GET /jobs/:id',
      'GET /stats'
    ]
  }, 404);
});

const port = parseInt(process.env.PORT || '3005');

console.log(`⚙️  Processing Service with x402 payments starting on port ${port}`);
console.log(`💰 Variable pricing based on computational complexity`);
console.log(`🔧 Available jobs: ${Object.keys(PROCESSING_JOBS).join(', ')}`);
console.log(`🔗 Facilitator: ${process.env.FACILITATOR_URL || 'http://localhost:8080'}`);

export default {
  port,
  fetch: app.fetch,
};