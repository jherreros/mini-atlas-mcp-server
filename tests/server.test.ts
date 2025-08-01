import { 
  parseApiVersion,
  getResourcePlural,
  formatResource,
  formatResourceList,
  retry,
  sleep
} from '../src/utils';
import { AtlasResource } from '../src/types';

describe('parseApiVersion', () => {
  it('should parse API version with group', () => {
    const result = parseApiVersion('kro.run/v1alpha1');
    expect(result).toEqual({ group: 'kro.run', version: 'v1alpha1' });
  });

  it('should parse API version without group', () => {
    const result = parseApiVersion('v1');
    expect(result).toEqual({ group: '', version: 'v1' });
  });

  it('should handle empty API version', () => {
    const result = parseApiVersion('');
    expect(result).toEqual({ group: '', version: '' });
  });
});

describe('getResourcePlural', () => {
  it('should return correct plurals for known resource kinds', () => {
    expect(getResourcePlural('Workspace')).toBe('workspaces');
    expect(getResourcePlural('WebApplication')).toBe('webapplications');
    expect(getResourcePlural('Infrastructure')).toBe('infrastructures');
    expect(getResourcePlural('Topic')).toBe('topics');
  });

  it('should return default plural for unknown kinds', () => {
    expect(getResourcePlural('CustomResource')).toBe('customresources');
  });
});

describe('formatResource', () => {
  it('should format resource without namespace', () => {
    const resource: AtlasResource = {
      apiVersion: 'kro.run/v1alpha1',
      kind: 'Workspace',
      metadata: {
        name: 'test-workspace'
      },
      spec: {}
    };

    expect(formatResource(resource)).toBe('Workspace/test-workspace');
  });

  it('should format resource with namespace', () => {
    const resource: AtlasResource = {
      apiVersion: 'kro.run/v1alpha1',
      kind: 'WebApplication',
      metadata: {
        name: 'test-app',
        namespace: 'test-namespace'
      },
      spec: {}
    };

    expect(formatResource(resource)).toBe('WebApplication/test-app (test-namespace)');
  });
});

describe('formatResourceList', () => {
  it('should format empty resource list', () => {
    expect(formatResourceList([])).toBe('No resources found');
  });

  it('should format single resource type', () => {
    const resources: AtlasResource[] = [
      {
        apiVersion: 'kro.run/v1alpha1',
        kind: 'Workspace',
        metadata: { name: 'workspace1' },
        spec: {}
      },
      {
        apiVersion: 'kro.run/v1alpha1',
        kind: 'Workspace',
        metadata: { name: 'workspace2' },
        spec: {}
      }
    ];

    const result = formatResourceList(resources);
    expect(result).toContain('Workspaces:');
    expect(result).toContain('- workspace1');
    expect(result).toContain('- workspace2');
  });

  it('should group by resource kind', () => {
    const resources: AtlasResource[] = [
      {
        apiVersion: 'kro.run/v1alpha1',
        kind: 'Workspace',
        metadata: { name: 'workspace1' },
        spec: {}
      },
      {
        apiVersion: 'kro.run/v1alpha1',
        kind: 'WebApplication',
        metadata: { name: 'app1', namespace: 'ns1' },
        spec: {}
      }
    ];

    const result = formatResourceList(resources);
    expect(result).toContain('Workspaces:');
    expect(result).toContain('WebApplications:');
    expect(result).toContain('- workspace1');
    expect(result).toContain('- app1 (ns1)');
  });
});

describe('sleep', () => {
  it('should sleep for specified duration', async () => {
    const start = Date.now();
    await sleep(10);
    const end = Date.now();
    expect(end - start).toBeGreaterThanOrEqual(10);
  });
});

describe('retry', () => {
  it('should succeed on first attempt', async () => {
    const mockFn = jest.fn().mockResolvedValue('success');
    const result = await retry(mockFn, 3, 10);
    expect(result).toBe('success');
    expect(mockFn).toHaveBeenCalledTimes(1);
  });

  it('should retry on failure and eventually succeed', async () => {
    const mockFn = jest.fn()
      .mockRejectedValueOnce(new Error('fail1'))
      .mockRejectedValueOnce(new Error('fail2'))
      .mockResolvedValueOnce('success');

    const result = await retry(mockFn, 3, 10);
    expect(result).toBe('success');
    expect(mockFn).toHaveBeenCalledTimes(3);
  });

  it('should fail after max attempts', async () => {
    const mockFn = jest.fn().mockRejectedValue(new Error('persistent failure'));
    
    await expect(retry(mockFn, 2, 10)).rejects.toThrow('persistent failure');
    expect(mockFn).toHaveBeenCalledTimes(2);
  });
});
