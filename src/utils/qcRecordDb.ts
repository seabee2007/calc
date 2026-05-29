import type { QCRecord, QCRecordType } from '../types';

export function computeBreakResult(
  testAgeDays?: number,
  designStrengthPsi?: number,
  breakStrengthPsi?: number,
  userChoice?: 'pass' | 'fail' | 'informational',
): 'pass' | 'fail' | 'informational' | undefined {
  if (userChoice) return userChoice;
  if (designStrengthPsi == null || breakStrengthPsi == null) return undefined;
  if (breakStrengthPsi >= designStrengthPsi) return 'pass';
  if (testAgeDays === 7 || testAgeDays === 14) return 'informational';
  return 'fail';
}

function numOrUndefined(v: unknown): number | undefined {
  if (v == null || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

export function isQcRecordTypeColumnError(message: string): boolean {
  const m = message.toLowerCase();
  return m.includes('record_type') || m.includes('record_data');
}

export function buildRecordDataPayload(rec: Partial<QCRecord>): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  const copy = (key: keyof QCRecord, value: unknown) => {
    if (value !== undefined && value !== null && value !== '') {
      payload[key] = value;
    }
  };

  copy('recordType', rec.recordType);
  copy('windSpeed', rec.windSpeed);
  copy('concreteTemperature', rec.concreteTemperature);
  copy('unitWeight', rec.unitWeight);
  copy('truckNumber', rec.truckNumber);
  copy('ticketNumber', rec.ticketNumber);
  copy('batchTime', rec.batchTime);
  copy('sampleTime', rec.sampleTime);
  copy('testAgeDays', rec.testAgeDays);
  copy('cylinderId', rec.cylinderId);
  copy('breakDate', rec.breakDate);
  copy('designStrengthPsi', rec.designStrengthPsi);
  copy('breakStrengthPsi', rec.breakStrengthPsi);
  copy('loadLbs', rec.loadLbs);
  copy('averageStrengthPsi', rec.averageStrengthPsi);
  copy('breakResult', rec.breakResult);
  copy('temperature', rec.temperature);
  copy('humidity', rec.humidity);
  copy('slump', rec.slump);
  copy('airContent', rec.airContent);
  copy('cylindersMade', rec.cylindersMade);

  return payload;
}

export function legacyQcColumns(rec: Partial<QCRecord>) {
  return {
    temperature: rec.temperature ?? 0,
    humidity: rec.humidity ?? 0,
    slump: rec.slump ?? 0,
    air_content: rec.airContent ?? 0,
    cylinders_made: rec.cylindersMade ?? 0,
  };
}

export function buildQcInsertRow(
  projectId: string,
  rec: Omit<QCRecord, 'id' | 'projectId' | 'createdAt' | 'updatedAt'>,
) {
  const recordType: QCRecordType = rec.recordType ?? 'fresh_test';
  return {
    project_id: projectId,
    date: rec.date,
    record_type: recordType,
    record_data: buildRecordDataPayload({ ...rec, recordType }),
    notes: rec.notes ?? '',
    ...legacyQcColumns(rec),
  };
}

export function buildQcUpdateRow(rec: Partial<QCRecord>) {
  const recordType = rec.recordType;
  const row: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (rec.date !== undefined) row.date = rec.date;
  if (rec.notes !== undefined) row.notes = rec.notes ?? '';
  if (recordType !== undefined) row.record_type = recordType;

  const hasLegacy =
    rec.temperature !== undefined ||
    rec.humidity !== undefined ||
    rec.slump !== undefined ||
    rec.airContent !== undefined ||
    rec.cylindersMade !== undefined;

  if (hasLegacy) {
    Object.assign(row, legacyQcColumns(rec));
  }

  const dataPayload = buildRecordDataPayload(rec);
  if (Object.keys(dataPayload).length > 0) {
    row.record_data = dataPayload;
  }

  return row;
}

export function mapQcRecordFieldsFromDb(r: any): Omit<QCRecord, 'id' | 'projectId' | 'createdAt' | 'updatedAt' | 'checklist'> {
  const data = r.record_data ?? {};
  const recordType: QCRecordType =
    r.record_type ?? data.recordType ?? 'fresh_test';

  return {
    recordType,
    date: r.date,
    temperature: numOrUndefined(r.temperature ?? data.temperature),
    humidity: numOrUndefined(r.humidity ?? data.humidity),
    windSpeed: numOrUndefined(data.windSpeed),
    concreteTemperature: numOrUndefined(data.concreteTemperature),
    slump: numOrUndefined(r.slump ?? data.slump),
    airContent: numOrUndefined(r.air_content ?? data.airContent),
    unitWeight: numOrUndefined(data.unitWeight),
    cylindersMade: numOrUndefined(r.cylinders_made ?? data.cylindersMade),
    truckNumber: data.truckNumber,
    ticketNumber: data.ticketNumber,
    batchTime: data.batchTime,
    sampleTime: data.sampleTime,
    testAgeDays: data.testAgeDays,
    cylinderId: data.cylinderId,
    breakDate: data.breakDate,
    designStrengthPsi: numOrUndefined(data.designStrengthPsi),
    breakStrengthPsi: numOrUndefined(data.breakStrengthPsi),
    loadLbs: numOrUndefined(data.loadLbs),
    averageStrengthPsi: numOrUndefined(data.averageStrengthPsi),
    breakResult: data.breakResult,
    notes: r.notes ?? data.notes ?? '',
  };
}
