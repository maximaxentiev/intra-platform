import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  HttpException,
  InternalServerErrorException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NetworkApplicationApiKeyGuard } from './network-application-api-key.guard';
import { NetworkApplicationsSubmitService } from './network-applications-submit.service';
import { NetworkSubmitRateLimitService } from './network-submit-rate-limit.service';
import {
  buildEcaApplicationJson,
  fakePdfBuffer,
  matchedFilesFromPayload,
} from './network-submit.test-fixtures';

function createConfig(apiKey?: string) {
  return {
    get: vi.fn((key: string) => (key === 'NETWORK_APPLICATION_API_KEY' ? apiKey : undefined)),
  } as unknown as ConfigService;
}

describe('NetworkApplicationApiKeyGuard', () => {
  it('rejects missing configuration', () => {
    const guard = new NetworkApplicationApiKeyGuard(createConfig(undefined));
    expect(() =>
      guard.canActivate({
        switchToHttp: () => ({
          getRequest: () => ({ headers: { authorization: 'Bearer test' } }),
        }),
      } as never),
    ).toThrow(ServiceUnavailableException);
  });

  it('rejects missing bearer token', () => {
    const guard = new NetworkApplicationApiKeyGuard(createConfig('local-test-key'));
    expect(() =>
      guard.canActivate({
        switchToHttp: () => ({
          getRequest: () => ({ headers: {} }),
        }),
      } as never),
    ).toThrow(UnauthorizedException);
  });

  it('accepts valid bearer token', () => {
    const guard = new NetworkApplicationApiKeyGuard(createConfig('local-test-key'));
    const result = guard.canActivate({
      switchToHttp: () => ({
        getRequest: () => ({ headers: { authorization: 'Bearer local-test-key' } }),
      }),
    } as never);
    expect(result).toBe(true);
  });
});

describe('NetworkSubmitRateLimitService', () => {
  it('allows requests under the limit', async () => {
    const redis = {
      incr: vi.fn().mockResolvedValue(1),
      expire: vi.fn().mockResolvedValue(1),
    };
    const service = new NetworkSubmitRateLimitService(redis as never);
    await expect(service.assertAllowed('127.0.0.1', 'a@example.com')).resolves.toBeUndefined();
    expect(redis.incr).toHaveBeenCalledTimes(2);
  });

  it('blocks requests over the limit', async () => {
    const redis = {
      incr: vi.fn().mockResolvedValue(21),
      expire: vi.fn().mockResolvedValue(1),
    };
    const service = new NetworkSubmitRateLimitService(redis as never);
    await expect(service.assertAllowed('127.0.0.1', 'a@example.com')).rejects.toBeInstanceOf(
      HttpException,
    );
  });
});

describe('NetworkApplicationsSubmitService', () => {
  let storage: {
    isConfigured: ReturnType<typeof vi.fn>;
    uploadObject: ReturnType<typeof vi.fn>;
    deleteObject: ReturnType<typeof vi.fn>;
  };
  let rateLimit: { assertAllowed: ReturnType<typeof vi.fn> };
  let db: {
    select: ReturnType<typeof vi.fn>;
    transaction: ReturnType<typeof vi.fn>;
  };
  let service: NetworkApplicationsSubmitService;

  beforeEach(() => {
    storage = {
      isConfigured: vi.fn().mockReturnValue(true),
      uploadObject: vi.fn().mockResolvedValue({ key: 'applications/x/y/z.pdf' }),
      deleteObject: vi.fn().mockResolvedValue(undefined),
    };
    rateLimit = { assertAllowed: vi.fn().mockResolvedValue(undefined) };

    db = {
      select: vi.fn(),
      transaction: vi.fn(),
    };

    service = new NetworkApplicationsSubmitService(db as never, storage as never, rateLimit as never);
  });

  it('returns existing application for idempotent resubmission', async () => {
    const payload = buildEcaApplicationJson();
    const selectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([{ id: 'existing-app-id' }]),
    };
    db.select.mockReturnValue(selectChain);

    const result = await service.submit(
      JSON.stringify(payload),
      matchedFilesFromPayload(payload),
      '127.0.0.1',
    );

    expect(result).toEqual({
      success: true,
      applicationId: 'existing-app-id',
      status: 'received',
    });
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it('creates application, uploads documents, and logs activity', async () => {
    const payload = buildEcaApplicationJson();
    const selectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    };
    db.select.mockReturnValue(selectChain);

    const tx = {
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      }),
    };
    db.transaction.mockImplementation(async (fn: (txArg: typeof tx) => Promise<void>) => fn(tx));

    const result = await service.submit(
      JSON.stringify(payload),
      matchedFilesFromPayload(payload),
      '127.0.0.1',
    );

    expect(result.success).toBe(true);
    expect(result.status).toBe('received');
    expect(storage.uploadObject).toHaveBeenCalledTimes(payload.documents.length);
    expect(tx.insert).toHaveBeenCalledTimes(1 + payload.documents.length + 1);
    expect(rateLimit.assertAllowed).toHaveBeenCalledWith('127.0.0.1', payload.applicant.email);
  });

  it('cleans up storage when upload fails', async () => {
    const payload = buildEcaApplicationJson();
    const selectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    };
    db.select.mockReturnValue(selectChain);

    const tx = {
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      }),
    };
    db.transaction.mockImplementation(async (fn: (txArg: typeof tx) => Promise<void>) => fn(tx));

    storage.uploadObject
      .mockResolvedValueOnce({ key: 'applications/a/b/c1.pdf' })
      .mockRejectedValueOnce(new Error('upload failed'));

    await expect(
      service.submit(JSON.stringify(payload), matchedFilesFromPayload(payload), '127.0.0.1'),
    ).rejects.toBeInstanceOf(InternalServerErrorException);

    expect(storage.deleteObject).toHaveBeenCalledTimes(1);
    expect(storage.deleteObject.mock.calls[0]?.[0]).toContain('applications/');
  });

  it('cleans up storage when activity insert fails', async () => {
    const payload = buildEcaApplicationJson();
    const selectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    };
    db.select.mockReturnValue(selectChain);

    let insertCount = 0;
    const tx = {
      insert: vi.fn().mockImplementation(() => ({
        values: vi.fn().mockImplementation(async () => {
          insertCount += 1;
          if (insertCount === 6) {
            throw new Error('activity insert failed');
          }
        }),
      })),
    };
    db.transaction.mockImplementation(async (fn: (txArg: typeof tx) => Promise<void>) => {
      try {
        await fn(tx);
      } catch (err) {
        throw err;
      }
    });

    storage.uploadObject.mockResolvedValue({ key: 'applications/a/b/c1.pdf' });

    await expect(
      service.submit(JSON.stringify(payload), matchedFilesFromPayload(payload), '127.0.0.1'),
    ).rejects.toBeInstanceOf(InternalServerErrorException);

    expect(storage.deleteObject).toHaveBeenCalled();
  });

  it('persists nanny role-specific fields', async () => {
    const payload = buildEcaApplicationJson({ role: 'Nanny' });
    const selectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    };
    db.select.mockReturnValue(selectChain);

    const insertedValues: unknown[] = [];
    const tx = {
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockImplementation(async (values: unknown) => {
          insertedValues.push(values);
        }),
      }),
    };
    db.transaction.mockImplementation(async (fn: (txArg: typeof tx) => Promise<void>) => fn(tx));

    await service.submit(
      JSON.stringify(payload),
      matchedFilesFromPayload(payload),
      '127.0.0.1',
    );

    const applicationRow = insertedValues[0] as Record<string, unknown>;
    expect(applicationRow.role).toBe('nanny');
    expect(applicationRow.nannyTrainingCompleted).toBe(true);
  });

  it('handles duplicate race by returning existing application', async () => {
    const payload = buildEcaApplicationJson();
    let selectCall = 0;
    const selectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockImplementation(async () => {
        selectCall += 1;
        return selectCall === 1 ? [] : [{ id: 'race-winner-id' }];
      }),
    };
    db.select.mockReturnValue(selectChain);

    const tx = {
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockRejectedValue({ code: '23505' }),
      }),
    };
    db.transaction.mockImplementation(async (fn: (txArg: typeof tx) => Promise<void>) => fn(tx));

    const result = await service.submit(
      JSON.stringify(payload),
      matchedFilesFromPayload(payload),
      '127.0.0.1',
    );

    expect(result.applicationId).toBe('race-winner-id');
    expect(storage.uploadObject).not.toHaveBeenCalled();
  });
});

describe('NetworkApplicationsSubmitService submission emails', () => {
  it('does not send applicant or internal notification emails on submit', () => {
    const applicationsDir = dirname(fileURLToPath(import.meta.url));
    const submitServiceSource = readFileSync(
      join(applicationsDir, 'network-applications-submit.service.ts'),
      'utf8',
    );
    const controllerSource = readFileSync(
      join(applicationsDir, 'public-applications.controller.ts'),
      'utf8',
    );

    for (const source of [submitServiceSource, controllerSource]) {
      expect(source).not.toMatch(/EmailService|sendEmail|resend|@\/lib\/email/);
    }
  });
});

describe('NetworkApplicationsSubmitService storage not configured', () => {
  it('fails when storage is unavailable', async () => {
    const payload = buildEcaApplicationJson();
    const selectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    };
    const db = { select: vi.fn().mockReturnValue(selectChain), transaction: vi.fn() };
    const storage = { isConfigured: vi.fn().mockReturnValue(false) };
    const rateLimit = { assertAllowed: vi.fn().mockResolvedValue(undefined) };
    const service = new NetworkApplicationsSubmitService(
      db as never,
      storage as never,
      rateLimit as never,
    );

    await expect(
      service.submit(
        JSON.stringify(payload),
        matchedFilesFromPayload(payload),
        '127.0.0.1',
      ),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
  });
});
