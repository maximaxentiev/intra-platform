import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { UpsertStaffDto } from '../staff/dto/staff.dto';

describe('applications migration', () => {
  const sql = readFileSync(
    join(__dirname, '../../drizzle/0001_charming_king_cobra.sql'),
    'utf8',
  );

  it('creates application enums and tables without dropping existing data', () => {
    expect(sql).toContain('CREATE TYPE "public"."application_role"');
    expect(sql).toContain('CREATE TYPE "public"."application_status"');
    expect(sql).toContain('CREATE TYPE "public"."application_document_category"');
    expect(sql).toContain('CREATE TABLE "applications"');
    expect(sql).toContain('CREATE TABLE "application_documents"');
    expect(sql).toContain('CREATE TABLE "application_activity"');
    expect(sql).not.toMatch(/DROP TABLE/i);
    expect(sql).not.toMatch(/TRUNCATE/i);
  });

  it('adds unique staff source_application_id constraint', () => {
    expect(sql).toContain('ADD COLUMN "source_application_id" uuid');
    expect(sql).toContain('"staff_source_application_id_unique" UNIQUE("source_application_id")');
    expect(sql).toContain('"applications_hired_staff_id_unique" UNIQUE("hired_staff_id")');
  });

  it('adds unique external_submission_id constraint', () => {
    const sql2 = readFileSync(
      join(__dirname, '../../drizzle/0002_overconfident_mongu.sql'),
      'utf8',
    );
    expect(sql2).toContain('"external_submission_id" text');
    expect(sql2).toContain('"applications_external_submission_id_unique" UNIQUE("external_submission_id")');
  });
});

describe('UpsertStaffDto Nanny role', () => {
  it('accepts Nanny as a valid staff role', async () => {
    const dto = plainToInstance(UpsertStaffDto, {
      legalName: 'Test Applicant',
      role: 'Nanny',
    });
    expect(await validate(dto)).toHaveLength(0);
  });
});
