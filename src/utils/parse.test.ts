import { describe, expect, it } from 'vitest';
import { parseParticipantLines } from './parse';

describe('parseParticipantLines', () => {
  it('extracts names and normalizes Iranian mobile numbers', () => {
    const result = parseParticipantLines(
      'علی رضایی - 0912-111-1111\nمریم حسینی، ۰۹۳۵۱۲۳۴۵۶۷\nسارا ابراهیمی-نژاد\n+98 912 345 6789 رضا\n\n   '
    );
    expect(result.map((p) => [p.name, p.phone])).toEqual([
      ['علی رضایی', '09121111111'],
      ['مریم حسینی', '09351234567'],
      ['سارا ابراهیمی-نژاد', undefined],
      ['رضا', '09123456789'],
    ]);
  });
});
