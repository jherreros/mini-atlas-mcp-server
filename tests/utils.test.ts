import { validateResourceName } from '../src/utils';
import { ValidationError } from '../src/types';

describe('validateResourceName', () => {
  it('should not throw an error for a valid name', () => {
    expect(() => validateResourceName('my-resource', 'Resource')).not.toThrow();
  });

  it('should throw a ValidationError for an invalid name', () => {
    expect(() => validateResourceName('MyResource', 'Resource')).toThrow(ValidationError);
  });
});
