#!/usr/bin/env node
/**
 * Mini-Atlas MCP Server
 * 
 * A Model Context Protocol server for managing Atlas resources on Kubernetes.
 * 
 * Environment Variables:
 * - KUBERNETES_SERVICE_HOST: Auto-detected when running in cluster
 * - KUBECONFIG: Path to kubeconfig file (for local development)
 * - LOG_LEVEL: Logging level (debug, info, warn, error) - default: info
 * - NODE_ENV: Environment mode (development, production)
 * 
 * Usage:
 * - Local development: node dist/server.js
 * - In MCP client: Configure as stdio transport server
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ReadResourceRequestSchema,
  CallToolResult,
} from "@modelcontextprotocol/sdk/types.js";
import * as k8s from '@kubernetes/client-node';
import { logger } from './logger.js';
import {
  AtlasResource,
  CreateWorkspaceArgs,
  DeployWebAppArgs,
  CreateInfrastructureArgs,
  CreateTopicArgs,
  ListResourcesArgs,
  ClusterStatus,
  MCPResponse,
  KubernetesError,
  ValidationError,
  ResourceNotFoundError
} from './types.js';
import {
  validateResourceName,
  validateNamespace,
  validateImageReference,
  validateHostname,
  validateReplicas,
  validateEnvironmentVariables,
  createAtlasResource,
  formatResourceList,
  formatResource,
  getResourcePlural,
  parseApiVersion,
  retry
} from './utils.js';

class MiniAtlasMCPServer {
  private server: Server;
  private k8sApi: k8s.CoreV1Api;
  private k8sCustomApi: k8s.CustomObjectsApi;
  private k8sConfig: k8s.KubeConfig;

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

    // Initialize and test connection
    this.initializeKubernetesClient().catch(error => {
      logger.error("Failed to initialize Kubernetes client:", error);
      process.exit(1);
    });

    this.setupHandlers();
  }

  private async initializeKubernetesClient(): Promise<void> {
    await retry(async () => {
      // Test the connection
      await this.k8sApi.listNamespace();
      logger.info("Successfully connected to Kubernetes API");
    }, 3, 1000);
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
                name: { type: "string", description: "Workspace name" },
                description: { type: "string", description: "Workspace description" },
                team: { type: "string", description: "Team name" },
                environment: { 
                  type: "string", 
                  enum: ["development", "staging", "production"],
                  description: "Environment type", 
                  default: "development" 
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
                host: { type: "string", description: "Ingress hostname" },
                port: { type: "number", description: "Container port", default: 8080 },
                env: { 
                  type: "object",
                  description: "Environment variables",
                  additionalProperties: { type: "string" }
                },
                resources: {
                  type: "object",
                  description: "Resource requests and limits",
                  properties: {
                    requests: {
                      type: "object",
                      properties: {
                        cpu: { type: "string", description: "CPU request (e.g., '100m')" },
                        memory: { type: "string", description: "Memory request (e.g., '128Mi')" }
                      }
                    },
                    limits: {
                      type: "object", 
                      properties: {
                        cpu: { type: "string", description: "CPU limit (e.g., '500m')" },
                        memory: { type: "string", description: "Memory limit (e.g., '512Mi')" }
                      }
                    }
                  }
                }
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
                database: { type: "string", description: "Database name" },
                databaseVersion: { type: "string", description: "PostgreSQL version", default: "15" },
                storageSize: { type: "string", description: "Storage size (e.g., '10Gi')", default: "10Gi" },
                redisEnabled: { type: "boolean", description: "Enable Redis cache", default: true },
                backupEnabled: { type: "boolean", description: "Enable automated backups", default: true }
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
                namespace: { type: "string", description: "Target namespace" },
                partitions: { type: "number", description: "Number of partitions", default: 3 },
                replicationFactor: { type: "number", description: "Replication factor", default: 3 },
                retentionMs: { type: "number", description: "Message retention in milliseconds" }
              },
              required: ["name", "namespace"]
            }
          },
          {
            name: "get_resource_status",
            description: "Get detailed status of a specific Atlas resource",
            inputSchema: {
              type: "object",
              properties: {
                name: { type: "string", description: "Resource name" },
                type: { type: "string", enum: ["workspace", "webapp", "infrastructure", "topic"], description: "Resource type" },
                namespace: { type: "string", description: "Namespace (required for namespaced resources)" }
              },
              required: ["name", "type"]
            }
          },
          {
            name: "delete_resource",
            description: "Delete an Atlas resource",
            inputSchema: {
              type: "object",
              properties: {
                name: { type: "string", description: "Resource name" },
                type: { type: "string", enum: ["workspace", "webapp", "infrastructure", "topic"], description: "Resource type" },
                namespace: { type: "string", description: "Namespace (for namespaced resources)" }
              },
              required: ["name", "type"]
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
            return await this.createWorkspace(args as unknown as CreateWorkspaceArgs);
          
          case "deploy_webapp":
            return await this.deployWebApp(args as unknown as DeployWebAppArgs);
          
          case "create_infrastructure":
            return await this.createInfrastructure(args as unknown as CreateInfrastructureArgs);
          
          case "create_topic":
            return await this.createTopic(args as unknown as CreateTopicArgs);

          case "get_resource_status":
            return await this.getResourceStatus(args as unknown as { name: string; type: string; namespace?: string });

          case "delete_resource":
            return await this.deleteResource(args as unknown as { name: string; type: string; namespace?: string });
          
          case "list_resources":
            return await this.listResources(args as unknown as ListResourcesArgs);
          
          case "get_cluster_status":
            return await this.getClusterStatus();
          
          default:
            throw new McpError(ErrorCode.MethodNotFound, `Tool ${name} not found`);
        }
      } catch (error) {
        if (error instanceof ValidationError) {
          throw new McpError(ErrorCode.InvalidParams, error.message);
        }
        if (error instanceof ResourceNotFoundError) {
          throw new McpError(ErrorCode.InvalidRequest, error.message);
        }
        if (error instanceof KubernetesError) {
          throw new McpError(ErrorCode.InternalError, error.message);
        }
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
  private async createWorkspace(args: CreateWorkspaceArgs): Promise<CallToolResult> {
    validateResourceName(args.name, 'Workspace');
    
    const workspace = createAtlasResource('Workspace', args.name, undefined, {
      name: args.name,
      description: args.description,
      team: args.team,
      environment: args.environment || 'development'
    });

    await this.applyResource(workspace);
    
    return {
      content: [{
        type: "text",
        text: `Workspace '${args.name}' created successfully`
      }]
    };
  }

  private async deployWebApp(args: DeployWebAppArgs): Promise<CallToolResult> {
    validateResourceName(args.name, 'WebApplication');
    validateNamespace(args.namespace);
    validateImageReference(args.image);
    validateHostname(args.host);
    
    if (args.replicas !== undefined) {
      validateReplicas(args.replicas);
    }
    
    if (args.env) {
      validateEnvironmentVariables(args.env);
    }

    const webapp = createAtlasResource('WebApplication', args.name, args.namespace, {
      name: args.name,
      namespace: args.namespace,
      image: args.image,
      tag: args.tag || "latest",
      replicas: args.replicas || 1,
      host: args.host,
      port: args.port || 8080,
      env: args.env,
      resources: args.resources
    });

    await this.applyResource(webapp);
    return {
      content: [{
        type: "text",
        text: `Web application '${args.name}' deployed to namespace '${args.namespace}' at ${args.host}`
      }]
    };
  }

  private async createInfrastructure(args: CreateInfrastructureArgs): Promise<CallToolResult> {
    validateResourceName(args.name, 'Infrastructure');
    validateNamespace(args.namespace);
    validateResourceName(args.database, 'Database');

    const infra = createAtlasResource('Infrastructure', args.name, args.namespace, {
      name: args.name,
      namespace: args.namespace,
      database: args.database,
      databaseVersion: args.databaseVersion || "15",
      storageSize: args.storageSize || "10Gi",
      redisEnabled: args.redisEnabled !== false,
      backupEnabled: args.backupEnabled !== false
    });

    await this.applyResource(infra);
    return {
      content: [{
        type: "text",
        text: `Infrastructure '${args.name}' created with database '${args.database}' in namespace '${args.namespace}'`
      }]
    };
  }

  private async createTopic(args: CreateTopicArgs): Promise<CallToolResult> {
    validateResourceName(args.name, 'Topic');
    validateNamespace(args.namespace);

    const topic = createAtlasResource('Topic', args.name, args.namespace, {
      name: args.name,
      namespace: args.namespace,
      partitions: args.partitions || 3,
      replicationFactor: args.replicationFactor || 3,
      retentionMs: args.retentionMs
    });

    await this.applyResource(topic);
    return {
      content: [{
        type: "text",
        text: `Kafka topic '${args.name}' created in namespace '${args.namespace}'`
      }]
    };
  }

  private async getResourceStatus(args: { name: string; type: string; namespace?: string }): Promise<CallToolResult> {
    const kind = this.getKindFromType(args.type);
    if (!kind) {
      throw new ValidationError(`Invalid resource type: ${args.type}`);
    }

    const resource = await this.getAtlasResource(kind, args.name, args.namespace);
    if (!resource) {
      throw new ResourceNotFoundError(kind, args.name);
    }

    return {
      content: [{
        type: "text",
        text: JSON.stringify(resource, null, 2)
      }]
    };
  }

  private async deleteResource(args: { name: string; type: string; namespace?: string }): Promise<CallToolResult> {
    const kind = this.getKindFromType(args.type);
    if (!kind) {
      throw new ValidationError(`Invalid resource type: ${args.type}`);
    }

    const { group, version } = parseApiVersion('kro.run/v1alpha1');
    const plural = getResourcePlural(kind);

    try {
      if (args.namespace) {
        await this.k8sCustomApi.deleteNamespacedCustomObject({
          group,
          version,
          namespace: args.namespace,
          plural,
          name: args.name
        });
      } else {
        await this.k8sCustomApi.deleteClusterCustomObject({
          group,
          version,
          plural,
          name: args.name
        });
      }

      return {
        content: [{
          type: "text",
          text: `${kind} '${args.name}' deleted successfully`
        }]
      };
    } catch (error: any) {
      if (error.response?.statusCode === 404) {
        throw new ResourceNotFoundError(kind, args.name);
      }
      throw new KubernetesError(`Failed to delete ${kind}`, error);
    }
  }

  private async listResources(args: ListResourcesArgs): Promise<CallToolResult> {
    const resources = await this.getAtlasResources(this.getKindFromType(args.type), args.namespace);
    
    return {
      content: [{
        type: "text",
        text: formatResourceList(resources)
      }]
    };
  }

  private async getClusterStatus(): Promise<CallToolResult> {
    try {
      const nodes = await this.k8sApi.listNode();
      const namespaces = await this.k8sApi.listNamespace();
      const atlasResources = await this.getAllAtlasResourceCounts();
      
      const status: ClusterStatus = {
        nodes: nodes.items.length,
        namespaces: namespaces.items.length,
        nodeStatus: nodes.items.map((node: k8s.V1Node) => ({
          name: node.metadata?.name,
          ready: node.status?.conditions?.find((c: k8s.V1NodeCondition) => c.type === 'Ready')?.status === 'True',
          version: node.status?.nodeInfo?.kubeletVersion,
          roles: Object.keys(node.metadata?.labels || {})
            .filter(label => label.startsWith('node-role.kubernetes.io/'))
            .map(label => label.replace('node-role.kubernetes.io/', ''))
        })),
        atlasResources
      };

      return {
        content: [{
          type: "text",
          text: JSON.stringify(status, null, 2)
        }]
      };
    } catch (error) {
      throw new KubernetesError('Failed to get cluster status', error);
    }
  }

  // Helper methods
  private async applyResource(resource: AtlasResource) {
    const { group, version } = parseApiVersion(resource.apiVersion);
    
    try {
      await this.k8sCustomApi.createNamespacedCustomObject({
        group,
        version,
        namespace: resource.metadata.namespace ?? 'default',
        plural: getResourcePlural(resource.kind),
        body: resource,
      });
      logger.info(`Created ${formatResource(resource)}`);
    } catch (error: any) {
      if (error.response?.statusCode === 409) {
        try {
          await this.k8sCustomApi.replaceNamespacedCustomObject({
            group,
            version,
            namespace: resource.metadata.namespace || 'default',
            plural: getResourcePlural(resource.kind),
            name: resource.metadata.name!,
            body: resource
          });
          logger.info(`Updated ${formatResource(resource)}`);
        } catch (updateError) {
          throw new KubernetesError(`Failed to update ${resource.kind}`, updateError);
        }
      } else {
        throw new KubernetesError(`Failed to create ${resource.kind}`, error);
      }
    }
  }

  private async getAtlasResource(kind: string, name: string, namespace?: string): Promise<AtlasResource | null> {
    const { group, version } = parseApiVersion('kro.run/v1alpha1');
    const plural = getResourcePlural(kind);

    try {
      const response = namespace 
        ? await this.k8sCustomApi.getNamespacedCustomObject({group, version, namespace, plural, name})
        : await this.k8sCustomApi.getClusterCustomObject({group, version, plural, name});
      
      return response.body as AtlasResource;
    } catch (error: any) {
      if (error.response?.statusCode === 404) {
        return null;
      }
      throw new KubernetesError(`Failed to get ${kind}`, error);
    }
  }

  private async getAllAtlasResourceCounts() {
    const kinds = ['Workspace', 'WebApplication', 'Infrastructure', 'Topic'];
    const counts: Record<string, number> = {};
    
    for (const kind of kinds) {
      try {
        const resources = await this.getAtlasResources(kind);
        counts[kind.toLowerCase() + 's'] = resources.length;
      } catch (error) {
        logger.warn(`Failed to count ${kind} resources:`, { error });
        counts[kind.toLowerCase() + 's'] = 0;
      }
    }
    
    return {
      workspaces: counts['workspaces'] || 0,
      applications: counts['webapplications'] || 0,
      infrastructure: counts['infrastructures'] || 0,
      topics: counts['topics'] || 0
    };
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

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    logger.info("Mini-Atlas MCP server running on stdio");
  }
}

// Start the server
async function main() {
  const server = new MiniAtlasMCPServer();

  // Graceful shutdown handling
  const shutdown = async () => {
    logger.info('Shutting down gracefully...');
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  try {
    await server.run();
    // Keep the process alive for STDIO communication
    await new Promise(() => {});
  } catch (error) {
    logger.error('Server failed to start:', { error });
    process.exit(1);
  }
}

main();