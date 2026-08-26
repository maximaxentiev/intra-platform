import { MODULE_METADATA } from '@nestjs/common/constants';
import { beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from './app.module';
import { validateEnv } from './config/env.validation';
import { StaffDocumentsModule } from './staff-documents/staff-documents.module';
import { ShiftCommunicationsModule } from './shifts/shift-communications.module';
import { DocumentCommunicationsModule } from './staff-documents/document-communications.module';
import { ShiftsModule } from './shifts/shifts.module';
import { StaffModule } from './staff/staff.module';
import { StaffPortalModule } from './staff-portal/staff-portal.module';
import { WorkerModule } from './worker/worker.module';
import { ReportsModule } from './reports/reports.module';

const TEST_ENV = {
  NODE_ENV: 'test',
  DATABASE_URL: process.env.DATABASE_URL ?? 'postgres://intra:intra-dev-password@127.0.0.1:5434/intra',
  REDIS_URL: process.env.REDIS_URL ?? 'redis://127.0.0.1:6380',
  SESSION_SECRET: 'bootstrap-test-session-secret-min-16',
  DOCUMENT_SHARE_SIGNING_SECRET: 'test-document-share-signing-secret-32chars-min',
};

function moduleImports(mod: object): unknown[] {
  return Reflect.getMetadata(MODULE_METADATA.IMPORTS, mod) ?? [];
}

/** Walk module imports; fail if any entry is undefined (Nest UndefinedModuleException). */
function assertModuleImportsDefined(root: object, label: string): void {
  const visited = new Set<object>();

  function walk(mod: object, path: string): void {
    if (visited.has(mod)) return;
    visited.add(mod);

    const imports = moduleImports(mod);
    for (let i = 0; i < imports.length; i++) {
      const entry = imports[i];
      expect(entry, `${path} imports[${i}] must be defined`).toBeDefined();
      if (entry && typeof entry === 'function') {
        walk(entry, `${path} -> ${entry.name || 'AnonymousModule'}`);
      }
    }
  }

  walk(root, label);
}

describe('Nest module graph bootstrap', () => {
  beforeAll(() => {
    for (const [key, value] of Object.entries(TEST_ENV)) {
      process.env[key] = value;
    }
    validateEnv(process.env as Record<string, unknown>);
  });

  it('ShiftsModule imports[0] is defined StaffDocumentsModule (not undefined from circular import)', () => {
    const imports = moduleImports(ShiftsModule);
    expect(imports[0]).toBe(StaffDocumentsModule);
  });

  it('StaffPortalModule imports AuthModule only (no shift communications after carer cancel removal)', () => {
    const imports = moduleImports(StaffPortalModule);
    expect(imports).not.toContain(ShiftCommunicationsModule);
    expect(imports).not.toContain(ShiftsModule);
  });

  it('ShiftCommunicationsModule has no imports that re-enter StaffPortal/Shifts cycle', () => {
    const imports = moduleImports(ShiftCommunicationsModule);
    expect(imports).toEqual([]);
  });

  it('StaffModule subgraph has no undefined module imports (AppModule -> StaffModule -> StaffPortalModule path)', () => {
    assertModuleImportsDefined(StaffModule, 'StaffModule');
  });

  it('ShiftsModule subgraph has no undefined module imports', () => {
    assertModuleImportsDefined(ShiftsModule, 'ShiftsModule');
  });

  it('AppModule full import tree has no undefined module imports', () => {
    assertModuleImportsDefined(AppModule, 'AppModule');
  });

  it('WorkerModule import tree has no undefined module imports', () => {
    assertModuleImportsDefined(WorkerModule, 'WorkerModule');
  });

  it('ReportsModule subgraph has no undefined module imports', () => {
    assertModuleImportsDefined(ReportsModule, 'ReportsModule');
  });

  it('DocumentCommunicationsModule has no imports that re-enter StaffPortal/Shifts cycle', () => {
    const imports = moduleImports(DocumentCommunicationsModule);
    expect(imports).toEqual([]);
  });
});
