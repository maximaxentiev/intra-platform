import { describe, expect, it } from 'vitest';
import {
  batchProgress70EmailContainsNoSensitiveInternals,
  buildBatchProgress70EmailContent,
} from './shift-batch-progress-email.template';

describe('buildBatchProgress70EmailContent', () => {
  it('includes progress summary and final confirmation promise', () => {
    const content = buildBatchProgress70EmailContent({
      centreName: 'ABC Child Care',
      fulfilledCount: 7,
      activeTotal: 10,
    });

    expect(content.subject).toBe('Update on your upcoming Intra shift request');
    expect(content.text).toContain('7 of 10 active shifts have been filled.');
    expect(content.text).toContain('final confirmation');
    expect(content.text).toContain('Carer document links');
    expect(content.html).toContain('ABC Child Care');
    expect(batchProgress70EmailContainsNoSensitiveInternals(content)).toBe(true);
  });

  it('escapes HTML in centre name', () => {
    const content = buildBatchProgress70EmailContent({
      centreName: 'Centre <script>',
      fulfilledCount: 7,
      activeTotal: 10,
    });
    expect(content.html).not.toContain('<script>');
    expect(content.html).toContain('&lt;script&gt;');
  });
});
