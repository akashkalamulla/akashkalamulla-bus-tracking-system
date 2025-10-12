# Bus Tracking System

A real-time bus tracking and route management system built with AWS serverless architecture using Lambda, DynamoDB, and Redis.

## 🚌 Project Overview

This system provides real-time tracking of buses and route management capabilities for a public transportation system. It's designed as a serverless application using AWS services for scalability and cost-effectiveness.

## 🏗️ Architecture

- **AWS Lambda**: Serverless compute for API endpoints
- **DynamoDB**: NoSQL database for routes, buses, and location data
- **Redis (ElastiCache)**: Caching layer for real-time data
- **API Gateway**: RESTful API endpoints
- **Serverless Framework**: Infrastructure as Code

## 📋 Prerequisites

- Node.js 18+ 
- npm or yarn
- AWS CLI configured
- Serverless Framework
- Git

## 🚀 Quick Start

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd bus-tracking-system
npm install
```

### 2. Environment Setup

```bash
cp .env.example .env
# Edit .env with your configuration
```

### 3. Local Development

```bash
# Install DynamoDB local
npm run dynamodb:install

# Start local DynamoDB
npm run dynamodb:start

# Start local API (in another terminal)
npm run dev
```

## 📁 Project Structure

```
bus-tracking-system/
├── src/
│   ├── handlers/          # Lambda function handlers
│   ├── services/          # Business logic services
│   ├── utils/             # Utility functions
│   └── config/            # Configuration files
├── tests/                 # Test files
├── docs/                  # Documentation
├── scripts/               # Build and deployment scripts
├── .env.example           # Environment variables template
├── .gitignore            # Git ignore rules
├── package.json          # Node.js dependencies
├── serverless.yml        # Serverless configuration
└── README.md             # This file
```

## 🔧 Available Scripts

- `npm run dev` - Start local development server
- `npm test` - Run tests with coverage
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier
- `npm run deploy:dev` - Deploy to dev environment
- `npm run deploy:prod` - Deploy to production

## 📡 API Endpoints

### Routes
- `GET /routes` - Get all routes
- `GET /routes/{routeId}` - Get specific route

### Bus Location
- `PUT /buses/{busId}/location` - Update bus location

### Health Check
- `GET /status/ping` - System health check

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm test -- --coverage
```

## 🚀 Deployment

### Development Environment
```bash
npm run deploy:dev
```

### Production Environment
```bash
npm run deploy:prod
```

## 🔐 Environment Variables

See `.env.example` for required environment variables:

- `AWS_REGION` - AWS region for deployment
- `REDIS_HOST` - Redis server host
- `REDIS_PORT` - Redis server port
- `NODE_ENV` - Environment (development/production)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 👨‍💻 Author & Academic IDs

**AKASH**

- Index no: COBSCCOMP4Y241P-008
- Coventry Id: 15386593

## 🏫 Academic Context

This project is part of the NB6007CEM module coursework focusing on:
- Serverless architecture implementation
- AWS cloud services integration
- Real-time data processing
- API design and development
- Security best practices

---

## Developer README — Detailed Guide

This README is written for developers who will run, develop, test, and deploy the Bus Tracking System. It includes full endpoint lists (dev + production), authentication, example requests, local development steps, and notes about monitoring and CI/CD.

### Project Summary

- Service: `bus-tracking-system`
- Architecture: AWS Lambda (Node 18), API Gateway, DynamoDB, optional Redis (ElastiCache), Serverless Framework

### Base URLs

- Development (dev stage): https://zcmux4xvg0.execute-api.ap-south-1.amazonaws.com/dev
- Production (production stage): https://s8gu5u156h.execute-api.ap-south-1.amazonaws.com/production

> Note: If your deployment generates new API Gateway IDs the production URL will differ. Keep `serverless info` output handy.

### Authentication

- JWT-based authentication is used for protected endpoints.
- JWT secret is stored in AWS SSM Parameter Store:
	- Dev: `/bus-tracking-system/dev/jwt-secret` (if configured)
	- Production: `/bus-tracking-system/production/jwt-secret`
- Include header: `Authorization: Bearer <JWT>`

### Endpoints (full list)

All endpoints below use the `base_url` shown above. Replace `{base_url}` with either dev or production base URL.

Public (no auth)
- GET {base_url}/public/routes — list all routes
- GET {base_url}/public/buses — list all buses
- GET {base_url}/public/schedules — list schedules
- GET {base_url}/public/location/{busId} — get last-known location for a bus

Operator (OPERATOR role)
- POST {base_url}/operator/buses — create a new bus (auth: OPERATOR)
- GET {base_url}/operator/buses/{busId} — get bus details (auth: OPERATOR)
- PUT {base_url}/operator/buses/{busId} — update bus info (auth: OPERATOR)
- POST {base_url}/operator/location — update bus location payload (auth: OPERATOR)

Admin (NTC role)
- GET {base_url}/admin/routes — list all routes (auth: NTC)
- POST {base_url}/admin/routes — create a route (auth: NTC)
- GET {base_url}/admin/routes/{routeId} — get route (auth: NTC)
- PUT {base_url}/admin/routes/{routeId} — update route (auth: NTC)
- DELETE {base_url}/admin/routes/{routeId} — delete route (auth: NTC)
- GET {base_url}/admin/buses — list buses (auth: NTC)
- POST {base_url}/admin/buses — create bus (auth: NTC)
- PUT {base_url}/admin/buses/{busId} — update bus (auth: NTC)
- DELETE {base_url}/admin/buses/{busId} — delete bus (auth: NTC)
- GET {base_url}/admin/buses/{busId}/history — get bus history (auth: NTC)

Health / Misc
- GET {base_url}/health — service health check

### Example Requests

Create route (admin)

Headers:
- Authorization: Bearer <JWT>
- Content-Type: application/json

Body example:

{
	"route_name": "Downtown Express",
	"start_location": "Central Station",
	"end_location": "East Park",
	"description": "Peak-hour express",
	"distance_km": 15.2,
	"total_stops": 6,
	"fare_rs": 120,
	"route_type": "inter-city",
	"status": "ACTIVE"
}

Create bus (operator)

Headers: Authorization + Content-Type

Body example:

{
	"busNumber": "OP-123",
	"capacity": 50,
	"routeId": "route_abc123",
	"status": "ACTIVE",
	"model": "Volvo X",
	"year": 2024
}

Update location (operator)

Body example:

{
	"busId": "bus_xyz",
	"lat": 6.9271,
	"lng": 79.8612,
	"timestamp": "2025-10-12T10:00:00Z"
}

### Local Development

1. Install dependencies

```powershell
npm install
```

2. Start local DynamoDB (if used)

```powershell
npm run dynamodb:start
```

3. Run locally with serverless-offline

```powershell
npm run dev
```

4. Run tests

```powershell
npm test
```

### Deployment

Deploy dev:

```powershell
npx serverless deploy --stage dev --region ap-south-1
```

Deploy production (production stage):

```powershell
npx serverless deploy --config serverless-production-clean.yml --stage production --region ap-south-1
```

> Tip: Use `serverless info --stage production` after deploy to get the production endpoint.

### Monitoring & Logging

- X-Ray tracing is enabled for Lambdas and API Gateway (where supported)
- CloudWatch log groups are created for each Lambda function
- SNS topic exists for alerts (configured in `serverless-production-clean.yml`)

### Environment & Secrets

- JWT secret stored in SSM Parameter Store:
	- `/bus-tracking-system/production/jwt-secret`
- Lambdas access secrets via `ssm:GetParameter` permissions in the IAM role

### Next Steps (CI/CD)

I recommend creating a `main` branch and then configuring a pipeline that:

1. Runs `npm test` and lints on PRs
2. Runs integration tests on a test/staging environment
3. Deploys `main` to `production` automatically when all checks pass

I can scaffold a GitHub Actions workflow (or GitLab CI) that:
- runs tests
- lints
- deploys to Serverless Framework using `secrets` for AWS credentials

### Troubleshooting

- 502 Bad Gateway usually means the Lambda returned an error or handler mismatch — check CloudWatch logs for the function
- 403 / 401 indicates JWT/auth problems or SSM permission issues

### Contact & Credits

- Author: AKASH
- Academic IDs: Index no: COBSCCOMP4Y241P-008, Coventry Id: 15386593

---

If you'd like, I can now:

1. Create the `main` branch and push the current code
2. Scaffold a GitHub Actions CI/CD workflow that deploys from `main` to production

Tell me which you'd like to do next and I'll take care of it.