import { describe, expect, it } from 'vitest';
import type { FormField } from '@shared/schemas/forms';
import { buildDefaultMappings, extractGoogleDocIdFromUrl } from '@shared/schemas/templates';
import { isSafeAdminRegex, validateDynamicSubmission } from '@shared/utils/form-validator';

describe('Phase 4 — Google Docs Template URL & Placeholder Mapping', () => {
  it('extracts Google Docs ID strictly from official docs.google.com URLs and rejects arbitrary URLs', () => {
    expect(
      extractGoogleDocIdFromUrl(
        'https://docs.google.com/document/d/1AbCdEfGhIjKlMnOpQrStUvWxYz_12345/edit?usp=sharing',
      ),
    ).toBe('1AbCdEfGhIjKlMnOpQrStUvWxYz_12345');

    expect(
      extractGoogleDocIdFromUrl(
        'https://docs.google.com/document/u/0/d/1AbCdEfGhIjKlMnOpQrStUvWxYz_12345/view',
      ),
    ).toBe('1AbCdEfGhIjKlMnOpQrStUvWxYz_12345');

    // Reject non-Docs or HTTP or SSRF URLs
    expect(
      extractGoogleDocIdFromUrl('http://docs.google.com/document/d/1AbCdEfGhIjKlMnOpQ'),
    ).toBeNull();
    expect(
      extractGoogleDocIdFromUrl('https://evil.example.com/document/d/1AbCdEfGhIjKlMnOpQ'),
    ).toBeNull();
    expect(extractGoogleDocIdFromUrl('https://169.254.169.254/latest/meta-data')).toBeNull();
  });

  it('builds sensible default placeholder source mappings', () => {
    const mappings = buildDefaultMappings([
      'nama_lengkap',
      'nomor_sertifikat',
      'nama_kegiatan',
      'nama_kepala_puskesmas',
      'tanggal_terbit',
      'qr_code',
    ]);

    const byKey = new Map(mappings.map((m) => [m.placeholder, m.source]));
    expect(byKey.get('nama_lengkap')).toBe('participant_input');
    expect(byKey.get('nomor_sertifikat')).toBe('document_number');
    expect(byKey.get('nama_kegiatan')).toBe('event_data');
    expect(byKey.get('nama_kepala_puskesmas')).toBe('static_value');
    expect(byKey.get('tanggal_terbit')).toBe('system_generated');
    expect(byKey.get('qr_code')).toBe('verification_qr');
  });
});

describe('Phase 4 — Dynamic Form Validation & ReDoS Guard', () => {
  const fields: FormField[] = [
    {
      id: '1',
      fieldKey: 'nama_lengkap',
      label: 'Nama Lengkap',
      inputType: 'text',
      source: 'participant_input',
      description: '',
      placeholder: '',
      required: true,
      unique: false,
      searchable: false,
      sensitive: false,
      options: [],
      defaultValue: '',
      minLength: 3,
      maxLength: 100,
      sortOrder: 0,
      isActive: true,
    },
    {
      id: '2',
      fieldKey: 'nik',
      label: 'NIK',
      inputType: 'nik',
      source: 'additional',
      description: '',
      placeholder: '',
      required: true,
      unique: true,
      searchable: true,
      sensitive: true,
      options: [],
      defaultValue: '',
      sortOrder: 1,
      isActive: true,
    },
    {
      id: '3',
      fieldKey: 'email',
      label: 'Email',
      inputType: 'email',
      source: 'additional',
      description: '',
      placeholder: '',
      required: false,
      unique: false,
      searchable: false,
      sensitive: true,
      options: [],
      defaultValue: '',
      sortOrder: 2,
      isActive: true,
    },
    {
      id: '4',
      fieldKey: 'peran',
      label: 'Peran',
      inputType: 'select',
      source: 'participant_input',
      description: '',
      placeholder: '',
      required: true,
      unique: false,
      searchable: false,
      sensitive: false,
      options: [
        { label: 'Peserta', value: 'peserta' },
        { label: 'Kader', value: 'kader' },
      ],
      defaultValue: '',
      sortOrder: 3,
      isActive: true,
    },
  ];

  it('validates NIK as 16-digit string, trims email, checks select options, and strips unknown fields', () => {
    const ok = validateDynamicSubmission(fields, {
      nama_lengkap: '  dr. Budi Santoso, M.Kes  ',
      nik: '3507000000000001',
      email: '  BUDI@Example.Test ',
      peran: 'kader',
      nomor_sertifikat: 'INJECTED-BY-USER',
    });

    expect(ok.valid).toBe(true);
    expect(ok.sanitized.nama_lengkap).toBe('dr. Budi Santoso, M.Kes');
    expect(ok.sanitized.nik).toBe('3507000000000001');
    expect(ok.sanitized.email).toBe('budi@example.test');
    expect(ok.sanitized.nomor_sertifikat).toBeUndefined();

    const bad = validateDynamicSubmission(fields, {
      nama_lengkap: 'AB',
      nik: '12345',
      email: 'bukan-email',
      peran: 'narasumber',
    });
    expect(bad.valid).toBe(false);
    expect(bad.errors.nama_lengkap).toBeTruthy();
    expect(bad.errors.nik).toBeTruthy();
    expect(bad.errors.email).toBeTruthy();
    expect(bad.errors.peran).toBeTruthy();
  });

  it('rejects nested-quantifier ReDoS regex patterns', () => {
    expect(isSafeAdminRegex('^[A-Z0-9-]{4,20}$')).toBe(true);
    expect(isSafeAdminRegex('(a+)+$')).toBe(false);
    expect(isSafeAdminRegex('([a-z]*)*')).toBe(false);
  });
});
