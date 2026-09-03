import { describe, expect, it } from 'vitest';
import { buildCentreShiftHistoryEmailContent } from './centre-shift-history-email.template';

describe('centre-shift-history-email.template', () => {
  it('builds branded concise centre shift history email', () => {
    const content = buildCentreShiftHistoryEmailContent({
      contactName: 'Jane Smith',
      dateFrom: '2026-08-01',
      dateTo: '2026-08-31',
      platformEnv: { NODE_ENV: 'test', APP_PUBLIC_URL: 'https://app.example.test' },
    });

    expect(content.subject).toBe('Shift history from Intra — 2026-08-01 to 2026-08-31');
    expect(content.text).toContain('Hi Jane,');
    expect(content.text).toContain('Attached is your Intra Shift history');
    expect(content.html).toContain('Intra');
    expect(content.text).not.toContain('Lex');
  });
});
