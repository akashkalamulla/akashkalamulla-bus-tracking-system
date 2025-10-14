# Bus Tracking System — Public Documentation

**Author / Student (submission info)**

- Name: AKASH
- Index no: COBSCCOMP4Y241P-008
- Coventry Id: 15386593

---

A clean, production-ready serverless application for real-time bus tracking and route management. This README is intended for students and developers who want to run, test, and contribute to the project.

## Quick links

- **🌐 Live API Documentation**: [`https://zcmux4xvg0.execute-api.ap-south-1.amazonaws.com/dev/docs`](https://zcmux4xvg0.execute-api.ap-south-1.amazonaws.com/dev/docs)
- **📋 Swagger UI**: [`https://zcmux4xvg0.execute-api.ap-south-1.amazonaws.com/dev/docs/swagger`](https://zcmux4xvg0.execute-api.ap-south-1.amazonaws.com/dev/docs/swagger)
- **📖 ReDoc**: [`https://zcmux4xvg0.execute-api.ap-south-1.amazonaws.com/dev/docs/redoc`](https://zcmux4xvg0.execute-api.ap-south-1.amazonaws.com/dev/docs/redoc)
- **📄 OpenAPI Spec (JSON)**: [`https://zcmux4xvg0.execute-api.ap-south-1.amazonaws.com/dev/docs/openapi.json`](https://zcmux4xvg0.execute-api.ap-south-1.amazonaws.com/dev/docs/openapi.json)
- Dev base URL: `https://zcmux4xvg0.execute-api.ap-south-1.amazonaws.com/dev`
- Prod base URL: `https://s8gu5u156h.execute-api.ap-south-1.amazonaws.com/production`

---

## Table of Contents

1. Project summary
2. Architecture
3. Prerequisites
4. Local development
5. Endpoints (summary & examples)
6. Authentication & secrets
7. Deployment
8. Monitoring & logging
9. Troubleshooting
10. Credits

---

## Project summary

This project provides:

- Real-time bus location ingestion and storage
- Administrative CRUD for routes and buses
- Public endpoints for route and bus information

Built with AWS Lambda, API Gateway, DynamoDB, and the Serverless Framework.

---

## Architecture

- Lambda (Node.js 18)
- API Gateway (REST)
- DynamoDB (routes, buses, locations, schedules, users)
- Optional: ElastiCache (Redis) — disabled in production for reliability
- Serverless Framework for infrastructure-as-code

---

## Prerequisites

- Node.js 18+
- npm
- AWS CLI configured (with appropriate IAM user/role for deployments)
- Serverless Framework (npx serverless is fine)

---

## Local development

1. Install dependencies

```powershell
npm install
```

2. Start optional local DynamoDB (if used by your workflow)

```powershell
npm run dynamodb:start
```

3. Start local API

```powershell
npm run dev
```

4. Run tests

```powershell
npm test
```

---

## 📚 API Documentation

### Live Documentation (Online)

The API documentation is now available online and automatically updated with each deployment:

#### 🌐 **Documentation Hub**
- **Main Portal**: [https://zcmux4xvg0.execute-api.ap-south-1.amazonaws.com/dev/docs](https://zcmux4xvg0.execute-api.ap-south-1.amazonaws.com/dev/docs)
  - Complete overview with system features
  - Student information and academic context
  - Direct links to all documentation formats

#### 📋 **Interactive Documentation**
- **Swagger UI**: [https://zcmux4xvg0.execute-api.ap-south-1.amazonaws.com/dev/docs/swagger](https://zcmux4xvg0.execute-api.ap-south-1.amazonaws.com/dev/docs/swagger)
  - Interactive API testing interface
  - Try endpoints directly from browser
  - Real-time request/response examples

#### 📖 **Comprehensive Documentation**
- **ReDoc**: [https://zcmux4xvg0.execute-api.ap-south-1.amazonaws.com/dev/docs/redoc](https://zcmux4xvg0.execute-api.ap-south-1.amazonaws.com/dev/docs/redoc)
  - Beautiful, responsive documentation
  - Detailed schemas and examples
  - Mobile-friendly interface

#### 📄 **API Specification**
- **OpenAPI JSON**: [https://zcmux4xvg0.execute-api.ap-south-1.amazonaws.com/dev/docs/openapi.json](https://zcmux4xvg0.execute-api.ap-south-1.amazonaws.com/dev/docs/openapi.json)
- **OpenAPI YAML**: [https://zcmux4xvg0.execute-api.ap-south-1.amazonaws.com/dev/docs/openapi.yaml](https://zcmux4xvg0.execute-api.ap-south-1.amazonaws.com/dev/docs/openapi.yaml)

### Local Documentation

You can also run documentation locally:

```powershell
# Serve documentation locally
npm run docs:swagger

# Validate OpenAPI specification
npm run docs:validate
```

---

## Endpoints (summary & examples)

Base URLs

- Dev: `https://zcmux4xvg0.execute-api.ap-south-1.amazonaws.com/dev`
- Prod: `https://s8gu5u156h.execute-api.ap-south-1.amazonaws.com/production`

Public (no auth)

- GET /public/routes — list all routes
- GET /public/buses — list all buses
- GET /public/schedules — list schedules
- GET /public/location/{busId} — last-known location for a bus

Operator (OPERATOR role)

- POST /operator/buses — create a new bus
- GET /operator/buses/{busId} — get bus details
- PUT /operator/buses/{busId} — update bus info
- POST /operator/location — update live location

Admin (NTC role)

- GET /admin/routes — list all routes
- POST /admin/routes — create a route
- GET /admin/routes/{routeId} — get route
- PUT /admin/routes/{routeId} — update route
- DELETE /admin/routes/{routeId} — delete route
- GET /admin/buses — list buses
- POST /admin/buses — create bus
- PUT /admin/buses/{busId} — update bus
- DELETE /admin/buses/{busId} — delete bus
- GET /admin/buses/{busId}/history — bus history

Health

- GET /health — service health check

### Example: Create Route (Admin)

POST {base_url}/admin/routes

Headers:

- Authorization: Bearer <JWT>
- Content-Type: application/json

Body example:

```json
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
```

### Example: Update Location (Operator)

POST {base_url}/operator/location

Headers: Authorization: Bearer <JWT>

Body example:

```json
{
  "busId": "bus_xyz",
  "lat": 6.9271,
  "lng": 79.8612,
  "timestamp": "2025-10-12T10:00:00Z"
}
```

---

## Authentication & secrets

- Protected endpoints use JWT-based authentication.
- JWT secret is stored in AWS SSM Parameter Store:
  - Production: `/bus-tracking-system/production/jwt-secret`
  - Dev: `/bus-tracking-system/dev/jwt-secret`
- Lambdas require `ssm:GetParameter` permission to access the secret; the Serverless IAM role includes the necessary statements in production config.

---

## Deployment

Deploy to development

```powershell
npx serverless deploy --stage dev --region ap-south-1
```

Deploy to production (safe, clean config)

```powershell
npx serverless deploy --config serverless-production-clean.yml --stage production --region ap-south-1
```

Get deployment info

```powershell
npx serverless info --stage production --region ap-south-1
```

---

## Monitoring & logging

- X-Ray tracing is enabled for Lambdas where configured
- CloudWatch Log Groups are created per Lambda
- Basic CloudWatch alarms and an SNS topic are configured for production in `serverless-production-clean.yml`

---

## Troubleshooting

- 502 Bad Gateway: check Lambda CloudWatch logs for stack traces or handler errors
- 401 / 403: JWT or SSM permission issues — ensure the function role includes `ssm:GetParameter`
- 500 Internal Server Error: inspect function logs, validate environment variables and dependencies

This README is public-facing and aimed at students and developers. Internal TODOs and next-step prompts have been removed to keep the document concise and focused.
