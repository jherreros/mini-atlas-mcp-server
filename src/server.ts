#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import * as k8s from '@kubernetes/client-node';
import { logger } from './logger.js';
import express, { Request, Response } from 'express';

interface AtlasResource {
  apiVersion: string;
  kind: string;
  metadata: {
    name: string;
    namespace?: string;
  };
  spec: any;
}

class MiniAtlasMCPServer {
  private server: Server;
  private k8sApi: k8s.CoreV1Api;
  private k8sCustomApi: k8s.CustomObjectsApi;
  private k8sConfig: k8s.KubeConfig;
  private httpServer?: any;

  constructor() {
    this.server = new Server(
      {
        name: "mini-atlas-mcp-server",
        version: "0.1.0",
      },
      {
        capabilities: {
          resources: {},
          tools: {},
        },
      }
    );

    // Initialize Kubernetes client - detect in-cluster vs local
    this.k8sConfig = new k8s.KubeConfig();
    
    if (process.env['KUBERNETES_SERVICE_HOST']) {
      // Running inside cluster - use in-cluster config
      this.k8sConfig.loadFromCluster();
      logger.info("Using in-cluster Kubernetes configuration");
    } else {
      // Running locally - use default kubeconfig
      this.k8sConfig.loadFromDefault();
      logger.info("Using local Kubernetes configuration");
    }
    
    this.k8sApi = this.k8sConfig.makeApiClient(k8s.CoreV1Api);
    this.k8sCustomApi = this.k8sConfig.makeApiClient(k8s.CustomObjectsApi);

    this.setupHandlers();
  }

  private setupHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: "create_workspace",
            description: "Create a new workspace (isolated tenant environment)",
            inputSchema: {
              type: "object",
              properties: {
                name: {
                  type: "string",
                  description: "Workspace name"
                }
              },
              required: ["name"]
            }
          },
          {
            name: "deploy_webapp",
            description: "Deploy a web application",
            inputSchema: {
              type: "object",
              properties: {
                name: { type: "string", description: "Application name" },
                namespace: { type: "string", description: "Target namespace" },
                image: { type: "string", description: "Container image" },
                tag: { type: "string", description: "Image tag", default: "latest" },
                replicas: { type: "number", description: "Number of replicas", default: 1 },
                host: { type: "string", description: "Ingress hostname" }
              },
              required: ["name", "namespace", "image", "host"]
            }
          },
          {
            name: "create_infrastructure",
            description: "Provision PostgreSQL database and Redis cache",
            inputSchema: {
              type: "object",
              properties: {
                name: { type: "string", description: "Infrastructure name" },
                namespace: { type: "string", description: "Target namespace" },
                database: { type: "string", description: "Database name" }
              },
              required: ["name", "namespace", "database"]
            }
          },
          {
            name: "create_topic",
            description: "Create a Kafka topic",
            inputSchema: {
              type: "object",
              properties: {
                name: { type: "string", description: "Topic name" },
                namespace: { type: "string", description: "Target namespace" }
              },
              required: ["name", "namespace"]
            }
          },
          {
            name: "list_resources",
            description: "List Atlas resources (workspaces, applications, etc.)",
            inputSchema: {
              type: "object",
              properties: {
                type: {
                  type: "string",
                  enum: ["workspace", "webapp", "infrastructure", "topic", "all"],
                  description: "Type of resources to list"
                },
                namespace: { type: "string", description: "Filter by namespace (optional)" }
              },
              required: ["type"]
            }
          },
          {
            name: "get_cluster_status",
            description: "Get cluster status and health information",
            inputSchema: {
              type: "object",
              properties: {}
            }
          }
        ]
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case "create_workspace":
            return await this.createWorkspace(args as { name: string });
          
          case "deploy_webapp":
            return await this.deployWebApp(args as any);
          
          case "create_infrastructure":
            return await this.createInfrastructure(args as any);
          
          case "create_topic":
            return await this.createTopic(args as any);
          
          case "list_resources":
            return await this.listResources(args as any);
          
          case "get_cluster_status":
            return await this.getClusterStatus();
          
          default:
            throw new McpError(ErrorCode.MethodNotFound, `Tool ${name} not found`);
        }
      } catch (error) {
        throw new McpError(
          ErrorCode.InternalError, 
          `Error executing tool ${name}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    });

    // List available resources
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      return {
        resources: [
          {
            uri: "atlas://workspaces",
            mimeType: "application/json",
            name: "Atlas Workspaces",
            description: "List of all workspaces in the cluster"
          },
          {
            uri: "atlas://applications",
            mimeType: "application/json", 
            name: "Atlas Applications",
            description: "List of all web applications"
          }
        ]
      };
    });

    // Read resource content
    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const { uri } = request.params;
      
      if (uri === "atlas://workspaces") {
        const workspaces = await this.getAtlasResources("Workspace");
        return {
          contents: [{
            uri,
            mimeType: "application/json",
            text: JSON.stringify(workspaces, null, 2)
          }]
        };
      }
      
      if (uri === "atlas://applications") {
        const apps = await this.getAtlasResources("WebApplication");
        return {
          contents: [{
            uri,
            mimeType: "application/json", 
            text: JSON.stringify(apps, null, 2)
          }]
        };
      }

      throw new McpError(ErrorCode.InvalidRequest, `Resource ${uri} not found`);
    });
  }

  // Tool implementations
  private async createWorkspace(args: { name: string }) {
    const workspace: AtlasResource = {
      apiVersion: "kro.run/v1alpha1",
      kind: "Workspace",
      metadata: {
        name: args.name
      },
      spec: {
        name: args.name
      }
    };

    await this.applyResource(workspace);
    return {
      content: [{
        type: "text",
        text: `Workspace '${args.name}' created successfully`
      }]
    };
  }

  private async deployWebApp(args: any) {
    const webapp: AtlasResource = {
      apiVersion: "kro.run/v1alpha1",
      kind: "WebApplication",
      metadata: {
        name: args.name,
        namespace: args.namespace
      },
      spec: {
        name: args.name,
        namespace: args.namespace,
        image: args.image,
        tag: args.tag || "latest",
        replicas: args.replicas || 1,
        host: args.host
      }
    };

    await this.applyResource(webapp);
    return {
      content: [{
        type: "text",
        text: `Web application '${args.name}' deployed to namespace '${args.namespace}'`
      }]
    };
  }

  private async createInfrastructure(args: any) {
    const infra: AtlasResource = {
      apiVersion: "kro.run/v1alpha1",
      kind: "Infrastructure", 
      metadata: {
        name: args.name,
        namespace: args.namespace
      },
      spec: {
        name: args.name,
        namespace: args.namespace,
        database: args.database
      }
    };

    await this.applyResource(infra);
    return {
      content: [{
        type: "text",
        text: `Infrastructure '${args.name}' created with database '${args.database}'`
      }]
    };
  }

  private async createTopic(args: any) {
    const topic: AtlasResource = {
      apiVersion: "kro.run/v1alpha1", 
      kind: "Topic",
      metadata: {
        name: args.name,
        namespace: args.namespace
      },
      spec: {
        name: args.name,
        namespace: args.namespace
      }
    };

    await this.applyResource(topic);
    return {
      content: [{
        type: "text",
        text: `Kafka topic '${args.name}' created in namespace '${args.namespace}'`
      }]
    };
  }

  private async listResources(args: { type: string; namespace?: string }) {
    const resources = await this.getAtlasResources(this.getKindFromType(args.type), args.namespace);
    
    return {
      content: [{
        type: "text",
        text: JSON.stringify(resources, null, 2)
      }]
    };
  }

  private async getClusterStatus() {
    try {
      const nodes = await this.k8sApi.listNode();
      const namespaces = await this.k8sApi.listNamespace();
      
      const status = {
        nodes: nodes.items.length,
        namespaces: namespaces.items.length,
        nodeStatus: nodes.items.map((node: k8s.V1Node) => ({
          name: node.metadata?.name,
          ready: node.status?.conditions?.find((c: k8s.V1NodeCondition) => c.type === 'Ready')?.status === 'True'
        }))
      };

      return {
        content: [{
          type: "text",
          text: JSON.stringify(status, null, 2)
        }]
      };
    } catch (error) {
      throw new Error(`Failed to get cluster status: ${error}`);
    }
  }

  // Helper methods
  private async applyResource(resource: AtlasResource) {
    const group = resource.apiVersion.split('/')[0]!;
    const version = resource.apiVersion.split('/')[1]!;
    
    try {
      await this.k8sCustomApi.createNamespacedCustomObject({
        group: group,
        version: version,
        namespace: resource.metadata.namespace ?? 'default',
        plural: resource.kind.toLowerCase() + 's',
        body: resource,
      }, {} /* optional ConfigurationOptions, like headers */);

    } catch (error: any) {
      if (error.response?.statusCode === 409) {
        // Resource already exists, try to update
        await this.k8sCustomApi.replaceNamespacedCustomObject({
          group: group,
          version: version,
          namespace: resource.metadata.namespace || 'default', 
          plural: resource.kind.toLowerCase() + 's',
          name: resource.metadata.name!,
          body: resource}
        );
      } else {
        throw error;
      }
    }
  }

  private async getAtlasResources(kind?: string, namespace?: string) {
    const group = 'kro.run';
    const version = 'v1alpha1';
    const kinds = kind ? [kind] : ['Workspace', 'WebApplication', 'Infrastructure', 'Topic'];
    
    const results = [];
    for (const k of kinds) {
      try {
        const response = namespace 
          ? await this.k8sCustomApi.listNamespacedCustomObject({group: group, version: version, namespace: namespace, plural: k.toLowerCase() + 's'})
          : await this.k8sCustomApi.listClusterCustomObject({group: group, version: version, plural: k.toLowerCase() + 's'});
        
        results.push(...(response.body as any).items);
      } catch (error) {
        logger.warn(`Failed to get ${k} resources:`, { error });
      }
    }
    
    return results;
  }

  private getKindFromType(type: string): string | undefined {
    const typeMap: { [key: string]: string } = {
      workspace: 'Workspace',
      webapp: 'WebApplication', 
      infrastructure: 'Infrastructure',
      topic: 'Topic'
    };
    return typeMap[type];
  }

  private async handleListTools() {
    return {
      tools: [
        {
          name: "create_workspace",
          description: "Create a new workspace (isolated tenant environment)",
          inputSchema: {
            type: "object",
            properties: {
              name: {
                type: "string",
                description: "Workspace name"
              }
            },
            required: ["name"]
          }
        },
        {
          name: "deploy_webapp",
          description: "Deploy a web application",
          inputSchema: {
            type: "object",
            properties: {
              name: { type: "string", description: "Application name" },
              namespace: { type: "string", description: "Target namespace" },
              image: { type: "string", description: "Container image" },
              tag: { type: "string", description: "Image tag", default: "latest" },
              replicas: { type: "number", description: "Number of replicas", default: 1 },
              host: { type: "string", description: "Ingress hostname" }
            },
            required: ["name", "namespace", "image", "host"]
          }
        },
        {
          name: "create_infrastructure",
          description: "Provision PostgreSQL database and Redis cache",
          inputSchema: {
            type: "object",
            properties: {
              name: { type: "string", description: "Infrastructure name" },
              namespace: { type: "string", description: "Target namespace" },
              database: { type: "string", description: "Database name" }
            },
            required: ["name", "namespace", "database"]
          }
        },
        {
          name: "create_topic",
          description: "Create a Kafka topic",
          inputSchema: {
            type: "object",
            properties: {
              name: { type: "string", description: "Topic name" },
              namespace: { type: "string", description: "Target namespace" }
            },
            required: ["name", "namespace"]
          }
        },
        {
          name: "list_resources",
          description: "List Atlas resources (workspaces, applications, etc.)",
          inputSchema: {
            type: "object",
            properties: {
              type: {
                type: "string",
                enum: ["workspace", "webapp", "infrastructure", "topic", "all"],
                description: "Type of resources to list"
              },
              namespace: { type: "string", description: "Filter by namespace (optional)" }
            },
            required: ["type"]
          }
        },
        {
          name: "get_cluster_status",
          description: "Get cluster status and health information",
          inputSchema: {
            type: "object",
            properties: {}
          }
        }
      ]
    };
  }

  private async handleListResources() {
    return {
      resources: [
        {
          uri: "atlas://workspaces",
          mimeType: "application/json",
          name: "Atlas Workspaces",
          description: "List of all workspaces in the cluster"
        },
        {
          uri: "atlas://applications",
          mimeType: "application/json", 
          name: "Atlas Applications",
          description: "List of all web applications"
        }
      ]
    };
  }

  private async handleCallTool(params: any) {
    const { name, arguments: args } = params;
    
    switch (name) {
      case "create_workspace":
        return await this.createWorkspace(args as { name: string });
      
      case "deploy_webapp":
        return await this.deployWebApp(args as any);
      
      case "create_infrastructure":
        return await this.createInfrastructure(args as any);
      
      case "create_topic":
        return await this.createTopic(args as any);
      
      case "list_resources":
        return await this.listResources(args as any);
      
      case "get_cluster_status":
        return await this.getClusterStatus();
      
      default:
        throw new Error(`Tool ${name} not found`);
    }
  }

  private async handleReadResource(params: any) {
    const { uri } = params;
    
    if (uri === "atlas://workspaces") {
      const workspaces = await this.getAtlasResources("Workspace");
      return {
        contents: [{
          uri,
          mimeType: "application/json",
          text: JSON.stringify(workspaces, null, 2)
        }]
      };
    }
    
    if (uri === "atlas://applications") {
      const apps = await this.getAtlasResources("WebApplication");
      return {
        contents: [{
          uri,
          mimeType: "application/json", 
          text: JSON.stringify(apps, null, 2)
        }]
      };
    }

    throw new Error(`Resource ${uri} not found`);
  }

  async run() {
    // Check if running in HTTP mode for in-cluster deployment
    const httpPort = process.env['MCP_HTTP_PORT'];
    
    if (httpPort) {
      // HTTP server mode for in-cluster deployment
      const app = express();
      
      app.use(express.json());
      
      // MCP over HTTP endpoint
      app.post('/mcp', async (req: Request, res: Response) => {
        try {
          const { method, params, id } = req.body;
          
          let result;
          
          switch (method) {
            case 'tools/list':
              result = await this.handleListTools();
              break;
              
            case 'tools/call':
              result = await this.handleCallTool(params);
              break;
              
            case 'resources/list':
              result = await this.handleListResources();
              break;
              
            case 'resources/read':
              result = await this.handleReadResource(params);
              break;
              
            default:
              res.status(400).json({
                jsonrpc: "2.0",
                error: {
                  code: -32601,
                  message: "Method not found"
                },
                id
              });
              return;
          }
          
          res.json({
            jsonrpc: "2.0",
            result,
            id
          });
          
        } catch (error) {
          logger.error('MCP request error:', { error });
          res.status(500).json({
            jsonrpc: "2.0",
            error: {
              code: -32603,
              message: "Internal error",
              data: error instanceof Error ? error.message : String(error)
            },
            id: req.body?.id
          });
        }
      });
      
      // Health check endpoint
      app.get('/health', async (req: Request, res: Response) => {
        try {
          // Simple health check - verify we can talk to Kubernetes API
          await this.k8sApi.listNamespace();
          res.json({ status: 'healthy', timestamp: new Date().toISOString() });
        } catch (error) {
          logger.error('Health check failed:', { error });
          res.status(500).json({ status: 'unhealthy', error: String(error) });
        }
      });
      
      // Metrics endpoint for monitoring
      app.get('/metrics', async (req: Request, res: Response) => {
        try {
          const workspaces = await this.getAtlasResources('Workspace');
          const applications = await this.getAtlasResources('WebApplication');
          const infrastructure = await this.getAtlasResources('Infrastructure');
          const topics = await this.getAtlasResources('Topic');
          
          const metrics = {
            workspaces_total: workspaces.length,
            applications_total: applications.length,
            infrastructure_total: infrastructure.length,
            topics_total: topics.length,
            timestamp: new Date().toISOString()
          };
          
          res.json(metrics);
        } catch (error) {
          logger.error('Metrics error:', { error });
          res.status(500).json({ error: 'Failed to get metrics' });
        }
      });
      
      this.httpServer = app.listen(parseInt(httpPort, 10), '0.0.0.0', () => {
        logger.info(`Mini-Atlas MCP server running on HTTP port ${httpPort}`);
      });
    } else {
      // STDIO mode for local development
      const transport = new StdioServerTransport();
      await this.server.connect(transport);
      logger.info("Mini-Atlas MCP server running on stdio");
    }
  }

  async shutdown() {
    if (this.httpServer) {
      this.httpServer.close();
    }
  }
}


// Start the server
async function main() {
  const server = new MiniAtlasMCPServer();

  // Graceful shutdown handling
  const shutdown = async () => {
    logger.info('Shutting down gracefully...');
    await server.shutdown();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  try {
    await server.run();
    // If in stdio mode, we need to keep the process alive.
    if (!process.env['MCP_HTTP_PORT']) {
      // This promise never resolves, keeping the process alive.
      await new Promise(() => {});
    }
  } catch (error) {
    logger.error('Server failed to start:', { error });
    process.exit(1);
  }
}

main();
