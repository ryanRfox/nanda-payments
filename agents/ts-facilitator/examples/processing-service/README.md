# Processing Service Example with x402 Usage-Based Payments

This example demonstrates a compute-intensive service that charges for processing power using x402 payments. Perfect for services like image processing, data analysis, ML inference, or any compute-heavy tasks.

## Overview

A processing service that offers:
- **Variable pricing**: Cost based on computational complexity and resource usage
- **Multiple job types**: Image processing, video transcoding, data analysis, ML inference, report generation
- **Queue management**: Background processing with status tracking
- **Cost estimation**: Free cost calculation before payment
- **Real-time monitoring**: Job status tracking and service statistics

## Features

- **Usage-Based Pricing**: Pay only for actual compute resources consumed
- **Multiple Processing Types**: Different services with appropriate pricing models
- **Cost Estimation**: Calculate costs before submitting jobs
- **Job Queue Management**: Background processing with priority handling
- **Status Tracking**: Real-time job status and result retrieval
- **Service Analytics**: Processing statistics and performance metrics

## Processing Job Types

### Image Processing (`image-resize`)
- **Base cost**: 0.10 NP
- **Variable cost**: 0.05 NP per MB
- **Use case**: Image resizing, optimization, format conversion

### Video Transcoding (`video-transcode`)
- **Base cost**: 1.00 NP
- **Variable cost**: 0.20 NP per MB
- **Use case**: Video compression, format conversion, quality adjustment

### Data Analysis (`data-analysis`)
- **Base cost**: 2.00 NP
- **Variable cost**: 0.01 NP per 1000 rows
- **Use case**: Statistical analysis, data mining, trend analysis

### ML Inference (`ml-inference`)
- **Base cost**: 3.00 NP
- **Variable cost**: 0.05 NP per sample
- **Use case**: Machine learning model predictions, classification

### Report Generation (`report-generation`)
- **Base cost**: 1.50 NP
- **Variable cost**: 0.10 NP per page
- **Use case**: PDF reports, charts, data visualization

## Setup

```bash
# Install dependencies
npm install

# Set environment variables
export FACILITATOR_URL=http://localhost:8080
export PORT=3005

# Run development server
npm run dev

# Or build and run production
npm run build
npm start
```

## API Endpoints

### Free Endpoints
- `GET /` - Service overview and available job types
- `POST /estimate` - Cost estimation for jobs (no payment required)
- `GET /jobs` - List jobs (with optional status filtering)
- `GET /jobs/:id` - Get job status and results
- `GET /stats` - Service statistics and performance metrics

### Paid Endpoints
- `POST /jobs` - Submit processing job (requires payment)

## Usage Examples

### Cost Estimation (Free)
```bash
curl -X POST http://localhost:3005/estimate \
  -H "Content-Type: application/json" \
  -d '{
    "jobType": "image-resize",
    "parameters": {
      "fileSizeMB": 5,
      "width": 1920,
      "height": 1080,
      "targetWidth": 800,
      "targetHeight": 600
    }
  }'
```

Response:
```json
{
  "jobType": "image-resize",
  "estimatedCost": 35,
  "costBreakdown": {
    "baseCost": 10,
    "variableCost": 25,
    "total": 35
  },
  "estimatedTime": "1-5 seconds",
  "description": "Image resizing and optimization"
}
```

### Submit Processing Job

#### Without Payment (returns 402)
```bash
curl -X POST http://localhost:3005/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "jobType": "data-analysis",
    "parameters": {
      "rowCount": 50000
    },
    "priority": "normal"
  }'
```

#### With Payment
```bash
curl -X POST http://localhost:3005/jobs \
  -H "Content-Type: application/json" \
  -H "x-payment: {\"paymentPayload\": {...}, \"paymentRequirements\": {...}}" \
  -d '{
    "jobType": "data-analysis",
    "parameters": {
      "rowCount": 50000
    }
  }'
```

Response:
```json
{
  "jobId": "job_1234567890_abc123",
  "status": "queued",
  "type": "data-analysis",
  "cost": 250,
  "estimatedTime": "10-60 seconds",
  "statusUrl": "/jobs/job_1234567890_abc123",
  "createdAt": "2024-01-20T10:30:00Z"
}
```

### Check Job Status
```bash
curl http://localhost:3005/jobs/job_1234567890_abc123
```

### List All Jobs
```bash
# All jobs
curl http://localhost:3005/jobs

# Only completed jobs
curl http://localhost:3005/jobs?status=completed&limit=5
```

## Integration Patterns

### 1. Cost Calculation
```typescript
const calculateJobCost = (jobType: string, parameters: any): number => {
  const jobConfig = PROCESSING_JOBS[jobType];
  let cost = jobConfig.baseCost;

  // Add variable costs based on resource usage
  switch (jobType) {
    case 'image-resize':
      cost += Math.ceil(parameters.fileSizeMB) * jobConfig.costPerMB;
      break;
    case 'data-analysis':
      cost += Math.ceil(parameters.rowCount / 1000) * jobConfig.costPerRow;
      break;
    // ... other job types
  }

  return Math.max(cost, jobConfig.baseCost);
};
```

### 2. Payment Middleware
```typescript
const requireJobPayment = () => {
  return async (c: any, next: any) => {
    const cost = calculateJobCost(jobType, parameters);

    if (!paymentHeader) {
      return c.json({
        error: 'Payment Required',
        x402: { cost, description: `Processing job: ${jobType}` }
      }, 402);
    }

    // Verify payment, process job, settle payment
  };
};
```

### 3. Background Processing
```typescript
const processJob = async (jobId: string, jobType: string, parameters: any) => {
  const job = jobStorage.get(jobId);
  job.status = 'processing';

  try {
    const result = await performActualProcessing(jobType, parameters);
    job.status = 'completed';
    job.result = result;
  } catch (error) {
    job.status = 'failed';
    job.error = error.message;
  }
};
```

## Pricing Models

### Resource-Based Pricing
- **File processing**: Base cost + size-based multiplier
- **Data processing**: Base cost + row/record-based pricing
- **ML inference**: Base cost + per-sample pricing

### Priority-Based Pricing
- **Low priority**: Standard pricing, slower queue
- **High priority**: 2x multiplier, faster processing

### Batch Pricing
- **Volume discounts**: Reduced per-unit cost for large jobs
- **Bulk processing**: Single payment for multiple operations

## Job Lifecycle

1. **Cost Estimation** - Calculate costs before payment (free)
2. **Payment Verification** - Verify x402 payment for exact cost
3. **Job Queuing** - Add to processing queue with priority
4. **Background Processing** - Execute job asynchronously
5. **Result Storage** - Store results for retrieval
6. **Payment Settlement** - Complete payment after successful processing

## Monitoring and Analytics

### Job Statistics
- Total jobs processed
- Revenue generated
- Average processing time
- Success/failure rates

### Resource Usage
- CPU utilization
- Memory consumption
- Queue length
- Processing throughput

## Environment Variables

- `FACILITATOR_URL` - URL of the NANDA facilitator service
- `PORT` - Port to run the service on (default: 3005)
- `MAX_CONCURRENT_JOBS` - Maximum concurrent processing jobs
- `JOB_TIMEOUT_MS` - Job processing timeout

## Production Considerations

### Scaling
- **Queue Systems**: Use Redis or RabbitMQ for job queues
- **Worker Processes**: Separate job processing from API handling
- **Load Balancing**: Distribute processing across multiple instances

### Monitoring
- **Job Metrics**: Track processing times, success rates, costs
- **Resource Monitoring**: CPU, memory, disk usage
- **Payment Analytics**: Revenue tracking, cost analysis

### Security
- **Resource Limits**: Prevent resource exhaustion attacks
- **Input Validation**: Sanitize job parameters
- **Rate Limiting**: Prevent service abuse

This example demonstrates how compute-intensive services can monetize processing power using the NANDA x402 ecosystem with fair, usage-based pricing.