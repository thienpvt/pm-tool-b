import { describe, expect, it } from 'vitest';
import { ForbiddenError, NotFoundError, ValidationError } from './errors';

describe('service errors', () => {
  it('ForbiddenError is an Error with matching name and no status field', () => {
    const err = new ForbiddenError('secret reason');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(ForbiddenError);
    expect(err.name).toBe('ForbiddenError');
    expect(err.message).toBe('secret reason');
    expect('status' in err).toBe(false);
  });

  it('NotFoundError carries optional resource and no status field', () => {
    const err = new NotFoundError('missing', 'project');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(NotFoundError);
    expect(err.name).toBe('NotFoundError');
    expect(err.resource).toBe('project');
    expect('status' in err).toBe(false);
  });

  it('ValidationError carries optional field and no status field', () => {
    const err = new ValidationError('bad category', 'category');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(ValidationError);
    expect(err.name).toBe('ValidationError');
    expect(err.field).toBe('category');
    expect('status' in err).toBe(false);
  });

  it('instanceof narrows correctly between the three classes', () => {
    const forbidden: Error = new ForbiddenError('x');
    const notFound: Error = new NotFoundError('x');
    const validation: Error = new ValidationError('x');

    expect(forbidden instanceof ForbiddenError).toBe(true);
    expect(forbidden instanceof NotFoundError).toBe(false);
    expect(forbidden instanceof ValidationError).toBe(false);

    expect(notFound instanceof NotFoundError).toBe(true);
    expect(notFound instanceof ForbiddenError).toBe(false);

    expect(validation instanceof ValidationError).toBe(true);
    expect(validation instanceof ForbiddenError).toBe(false);
  });
});
