import { 
  validateResourceName, 
  validateNamespace,
  validateImageReference,
  validateHostname,
  validateReplicas,
  validateEnvironmentVariables,
  createAtlasResource,
  formatResourceList
} from '../src/utils';
import { ValidationError } from '../src/types';

describe('validateResourceName', () => {
  it('should not throw an error for a valid name', () => {
    expect(() => validateResourceName('my-resource', 'Resource')).not.toThrow();
  });

  it('should throw a ValidationError for an invalid name', () => {
    expect(() => validateResourceName('MyResource', 'Resource')).toThrow(ValidationError);
  });

  it('should throw for names that are too long', () => {
    const longName = 'a'.repeat(64);
    expect(() => validateResourceName(longName, 'Resource')).toThrow(ValidationError);
  });

  it('should throw for empty names', () => {
    expect(() => validateResourceName('', 'Resource')).toThrow(ValidationError);
  });
});

describe('validateImageReference', () => {
  it('should accept valid image references', () => {
    expect(() => validateImageReference('nginx:1.21')).not.toThrow();
    expect(() => validateImageReference('docker.io/library/nginx')).not.toThrow();
    expect(() => validateImageReference('gcr.io/project/image:tag')).not.toThrow();
  });

  it('should reject invalid image references', () => {
    expect(() => validateImageReference('')).toThrow(ValidationError);
    expect(() => validateImageReference('invalid image name')).toThrow(ValidationError);
  });
});

describe('validateHostname', () => {
  it('should accept valid hostnames', () => {
    expect(() => validateHostname('example.com')).not.toThrow();
    expect(() => validateHostname('api.company.co.uk')).not.toThrow();
  });

  it('should reject invalid hostnames', () => {
    expect(() => validateHostname('')).toThrow(ValidationError);
    expect(() => validateHostname('invalid..hostname')).toThrow(ValidationError);
  });
});

describe('validateReplicas', () => {
  it('should accept valid replica counts', () => {
    expect(() => validateReplicas(1)).not.toThrow();
    expect(() => validateReplicas(10)).not.toThrow();
  });

  it('should reject invalid replica counts', () => {
    expect(() => validateReplicas(-1)).toThrow(ValidationError);
    expect(() => validateReplicas(101)).toThrow(ValidationError);
    expect(() => validateReplicas(1.5)).toThrow(ValidationError);
  });
});

describe('createAtlasResource', () => {
  it('should create a valid Atlas resource', () => {
    const resource = createAtlasResource('Workspace', 'test-workspace', undefined, { name: 'test-workspace' });
    
    expect(resource.apiVersion).toBe('kro.run/v1alpha1');
    expect(resource.kind).toBe('Workspace');
    expect(resource.metadata.name).toBe('test-workspace');
    expect(resource.metadata.labels?.['app.kubernetes.io/managed-by']).toBe('mini-atlas-mcp');
  });

  it('should include namespace when provided', () => {
    const resource = createAtlasResource('WebApplication', 'test-app', 'test-namespace', { name: 'test-app' });
    
    expect(resource.metadata.namespace).toBe('test-namespace');
  });
});
