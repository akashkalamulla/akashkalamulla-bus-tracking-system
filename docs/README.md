# API Documentation

This folder contains the API documentation for the Bus Tracking System.

## Files

- **`index.html`** - ReDoc-powered documentation viewer
- **`swagger.html`** - Swagger UI-powered documentation viewer
- **`../openapi.yaml`** - OpenAPI 3.0 specification file

## Viewing Documentation

### Option 1: ReDoc (Recommended)
Clean, mobile-friendly documentation:
```bash
npm run docs:serve
```
Then open http://localhost:8080

### Option 2: Swagger UI
Interactive API explorer with try-it-out functionality:
```bash
# Install http-server globally if needed
npm install -g http-server

# Serve docs folder
npm run docs:swagger
```
Then open http://localhost:8080/swagger.html

### Option 3: Static Build
Generate static HTML file:
```bash
npm run docs:build
```
This creates `docs/api-docs.html` which can be hosted anywhere.

## Validation

To validate the OpenAPI specification:
```bash
npm run docs:validate
```

## GitHub Pages

To host on GitHub Pages:
1. Push the `docs/` folder to your repository
2. Enable GitHub Pages from `/docs` folder in repository settings
3. Access at: `https://[username].github.io/[repository-name]/`

## Development

When making changes to `openapi.yaml`:
1. Validate: `npm run docs:validate`
2. Preview: `npm run docs:serve`
3. Commit both `openapi.yaml` and any generated files

The OpenAPI specification is automatically validated in CI/CD pipeline.