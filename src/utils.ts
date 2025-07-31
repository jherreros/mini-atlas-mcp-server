// Utility functions for Mini-Atlas MCP Server

import { AtlasResource, ValidationError } from './types';

/**
 * Validates a resource name according to Kubernetes naming conventions
 */
export function validateResourceName(name: string, resourceType: string): void {
  if (!name || typeof name !== 'string') {
    throw new ValidationError(`${resourceType} name is required and must be a string`);
  }

  // Kubernetes naming rules
  const nameRegex = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/;
  if (!nameRegex.test(name)) {
    throw new ValidationError(
      `${resourceType} name '${name}' must consist of lower case alphanumeric characters or '-', and must start and end with an alphanumeric character`
    );
  }

  if (name.length > 63) {
    throw new ValidationError(`${resourceType} name '${name}' must be no more than 63 characters`);
  }
}

/**
 * Validates a namespace name
 */
export function validateNamespace(namespace: string): void {
  validateResourceName(namespace, 'Namespace');
}

/**
 * Validates an image reference
 */
export function validateImageReference(image: string): void {
  if (!image || typeof image !== 'string') {
    throw new ValidationError('Image reference is required and must be a string');
  }

  // Basic image validation - should contain at least a name part
  const imageRegex = /^[a-zA-Z0-9._/-]+(?::[a-zA-Z0-9._-]+)?$/;
  if (!imageRegex.test(image)) {
    throw new ValidationError(`Invalid image reference: ${image}`);
  }
}

/**
 * Validates a hostname for ingress
 */
export function validateHostname(hostname: string): void {
  if (!hostname || typeof hostname !== 'string') {
    throw new ValidationError('Hostname is required and must be a string');
  }

  // Basic hostname validation
  const hostnameRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*$/;
  if (!hostnameRegex.test(hostname)) {
    throw new ValidationError(`Invalid hostname: ${hostname}`);
  }

  if (hostname.length > 253) {
    throw new ValidationError(`Hostname '${hostname}' must be no more than 253 characters`);
  }
}

/**
 * Validates replica count
 */
export function validateReplicas(replicas: number): void {
  if (!Number.isInteger(replicas) || replicas < 0) {
    throw new ValidationError('Replicas must be a non-negative integer');
  }

  if (replicas > 100) {
    throw new ValidationError('Replicas cannot exceed 100 for safety reasons');
  }
}

/**
 * Validates environment variables
 */
export function validateEnvironmentVariables(env: Record<string, string>): void {
  if (!env || typeof env !== 'object') {
    return;
  }

  for (const [key, value] of Object.entries(env)) {
    if (typeof key !== 'string' || typeof value !== 'string') {
      throw new ValidationError('Environment variables must be string key-value pairs');
    }

    // Kubernetes env var name validation
    const envKeyRegex = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
    if (!envKeyRegex.test(key)) {
      throw new ValidationError(`Invalid environment variable name: ${key}`);
    }
  }
}

/**
 * Sanitizes a string to be used as a Kubernetes resource name
 */
export function sanitizeResourceName(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-')
    .substring(0, 63);
}

/**
 * Creates a standardized Atlas resource
 */
export function createAtlasResource(
  kind: string,
  name: string,
  namespace: string | undefined,
  spec: any
): AtlasResource {
  validateResourceName(name, kind);
  if (namespace) {
    validateNamespace(namespace);
  }

  const metadata: any = {
    name,
    labels: {
      'app.kubernetes.io/managed-by': 'mini-atlas-mcp',
      'mini-atlas.io/resource-type': kind.toLowerCase()
    },
    annotations: {
      'mini-atlas.io/created-by': 'mcp-server',
      'mini-atlas.io/created-at': new Date().toISOString()
    }
  };

  if (namespace) {
    metadata.namespace = namespace;
  }

  const metadata2: any = {
    name,
    labels: {
      'app.kubernetes.io/managed-by': 'mini-atlas-mcp',
      'mini-atlas.io/resource-type': kind.toLowerCase()
    },
    annotations: {
      'mini-atlas.io/created-by': 'mcp-server',
      'mini-atlas.io/created-at': new Date().toISOString()
    }
  };

  if (namespace) {
    metadata2.namespace = namespace;
  }

  return {
    apiVersion: 'kro.run/v1alpha1',
    kind,
    metadata: metadata2,
    spec
  };
}

/**
 * Formats a resource for display
 */
export function formatResource(resource: AtlasResource): string {
  const namespace = resource.metadata.namespace ? ` (${resource.metadata.namespace})` : '';
  return `${resource.kind}/${resource.metadata.name}${namespace}`;
}

/**
 * Formats a list of resources for display
 */
export function formatResourceList(resources: AtlasResource[]): string {
  if (resources.length === 0) {
    return 'No resources found';
  }

  const grouped = resources.reduce((acc, resource) => {
    const kind = resource.kind;
    if (!acc[kind]) {
      acc[kind] = [];
    }
    acc[kind].push(resource);
    return acc;
  }, {} as Record<string, AtlasResource[]>);

  const formatted = Object.entries(grouped).map(([kind, items]) => {
    const itemList = items
      .map(item => {
        const namespace = item.metadata.namespace ? ` (${item.metadata.namespace})` : '';
        return `  - ${item.metadata.name}${namespace}`;
      })
      .join('\n');
    return `${kind}s:\n${itemList}`;
  }).join('\n\n');

  return formatted;
}

/**
 * Extracts the plural form of a Kubernetes resource kind
 */
export function getResourcePlural(kind: string): string {
  const pluralMap: Record<string, string> = {
    'Workspace': 'workspaces',
    'WebApplication': 'webapplications',
    'Infrastructure': 'infrastructures',
    'Topic': 'topics'
  };

  return pluralMap[kind] || kind.toLowerCase() + 's';
}

/**
 * Parses API version into group and version
 */
export function parseApiVersion(apiVersion: string): { group: string; version: string } {
  const parts = apiVersion.split('/');
  if (parts.length === 1) {
    return { group: '', version: parts[0] || '' };
  }
  return { group: parts[0] || '', version: parts[1] || '' };
}

/**
 * Safely gets a nested property from an object
 */
export function getNestedProperty(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

/**
 * Checks if a string is a valid JSON
 */
export function isValidJson(str: string): boolean {
  try {
    JSON.parse(str);
    return true;
  } catch {
    return false;
  }
}

/**
 * Sleeps for a specified number of milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retries an async operation with exponential backoff
 */
export async function retry<T>(
  operation: () => Promise<T>,
  maxAttempts: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (attempt === maxAttempts) {
        throw lastError;
      }

      const delay = baseDelay * Math.pow(2, attempt - 1);
      console.error(`Operation failed (attempt ${attempt}/${maxAttempts}), retrying in ${delay}ms:`, lastError.message);
      await sleep(delay);
    }
  }

  throw lastError!;
}

/**
 * Converts bytes to human readable format
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Converts CPU millicores to human readable format
 */
export function formatCPU(millicores: number): string {
  if (millicores < 1000) {
    return `${millicores}m`;
  }
  return `${(millicores / 1000).toFixed(1)}`;
}

/**
 * Gets the current timestamp in ISO format
 */
export function getCurrentTimestamp(): string {
  return new Date().toISOString();
}

/**
 * Checks if the server is running in development mode
 */
export function isDevelopment(): boolean {
  return process.env['NODE_ENV'] === 'development';
}

/**
 * Checks if the server is running inside a Kubernetes cluster
 */
export function isInCluster(): boolean {
  return !!process.env['KUBERNETES_SERVICE_HOST'];
}
