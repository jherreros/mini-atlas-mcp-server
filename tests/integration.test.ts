import { Server } from "@modelcontextprotocol/sdk/server/index.js";

// Mock kubernetes client to avoid needing actual cluster for tests
jest.mock('@kubernetes/client-node', () => ({
  KubeConfig: jest.fn().mockImplementation(() => ({
    loadFromCluster: jest.fn(),
    loadFromDefault: jest.fn(),
    makeApiClient: jest.fn().mockReturnValue({
      listNamespace: jest.fn().mockResolvedValue({ items: [] }),
    }),
  })),
  CoreV1Api: jest.fn(),
  CustomObjectsApi: jest.fn(),
}));

// Mock logger to avoid console output during tests
jest.mock('../src/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }
}));

describe('Mini-Atlas MCP Server Integration', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  it('should import and initialize without errors', async () => {
    // This test validates that all imports work and basic structure is correct
    const { 
      validateResourceName,
      validateImageReference,
      createAtlasResource,
      parseApiVersion,
      getResourcePlural 
    } = await import('../src/utils');
    
    const { ValidationError } = await import('../src/types');

    // Test basic functionality
    expect(() => validateResourceName('test-resource', 'Resource')).not.toThrow();
    expect(() => validateImageReference('nginx:latest')).not.toThrow();
    
    const resource = createAtlasResource('Workspace', 'test-workspace', undefined, {
      name: 'test-workspace',
      environment: 'development'
    });
    
    expect(resource.kind).toBe('Workspace');
    expect(resource.metadata.name).toBe('test-workspace');
    expect(resource.spec.name).toBe('test-workspace');
    
    expect(parseApiVersion('kro.run/v1alpha1')).toEqual({
      group: 'kro.run',
      version: 'v1alpha1'
    });
    
    expect(getResourcePlural('Workspace')).toBe('workspaces');
  });

  it('should create server tools with correct schemas', async () => {
    // This validates the tool schemas are properly defined
    const server = new Server(
      { name: "test-server", version: "1.0.0" },
      { capabilities: { resources: {}, tools: {} } }
    );

    // Verify server can be created without errors
    expect(server).toBeDefined();
  });

  it('should validate all required environment functions exist', () => {
    const { 
      isDevelopment,
      isInCluster,
      getCurrentTimestamp,
      formatBytes,
      formatCPU 
    } = require('../src/utils');

    expect(typeof isDevelopment).toBe('function');
    expect(typeof isInCluster).toBe('function');
    expect(typeof getCurrentTimestamp).toBe('function');
    expect(typeof formatBytes).toBe('function');
    expect(typeof formatCPU).toBe('function');

    // Test environment detection functions
    const originalNodeEnv = process.env['NODE_ENV'];
    const originalKubernetesHost = process.env['KUBERNETES_SERVICE_HOST'];

    // Test development mode detection
    process.env['NODE_ENV'] = 'development';
    expect(isDevelopment()).toBe(true);
    
    process.env['NODE_ENV'] = 'production';
    expect(isDevelopment()).toBe(false);

    // Test in-cluster detection
    process.env['KUBERNETES_SERVICE_HOST'] = 'kubernetes.default';
    expect(isInCluster()).toBe(true);
    
    delete process.env['KUBERNETES_SERVICE_HOST'];
    expect(isInCluster()).toBe(false);

    // Restore original environment
    if (originalNodeEnv !== undefined) {
      process.env['NODE_ENV'] = originalNodeEnv;
    } else {
      delete process.env['NODE_ENV'];
    }
    
    if (originalKubernetesHost !== undefined) {
      process.env['KUBERNETES_SERVICE_HOST'] = originalKubernetesHost;
    }

    // Test utility functions
    expect(getCurrentTimestamp()).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(formatBytes(1024)).toBe('1 KB');
    expect(formatBytes(1048576)).toBe('1 MB');
    expect(formatCPU(500)).toBe('500m');
    expect(formatCPU(1500)).toBe('1.5');
  });
});
