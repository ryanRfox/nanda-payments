# NANDA Facilitator Deployment Guide

Comprehensive guide for deploying the NANDA TypeScript Facilitator in various environments, from development to production.

## Overview

The NANDA Facilitator is designed to be deployed as a containerized microservice with MongoDB as the backing store. This guide covers:

- Local development setup
- Docker containerization
- Kubernetes deployment
- Cloud platform deployment (AWS, GCP, Azure)
- Production configuration and scaling

## Prerequisites

- Node.js 20+ (for local development)
- Docker and Docker Compose
- MongoDB 6.0+ or MongoDB Atlas
- Kubernetes cluster (for K8s deployment)
- Cloud platform account (for cloud deployment)

## Local Development

### Quick Start

```bash
# Clone and install
git clone https://github.com/nanda/ts-facilitator
cd ts-facilitator
npm install

# Set up environment
cp .env.example .env
# Edit .env with your configuration

# Start MongoDB (local)
docker run -d --name mongodb \
  -p 27017:27017 \
  -v mongodb_data:/data/db \
  mongo:6.0

# Start facilitator
cd packages/facilitator
npm run dev
```

### Environment Configuration

```bash
# .env file for development
NODE_ENV=development
PORT=8080

# Database
MONGODB_URI=mongodb://localhost:27017
MONGODB_DB_NAME=nanda_development

# Security (development only)
SESSION_EXPIRATION_MINUTES=60
PERIODIC_CLEANUP_MINUTES=30
CORS_ORIGINS=http://localhost:3000,http://localhost:3001

# Logging
LOG_LEVEL=debug
```

### Development Docker Compose

```yaml
# docker-compose.dev.yml
version: '3.8'

services:
  mongodb:
    image: mongo:6.0
    ports:
      - "27017:27017"
    volumes:
      - mongodb_data:/data/db
    environment:
      - MONGO_INITDB_DATABASE=nanda_development

  facilitator:
    build:
      context: .
      dockerfile: Dockerfile.dev
    ports:
      - "8080:8080"
    depends_on:
      - mongodb
    environment:
      - NODE_ENV=development
      - MONGODB_URI=mongodb://mongodb:27017
      - MONGODB_DB_NAME=nanda_development
    volumes:
      - ./packages/facilitator/src:/app/src
      - ./packages/sdk/src:/app/packages/sdk/src

volumes:
  mongodb_data:
```

## Docker Deployment

### Production Dockerfile

```dockerfile
# Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY packages/facilitator/package.json packages/facilitator/
COPY packages/sdk/package.json packages/sdk/

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY packages/ packages/
COPY tsconfig.json ./

# Build application
RUN npm run build

# Production image
FROM node:20-alpine AS production

WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S facilitator -u 1001

# Copy built application
COPY --from=builder /app/packages/facilitator/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/facilitator/package.json ./

# Set ownership
RUN chown -R facilitator:nodejs /app
USER facilitator

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://localhost:8080/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

EXPOSE 8080

CMD ["node", "dist/server.js"]
```

### Docker Compose Production

```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  mongodb:
    image: mongo:6.0
    restart: unless-stopped
    volumes:
      - mongodb_data:/data/db
      - ./scripts/mongo-init.js:/docker-entrypoint-initdb.d/mongo-init.js:ro
    environment:
      - MONGO_INITDB_ROOT_USERNAME=${MONGO_ROOT_USERNAME}
      - MONGO_INITDB_ROOT_PASSWORD=${MONGO_ROOT_PASSWORD}
      - MONGO_INITDB_DATABASE=${MONGO_DB_NAME}
    networks:
      - facilitator-network
    ports:
      - "27017:27017"

  facilitator:
    build:
      context: .
      dockerfile: Dockerfile
    restart: unless-stopped
    ports:
      - "8080:8080"
    depends_on:
      - mongodb
    environment:
      - NODE_ENV=production
      - PORT=8080
      - MONGODB_URI=mongodb://mongodb:27017
      - MONGODB_DB_NAME=${MONGO_DB_NAME}
      - SESSION_EXPIRATION_MINUTES=30
      - LOG_LEVEL=info
      - CORS_ORIGINS=${CORS_ORIGINS}
    networks:
      - facilitator-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  nginx:
    image: nginx:alpine
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
    depends_on:
      - facilitator
    networks:
      - facilitator-network

networks:
  facilitator-network:
    driver: bridge

volumes:
  mongodb_data:
```

### Environment Configuration

```bash
# .env.prod
NODE_ENV=production
MONGO_ROOT_USERNAME=admin
MONGO_ROOT_PASSWORD=secure-password-here
MONGO_DB_NAME=nanda_production
CORS_ORIGINS=https://app.example.com,https://api.example.com
```

## Kubernetes Deployment

### ConfigMap and Secrets

```yaml
# k8s/configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: facilitator-config
data:
  NODE_ENV: "production"
  PORT: "8080"
  MONGODB_DB_NAME: "nanda_production"
  SESSION_EXPIRATION_MINUTES: "30"
  PERIODIC_CLEANUP_MINUTES: "30"
  LOG_LEVEL: "info"
  CORS_ORIGINS: "https://app.example.com"

---
apiVersion: v1
kind: Secret
metadata:
  name: facilitator-secrets
type: Opaque
data:
  MONGODB_URI: bW9uZ29kYitzcnY6Ly91c2VyOnBhc3NAY2x1c3Rlci5tb25nb2RiLm5ldC9uYW5kYQ== # base64 encoded
```

### Deployment

```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: facilitator
  labels:
    app: facilitator
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 1
      maxSurge: 1
  selector:
    matchLabels:
      app: facilitator
  template:
    metadata:
      labels:
        app: facilitator
    spec:
      containers:
      - name: facilitator
        image: nanda/facilitator:latest
        ports:
        - containerPort: 8080
          name: http
        envFrom:
        - configMapRef:
            name: facilitator-config
        - secretRef:
            name: facilitator-secrets
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3
        readinessProbe:
          httpGet:
            path: /ready
            port: 8080
          initialDelaySeconds: 5
          periodSeconds: 5
          timeoutSeconds: 3
          failureThreshold: 3
        startupProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 10
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 30
```

### Service and Ingress

```yaml
# k8s/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: facilitator-service
spec:
  selector:
    app: facilitator
  ports:
  - name: http
    port: 80
    targetPort: 8080
  type: ClusterIP

---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: facilitator-ingress
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
    nginx.ingress.kubernetes.io/rate-limit: "100"
    nginx.ingress.kubernetes.io/rate-limit-window: "1m"
spec:
  tls:
  - hosts:
    - facilitator.example.com
    secretName: facilitator-tls
  rules:
  - host: facilitator.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: facilitator-service
            port:
              number: 80
```

### Horizontal Pod Autoscaler

```yaml
# k8s/hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: facilitator-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: facilitator
  minReplicas: 3
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
      - type: Percent
        value: 100
        periodSeconds: 15
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
      - type: Percent
        value: 10
        periodSeconds: 60
```

## Cloud Platform Deployments

### AWS ECS with Fargate

```yaml
# aws/task-definition.json
{
  "family": "facilitator-task",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "executionRoleArn": "arn:aws:iam::123456789012:role/ecsTaskExecutionRole",
  "taskRoleArn": "arn:aws:iam::123456789012:role/ecsTaskRole",
  "containerDefinitions": [
    {
      "name": "facilitator",
      "image": "123456789012.dkr.ecr.us-east-1.amazonaws.com/nanda/facilitator:latest",
      "portMappings": [
        {
          "containerPort": 8080,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {"name": "NODE_ENV", "value": "production"},
        {"name": "PORT", "value": "8080"},
        {"name": "SESSION_EXPIRATION_MINUTES", "value": "30"},
        {"name": "LOG_LEVEL", "value": "info"}
      ],
      "secrets": [
        {
          "name": "MONGODB_URI",
          "valueFrom": "arn:aws:secretsmanager:us-east-1:123456789012:secret:facilitator/mongodb-uri"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/facilitator",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      },
      "healthCheck": {
        "command": ["CMD-SHELL", "curl -f http://localhost:8080/health || exit 1"],
        "interval": 30,
        "timeout": 5,
        "retries": 3,
        "startPeriod": 60
      }
    }
  ]
}
```

### AWS CloudFormation Template

```yaml
# aws/cloudformation.yaml
AWSTemplateFormatVersion: '2010-09-09'
Description: 'NANDA Facilitator Infrastructure'

Parameters:
  VpcId:
    Type: AWS::EC2::VPC::Id
  SubnetIds:
    Type: List<AWS::EC2::Subnet::Id>
  MongoDbUri:
    Type: String
    NoEcho: true

Resources:
  # ECS Cluster
  ECSCluster:
    Type: AWS::ECS::Cluster
    Properties:
      ClusterName: facilitator-cluster
      CapacityProviders:
        - FARGATE
        - FARGATE_SPOT

  # ALB
  LoadBalancer:
    Type: AWS::ElasticLoadBalancingV2::LoadBalancer
    Properties:
      Name: facilitator-alb
      Scheme: internet-facing
      Type: application
      Subnets: !Ref SubnetIds
      SecurityGroups:
        - !Ref ALBSecurityGroup

  # ECS Service
  ECSService:
    Type: AWS::ECS::Service
    DependsOn: ALBListener
    Properties:
      ServiceName: facilitator-service
      Cluster: !Ref ECSCluster
      LaunchType: FARGATE
      DesiredCount: 3
      TaskDefinition: !Ref TaskDefinition
      NetworkConfiguration:
        AwsvpcConfiguration:
          SecurityGroups:
            - !Ref ECSSecurityGroup
          Subnets: !Ref SubnetIds
          AssignPublicIp: ENABLED
      LoadBalancers:
        - ContainerName: facilitator
          ContainerPort: 8080
          TargetGroupArn: !Ref TargetGroup

  # Auto Scaling
  ServiceScalingTarget:
    Type: AWS::ApplicationAutoScaling::ScalableTarget
    Properties:
      MaxCapacity: 10
      MinCapacity: 3
      ResourceId: !Sub service/${ECSCluster}/facilitator-service
      RoleARN: !Sub arn:aws:iam::${AWS::AccountId}:role/application-autoscaling-ecs-service
      ScalableDimension: ecs:service:DesiredCount
      ServiceNamespace: ecs

  ServiceScalingPolicy:
    Type: AWS::ApplicationAutoScaling::ScalingPolicy
    Properties:
      PolicyName: facilitator-scaling-policy
      PolicyType: TargetTrackingScaling
      ScalingTargetId: !Ref ServiceScalingTarget
      TargetTrackingScalingPolicyConfiguration:
        PredefinedMetricSpecification:
          PredefinedMetricType: ECSServiceAverageCPUUtilization
        TargetValue: 70.0
        ScaleOutCooldown: 60
        ScaleInCooldown: 300

Outputs:
  LoadBalancerDNS:
    Description: DNS name of the load balancer
    Value: !GetAtt LoadBalancer.DNSName
```

### Google Cloud Platform (Cloud Run)

```yaml
# gcp/service.yaml
apiVersion: serving.knative.dev/v1
kind: Service
metadata:
  name: facilitator
  annotations:
    run.googleapis.com/ingress: all
    run.googleapis.com/execution-environment: gen2
spec:
  template:
    metadata:
      annotations:
        autoscaling.knative.dev/minScale: "3"
        autoscaling.knative.dev/maxScale: "100"
        run.googleapis.com/cpu-throttling: "false"
        run.googleapis.com/memory: "1Gi"
        run.googleapis.com/cpu: "1000m"
    spec:
      containerConcurrency: 100
      timeoutSeconds: 300
      containers:
      - image: gcr.io/PROJECT-ID/facilitator:latest
        ports:
        - name: http1
          containerPort: 8080
        env:
        - name: NODE_ENV
          value: production
        - name: PORT
          value: "8080"
        - name: MONGODB_URI
          valueFrom:
            secretKeyRef:
              name: mongodb-uri
              key: uri
        resources:
          limits:
            cpu: 1000m
            memory: 1Gi
        startupProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 10
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3
        livenessProbe:
          httpGet:
            path: /health
            port: 8080
          periodSeconds: 10
          timeoutSeconds: 5
```

### Azure Container Instances

```yaml
# azure/container-group.yaml
apiVersion: 2021-09-01
location: eastus
type: Microsoft.ContainerInstance/containerGroups
properties:
  containers:
  - name: facilitator
    properties:
      image: myregistry.azurecr.io/facilitator:latest
      ports:
      - port: 8080
        protocol: TCP
      environmentVariables:
      - name: NODE_ENV
        value: production
      - name: PORT
        value: "8080"
      - name: MONGODB_URI
        secureValue: mongodb+srv://...
      resources:
        requests:
          cpu: 0.5
          memoryInGb: 1
        limits:
          cpu: 1
          memoryInGb: 2
      livenessProbe:
        httpGet:
          path: /health
          port: 8080
        initialDelaySeconds: 30
        periodSeconds: 10
      readinessProbe:
        httpGet:
          path: /ready
          port: 8080
        initialDelaySeconds: 5
        periodSeconds: 5
  osType: Linux
  restartPolicy: Always
  ipAddress:
    type: Public
    ports:
    - port: 8080
      protocol: TCP
```

## Database Configuration

### MongoDB Atlas (Recommended)

```bash
# Connection string format
mongodb+srv://<username>:<password>@cluster.mongodb.net/<database>?retryWrites=true&w=majority

# Environment configuration
MONGODB_URI=mongodb+srv://facilitator:secure-password@cluster.mongodb.net/nanda_production?retryWrites=true&w=majority
```

### Self-Hosted MongoDB Replica Set

```yaml
# mongodb/docker-compose.yml
version: '3.8'
services:
  mongo1:
    image: mongo:6.0
    command: ["mongod", "--replSet", "rs0", "--bind_ip_all", "--port", "27017"]
    ports:
      - "27017:27017"
    volumes:
      - mongo1_data:/data/db

  mongo2:
    image: mongo:6.0
    command: ["mongod", "--replSet", "rs0", "--bind_ip_all", "--port", "27018"]
    ports:
      - "27018:27018"
    volumes:
      - mongo2_data:/data/db

  mongo3:
    image: mongo:6.0
    command: ["mongod", "--replSet", "rs0", "--bind_ip_all", "--port", "27019"]
    ports:
      - "27019:27019"
    volumes:
      - mongo3_data:/data/db

volumes:
  mongo1_data:
  mongo2_data:
  mongo3_data:
```

```bash
# Initialize replica set
mongo --port 27017
rs.initiate({
  _id: "rs0",
  members: [
    { _id: 0, host: "mongo1:27017" },
    { _id: 1, host: "mongo2:27018" },
    { _id: 2, host: "mongo3:27019" }
  ]
})
```

## Monitoring and Observability

### Prometheus Metrics

```yaml
# monitoring/prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'facilitator'
    static_configs:
      - targets: ['facilitator:8080']
    metrics_path: '/metrics'
    scrape_interval: 10s
```

### Grafana Dashboard

```json
{
  "dashboard": {
    "title": "NANDA Facilitator Metrics",
    "panels": [
      {
        "title": "Request Rate",
        "targets": [
          {
            "expr": "rate(http_requests_total[5m])",
            "legendFormat": "{{method}} {{status}}"
          }
        ]
      },
      {
        "title": "Payment Success Rate",
        "targets": [
          {
            "expr": "rate(payments_verified_total[5m]) / rate(payments_attempted_total[5m])",
            "legendFormat": "Success Rate"
          }
        ]
      },
      {
        "title": "Active Sessions",
        "targets": [
          {
            "expr": "payment_sessions_active",
            "legendFormat": "Active Sessions"
          }
        ]
      }
    ]
  }
}
```

### Logging Configuration

```json
{
  "name": "facilitator",
  "hostname": "facilitator-pod-123",
  "pid": 1,
  "level": 30,
  "msg": "Payment session created",
  "time": "2024-01-20T10:30:00.000Z",
  "sessionId": "session_123",
  "amount": 500,
  "fromAgent": "sender",
  "toAgent": "receiver"
}
```

## Security Configuration

### SSL/TLS Configuration

```nginx
# nginx/nginx.conf
server {
    listen 443 ssl http2;
    server_name facilitator.example.com;

    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req zone=api burst=20 nodelay;

    location / {
        proxy_pass http://facilitator:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Network Security

```yaml
# k8s/network-policy.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: facilitator-netpol
spec:
  podSelector:
    matchLabels:
      app: facilitator
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: ingress-nginx
    ports:
    - protocol: TCP
      port: 8080
  egress:
  - to:
    - namespaceSelector: {}
    ports:
    - protocol: TCP
      port: 27017
    - protocol: TCP
      port: 443
    - protocol: UDP
      port: 53
```

## Deployment Checklist

### Pre-Deployment

- [ ] Environment variables configured
- [ ] Database connection tested
- [ ] SSL certificates installed
- [ ] Monitoring configured
- [ ] Backup strategy in place
- [ ] Security policies applied

### Deployment

- [ ] Build and push container images
- [ ] Deploy database (if applicable)
- [ ] Deploy application services
- [ ] Configure load balancer/ingress
- [ ] Verify health checks
- [ ] Run smoke tests

### Post-Deployment

- [ ] Monitor application metrics
- [ ] Verify payment flows
- [ ] Check error rates
- [ ] Validate performance
- [ ] Test autoscaling
- [ ] Document runbooks

## Troubleshooting

### Common Issues

1. **Database Connection Failures**
   ```bash
   # Check connectivity
   telnet mongodb-host 27017

   # Check DNS resolution
   nslookup mongodb-host

   # Verify credentials
   mongo "mongodb://username:password@host/database"
   ```

2. **Memory Issues**
   ```yaml
   # Increase memory limits
   resources:
     limits:
       memory: "1Gi"
     requests:
       memory: "512Mi"
   ```

3. **High CPU Usage**
   ```bash
   # Check for expensive queries
   db.paymentSessions.explain("executionStats").find({})

   # Add missing indexes
   db.paymentSessions.createIndex({ "expiresAt": 1 }, { expireAfterSeconds: 0 })
   ```

This deployment guide provides comprehensive coverage for deploying the NANDA Facilitator across various environments and platforms.