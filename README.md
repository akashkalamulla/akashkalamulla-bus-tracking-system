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

## 👨‍💻 Author

**AKASH** - NB6007CEM Individual Project

## 🏫 Academic Context

This project is part of the NB6007CEM module coursework focusing on:
- Serverless architecture implementation
- AWS cloud services integration
- Real-time data processing
- API design and development
- Security best practices