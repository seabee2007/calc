import { describe, expect, it } from 'vitest';
import {
  COMPANY_LEGAL_NAME,
  COMPANY_MAILING_ADDRESS_LINES,
  COMPANY_PHONE,
  PRODUCT_NAME,
  PRODUCT_OPERATOR_PHRASE,
  SUPPORT_EMAIL,
} from './companyInfo';

describe('companyInfo', () => {
  it('exports canonical legal and contact constants', () => {
    expect(COMPANY_LEGAL_NAME).toBe('Arden Systems LLC');
    expect(PRODUCT_NAME).toBe('Arden Project OS');
    expect(SUPPORT_EMAIL).toBe('support@ardenprojectos.com');
    expect(COMPANY_PHONE).toBe('(575) 310-1681');
    expect(COMPANY_MAILING_ADDRESS_LINES).toEqual([
      '1209 MOUNTAIN ROAD PL NE',
      'STE N',
      'ALBUQUERQUE, NM 87110',
      'USA',
    ]);
    expect(PRODUCT_OPERATOR_PHRASE).toBe(
      'Arden Project OS is operated by Arden Systems LLC.',
    );
  });
});
