# Mini-Atlas MCP Server

A Model Context Protocol (MCP) server that provides a natural language interface to the [Mini-Atlas](https://github.com/jherreros/mini-atlas) Internal Developer Platform. Interact with your Kubernetes cluster and manage cloud-native applications using AI assistants like Claude.

## 🚀 Quick Start

Use this configuration in the settings of your preferred tool:

```json
{
  "mcpServers": {
    "mini-atlas": {
      "command": "npx",
      "args": ["github:jherreros/mini-atlas-mcp-server"]
    }
  }
}
```

**Talk to your infrastructure in plain English:**

> "Create a workspace for the frontend team and deploy their React app at dashboard.company.com"

> "Set up a complete microservices stack with database, Redis, and Kafka topics"

> "Show me the current cluster status and all running applications"

## 📋 Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Installation & Development](#installation--development)
- [Architecture](#architecture)
- [Available Tools](#available-tools)
- [Usage Guide](#usage-guide)
- [Advanced Examples](#advanced-examples)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)
- [API Reference](#api-reference)

## 🔍 Overview

Mini-Atlas MCP Server bridges the gap between natural language and Kubernetes operations. It transforms complex infrastructure management into simple conversational commands, making cloud-native development accessible to both DevOps experts and application developers.

### Key Benefits

- **Natural Language Interface**: Describe what you want instead of writing YAML
- **Multi-Tenant Support**: Isolated workspaces for different teams
- **Comprehensive Platform**: Deploy apps, provision databases, create messaging topics
- **Safety First**: Built-in validation and naming conventions
- **Kubernetes Native**: Leverages operators and custom resources
- **Production Ready**: Full resource lifecycle management with status monitoring and cleanup
- **Type Safe**: Comprehensive error handling and input validation

### What You Can Do

| Operation | Example Command |
|-----------|----------------|
| **Team Onboarding** | "Create a workspace for the mobile team" |
| **App Deployment** | "Deploy the user-service API at api.company.com with 3 replicas" |
| **Database Setup** | "Provision PostgreSQL for the analytics team" |
| **Event Streaming** | "Create Kafka topics for user events and notifications" |
| **Resource Monitoring** | "Get the status of the user-api application in production" |
| **Resource Cleanup** | "Delete the old-service from the legacy workspace" |
| **Platform Monitoring** | "Show me cluster health and all running services" |

## 📋 Prerequisites

### Infrastructure Requirements

- **Kubernetes Cluster**: Version 1.24+ with Mini-Atlas platform installed
- **MCP Server**: Deployed and running in your cluster
- **AI Assistant**: Claude, GPT-4, or any MCP-compatible assistant

### Platform Components

Your Mini-Atlas cluster should have these operators installed:

- **KRO (Kubernetes Resource Orchestrator)**: Manages composite resources
- **CloudNativePG**: PostgreSQL database management
- **Strimzi**: Kafka messaging platform
- **Nginx Ingress**: External traffic routing
- **Kyverno**: Policy enforcement and governance

### Access Requirements

- Network access to your Kubernetes cluster
- MCP server endpoint accessible to your AI assistant
- Appropriate RBAC permissions for resource management

## 🔧 Installation & Development

### Quick Start (NPX)
Use the server directly from GitHub (recommended for most users):

```json
{
  "mcpServers": {
    "mini-atlas": {
      "command": "npx",
      "args": ["github:jherreros/mini-atlas-mcp-server"]
    }
  }
}
```

### Local Development

1. **Clone and Install**
   ```bash
   git clone https://github.com/jherreros/mini-atlas-mcp-server.git
   cd mini-atlas-mcp-server
   npm install
   ```

2. **Build the Project**
   ```bash
   npm run build
   ```

3. **Run Tests**
   ```bash
   npm test
   ```

4. **Start Development Server**
   ```bash
   npm run dev
   ```

### Configuration

The server automatically detects its environment:

- **In-Cluster**: Uses service account and in-cluster config
- **Local Development**: Uses your local kubeconfig file

### Environment Variables

- `KUBERNETES_SERVICE_HOST`: Auto-detected when running in cluster
- `KUBECONFIG`: Path to kubeconfig file (for local development)
- `LOG_LEVEL`: Logging level (debug, info, warn, error) - default: info
- `NODE_ENV`: Environment mode (development, production)

## 🛠️ Available Tools

### Core Platform Tools

| Tool | Purpose | Key Parameters |
|------|---------|----------------|
| `create_workspace` | Multi-tenant environment setup | `name` |
| `deploy_webapp` | Application deployment | `name`, `namespace`, `image`, `host` |
| `create_infrastructure` | Database and cache provisioning | `name`, `namespace`, `database` |
| `create_topic` | Kafka messaging setup | `name`, `namespace` |
| `get_resource_status` | Get detailed resource status | `name`, `type`, `namespace` |
| `delete_resource` | Safely delete Atlas resources | `name`, `type`, `namespace` |
| `list_resources` | Resource discovery and inventory | `type`, `namespace` |
| `get_cluster_status` | Platform health monitoring | None |

### Tool Details

#### 🏢 `create_workspace`
Creates an isolated environment for a team or project.

**What it creates:**
- Dedicated Kubernetes namespace
- Network isolation policies
- Resource quotas and limits
- RBAC permissions

**Parameters:**
- `name` (required): Workspace identifier (e.g., "frontend-team", "project-alpha")

#### 🚀 `deploy_webapp`
Deploys containerized web applications with full production features.

**What it creates:**
- Kubernetes Deployment
- ClusterIP Service
- Ingress with TLS
- Health checks and monitoring

**Parameters:**
- `name` (required): Application name
- `namespace` (required): Target workspace
- `image` (required): Container image (e.g., "nginx:1.21", "node:16-alpine")
- `host` (required): Public hostname (e.g., "api.company.com")
- `tag` (optional): Image tag (default: "latest")
- `replicas` (optional): Instance count (default: 1)
- `port` (optional): Container port (default: 8080)
- `env` (optional): Environment variables as key-value pairs
- `resources` (optional): CPU and memory requests/limits
  - `requests.cpu` (optional): CPU request (e.g., "100m")
  - `requests.memory` (optional): Memory request (e.g., "128Mi")
  - `limits.cpu` (optional): CPU limit (e.g., "500m")
  - `limits.memory` (optional): Memory limit (e.g., "512Mi")

#### 🗄️ `create_infrastructure`
Provisions managed databases and caching layers.

**What it creates:**
- PostgreSQL cluster (high availability)
- Redis instance
- Connection secrets
- Backup policies

**Parameters:**
- `name` (required): Infrastructure stack name
- `namespace` (required): Target workspace
- `database` (required): Database name
- `databaseVersion` (optional): PostgreSQL version (default: "15")
- `storageSize` (optional): Storage size (default: "10Gi")
- `redisEnabled` (optional): Enable Redis cache (default: true)
- `backupEnabled` (optional): Enable automated backups (default: true)

#### 📨 `create_topic`
Sets up Kafka topics for event-driven architecture.

**What it creates:**
- Kafka topic with partitions
- Access control policies
- Retention policies

**Parameters:**
- `name` (required): Topic name
- `namespace` (required): Target workspace
- `partitions` (optional): Number of partitions (default: 3)
- `replicationFactor` (optional): Replication factor (default: 3)
- `retentionMs` (optional): Message retention in milliseconds

#### 🔍 `get_resource_status`
Get detailed status information for a specific Atlas resource.

**Returns:**
- Resource configuration
- Current status
- Health information
- Related resources

**Parameters:**
- `name` (required): Resource name
- `type` (required): Resource type ("workspace", "webapp", "infrastructure", "topic")
- `namespace` (optional): Namespace (required for namespaced resources)

#### 🗑️ `delete_resource`
Safely delete Atlas resources with proper cleanup.

**What it does:**
- Removes the specified Atlas resource
- Cleans up dependent resources
- Maintains data integrity

**Parameters:**
- `name` (required): Resource name
- `type` (required): Resource type ("workspace", "webapp", "infrastructure", "topic")
- `namespace` (optional): Namespace (for namespaced resources)

#### 📊 `list_resources`
Discovers and inventories platform resources.

**Parameters:**
- `type` (required): "workspace", "webapp", "infrastructure", "topic", or "all"
- `namespace` (optional): Filter by specific workspace

#### 🏥 `get_cluster_status`
Provides cluster health and capacity information.

**Returns:**
- Node count and status
- Namespace count
- Resource utilization
- Platform component health

## 📖 Usage Guide

### Getting Started Examples

#### 1. Team Onboarding
**Scenario**: New team joining your organization

**Command**:
> "Create a workspace for the mobile development team called 'mobile-team'"

**Result**: Isolated environment ready for the mobile team's applications and services.

#### 2. Simple Application Deployment
**Scenario**: Deploy a documentation site

**Command**:
> "Deploy a documentation site using nginx:alpine in the mobile-team workspace, make it accessible at docs.company.com"

**Result**: Documentation site running with public access and monitoring.

#### 3. Full-Stack Application
**Scenario**: Complete application with database

**Command**:
> "Set up a blog platform for the content team: create their workspace, provision a PostgreSQL database called 'blog-db', and deploy the blog app using wordpress:latest at blog.company.com"

**Result**: Complete WordPress setup with managed database.

### Intermediate Examples

#### 4. Microservices Architecture
**Scenario**: Event-driven microservices setup

**Command**:
> "Create an e-commerce platform in the 'ecommerce' workspace with:
> - PostgreSQL database named 'products-db'
> - Redis for caching
> - Kafka topics for 'orders', 'payments', and 'inventory'
> - API service using node:16 at api.ecommerce.com
> - Frontend using react-app:latest at shop.ecommerce.com"

**Result**: Complete microservices platform with all components integrated.

#### 5. Environment Promotion
**Scenario**: Creating staging environment

**Command**:
> "Clone the production setup from 'ecommerce' workspace to create 'ecommerce-staging' with the same infrastructure but different hostnames using staging.ecommerce.com subdomain"

**Result**: Staging environment mirroring production configuration.

### Platform Management

#### 6. Resource Discovery
**Command**:
> "Show me all web applications and their status across all workspaces"

**Result**: Comprehensive inventory of deployed applications.

#### 7. Health Monitoring
**Command**:
> "What's the current cluster status? Are all nodes healthy and how many applications are running?"

**Result**: Cluster health dashboard and resource utilization.

#### 8. Workspace Audit
**Command**:
> "List all resources in the mobile-team workspace and show me what infrastructure they're using"

**Result**: Complete workspace inventory and resource usage.

#### 9. Resource Details
**Command**:
> "Get the detailed status of the user-api application in the backend workspace"

**Result**: Complete resource configuration, health status, and related information.

#### 10. Resource Management
**Command**:
> "Delete the old-api application from the legacy workspace as it's no longer needed"

**Result**: Safe removal of the application with proper cleanup.

## 🎯 Advanced Examples

### Batch Operations

#### Multi-Environment Setup
**Scenario**: Set up development, staging, and production environments

**Command**:
> "Create three identical environments (dev, staging, prod) each with:
> - Their own workspace
> - PostgreSQL database named 'app-db'
> - Redis cache
> - User service API
> - Frontend application
> Use environment-specific hostnames like dev.app.com, staging.app.com, prod.app.com"

### Scaling and Updates

#### Application Scaling
**Command**:
> "The user-api in production is getting high traffic. Scale it to 10 replicas and update to the latest image version"

#### Infrastructure Scaling
**Command**:
> "Our analytics workload needs more database resources. Upgrade the PostgreSQL in the analytics workspace to handle larger datasets"

### Event-Driven Architecture

#### Message Flow Setup
**Command**:
> "Set up an event-driven order processing system:
> - Kafka topics: 'orders', 'payments', 'shipping', 'notifications'
> - Order service that publishes to orders topic
> - Payment service that subscribes to orders and publishes to payments
> - All in the 'fulfillment' workspace"

### Disaster Recovery

#### Backup and Recovery
**Command**:
> "Show me the backup status of all databases and help me plan a disaster recovery test for the production workspace"

## 💡 Best Practices

### Naming Conventions

- **Workspaces**: Use team or project names (`frontend-team`, `project-alpha`)
- **Applications**: Descriptive service names (`user-api`, `payment-service`)
- **Infrastructure**: Purpose-based names (`user-db`, `session-cache`)
- **Topics**: Event-type names (`user-events`, `order-updates`)

### Resource Organization

1. **One workspace per team/project** for proper isolation
2. **Group related services** in the same workspace
3. **Use consistent naming** across environments
4. **Plan resource limits** for each workspace

### Security Considerations

- Workspaces provide network isolation
- Secrets are automatically generated for databases
- Ingress includes TLS termination
- RBAC policies limit cross-workspace access

### Performance Optimization

- Start with single replicas and scale based on load
- Use resource requests and limits
- Monitor application metrics
- Plan for database connection pooling

## 🔧 Troubleshooting

### Common Issues

#### Application Not Accessible
**Symptoms**: Can't reach application at specified hostname

**Debugging**:
> "Get the status of the user-api application in the backend workspace"

**Common causes**:
- DNS not configured for hostname
- Ingress controller issues
- Service port mismatch

#### Database Connection Issues
**Symptoms**: Application can't connect to database

**Debugging**:
> "Get the status of the backend-infrastructure in the backend workspace"

**Common causes**:
- Database still initializing
- Incorrect connection parameters
- Network policies blocking access

#### Resource Creation Failures
**Symptoms**: Resources not being created

**Debugging**:
> "What's the cluster status and are all operators healthy?"

**Common causes**:
- Insufficient cluster resources
- Operator not running
- Invalid resource specifications

### Diagnostic Commands

- **Cluster Health**: "What's the current cluster status?"
- **Resource Inventory**: "List all resources of type webapp"
- **Workspace Status**: "Show me everything in the frontend-team workspace"
- **Resource Details**: "Get the status of the user-api webapp in the backend workspace"
- **Infrastructure Status**: "Get the status of the main-db infrastructure in the production workspace"
- **Resource Cleanup**: "Delete the old-service webapp from the legacy workspace"

## 📚 API Reference

### Resource Types

#### Workspace
```yaml
apiVersion: kro.run/v1alpha1
kind: Workspace
metadata:
  name: frontend-team
spec:
  name: frontend-team
```

#### WebApplication
```yaml
apiVersion: kro.run/v1alpha1
kind: WebApplication
metadata:
  name: user-api
  namespace: backend-team
spec:
  name: user-api
  namespace: backend-team
  image: node:16-alpine
  tag: latest
  replicas: 3
  host: api.company.com
```

#### Infrastructure
```yaml
apiVersion: kro.run/v1alpha1
kind: Infrastructure
metadata:
  name: backend-stack
  namespace: backend-team
spec:
  name: backend-stack
  namespace: backend-team
  database: user-db
```

#### Topic
```yaml
apiVersion: kro.run/v1alpha1
kind: Topic
metadata:
  name: user-events
  namespace: backend-team
spec:
  name: user-events
  namespace: backend-team
```

### HTTP Endpoints

When running in HTTP mode (in-cluster deployment):

- **MCP Endpoint**: `POST /mcp` - Main MCP protocol endpoint
- **Health Check**: `GET /health` - Server health status
- **Metrics**: `GET /metrics` - Platform metrics and statistics

### Environment Variables

- `MCP_HTTP_PORT`: HTTP server port (enables HTTP mode)
- `LOG_LEVEL`: Logging level (info, debug, warn, error)
- `NODE_ENV`: Environment mode (development, production)
- `KUBERNETES_SERVICE_HOST`: Auto-detected in-cluster mode

---

## � Quality & Testing

The Mini-Atlas MCP Server is built with reliability and safety in mind:

### Testing Coverage
- **29 comprehensive tests** covering all functionality
- **Validation functions**: Kubernetes naming conventions, resource validation
- **Utility functions**: Formatting, parsing, retry logic
- **Integration tests**: End-to-end functionality verification

### Quality Assurance
- **Type Safety**: Strict TypeScript with exact optional property types
- **Error Handling**: Comprehensive error types (`ValidationError`, `KubernetesError`, `ResourceNotFoundError`)
- **Input Validation**: All parameters validated before resource creation
- **Build Process**: Automated with ES module compatibility fixes

### Development Tools
```bash
# Run the full test suite
npm test

# Build with type checking
npm run build

# Development mode with hot reload
npm run dev
```

## �🤝 Contributing

Mini-Atlas MCP Server is part of the broader [Mini-Atlas](https://github.com/jherreros/mini-atlas) platform. For questions, issues, or contributions, please refer to the main Mini-Atlas documentation.

## 📄 License

This project is licensed under the MIT License - see the main Mini-Atlas repository for details.