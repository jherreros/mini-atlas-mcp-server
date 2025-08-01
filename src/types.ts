// Type definitions for Mini-Atlas MCP Server

export interface AtlasResource {
  apiVersion: string;
  kind: string;
  metadata: {
    name: string;
    namespace?: string;
    labels?: Record<string, string>;
    annotations?: Record<string, string>;
  };
  spec: any;
  status?: any;
}

export interface WorkspaceSpec {
  name: string;
  description?: string;
  team?: string;
  environment?: 'development' | 'staging' | 'production';
}

export interface WebApplicationSpec {
  name: string;
  namespace: string;
  image: string;
  tag?: string;
  replicas?: number;
  host: string;
  port?: number;
  env?: Record<string, string>;
  resources?: {
    requests?: {
      cpu?: string;
      memory?: string;
    };
    limits?: {
      cpu?: string;
      memory?: string;
    };
  };
  healthCheck?: {
    path?: string;
    port?: number;
    initialDelaySeconds?: number;
    periodSeconds?: number;
  };
}

export interface InfrastructureSpec {
  name: string;
  namespace: string;
  database: string;
  databaseVersion?: string;
  storageSize?: string;
  redisEnabled?: boolean;
  backupEnabled?: boolean;
}

export interface TopicSpec {
  name: string;
  namespace: string;
  partitions?: number;
  replicationFactor?: number;
  retentionMs?: number;
  config?: Record<string, string>;
}

export interface CreateWorkspaceArgs {
  name: string;
  description?: string;
  team?: string;
  environment?: string;
}

export interface DeployWebAppArgs {
  name: string;
  namespace: string;
  image: string;
  tag?: string;
  replicas?: number;
  host: string;
  port?: number;
  env?: Record<string, string>;
  resources?: {
    requests?: {
      cpu?: string;
      memory?: string;
    };
    limits?: {
      cpu?: string;
      memory?: string;
    };
  };
}

export interface CreateInfrastructureArgs {
  name: string;
  namespace: string;
  database: string;
  databaseVersion?: string;
  storageSize?: string;
  redisEnabled?: boolean;
  backupEnabled?: boolean;
}

export interface CreateTopicArgs {
  name: string;
  namespace: string;
  partitions?: number;
  replicationFactor?: number;
  retentionMs?: number;
}

export interface ListResourcesArgs {
  type: 'workspace' | 'webapp' | 'infrastructure' | 'topic' | 'all';
  namespace?: string;
}

export interface ClusterStatus {
  nodes: number;
  namespaces: number;
  nodeStatus: NodeStatus[];
  atlasResources?: {
    workspaces: number;
    applications: number;
    infrastructure: number;
    topics: number;
  };
}

export interface NodeStatus {
  name?: string | undefined;
  ready: boolean;
  version?: string | undefined;
  roles?: string[] | undefined;
}

export interface HealthStatus {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  kubernetes?: boolean;
  error?: string;
}

export interface Metrics {
  workspaces_total: number;
  applications_total: number;
  infrastructure_total: number;
  topics_total: number;
  timestamp: string;
}

export interface MCPToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, any>;
    required: string[];
  };
}

export interface MCPResource {
  uri: string;
  mimeType: string;
  name: string;
  description: string;
}

export interface MCPResponse {
  content: Array<{
    type: 'text' | 'json';
    text: string;
  }>;
}

// Kubernetes API types (simplified)
export interface K8sObjectMeta {
  name?: string;
  namespace?: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  creationTimestamp?: string;
  resourceVersion?: string;
  uid?: string;
}

export interface K8sResource {
  apiVersion: string;
  kind: string;
  metadata: K8sObjectMeta;
  spec?: any;
  status?: any;
}

export interface K8sListResponse<T> {
  apiVersion: string;
  kind: string;
  metadata: {
    resourceVersion: string;
  };
  items: T[];
}

// Error types
export class AtlasError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'AtlasError';
  }
}

export class KubernetesError extends AtlasError {
  constructor(message: string, details?: any) {
    super(message, 'KUBERNETES_ERROR', details);
    this.name = 'KubernetesError';
  }
}

export class ResourceNotFoundError extends AtlasError {
  constructor(resource: string, name: string) {
    super(`${resource} '${name}' not found`, 'RESOURCE_NOT_FOUND', { resource, name });
    this.name = 'ResourceNotFoundError';
  }
}

export class ValidationError extends AtlasError {
  constructor(message: string, field?: string) {
    super(message, 'VALIDATION_ERROR', { field });
    this.name = 'ValidationError';
  }
}