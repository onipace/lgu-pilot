// tests/unit/linaw-import-parser.test.ts
// Sprint 5 (S5-C3) — N013 bulk-import parsing suite (hermetic).
// JSON / CSV / dependency-free DOCX round-trip, per-record validation errors,
// tag normalization, and the 500-record parse (cap enforcement is the route's
// job — this suite asserts the parser handles exactly 500). node:test +
// node:assert/strict, relative imports only (no @/ alias).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_IMPORT_RECORDS,
  DocxParseError,
  extractDocxText,
  parseCsvRows,
  parseImportPayload,
} from '../../src/lib/linaw/import-parser';
import { buildMinimalDocx } from '../helpers/linaw-test-util';

test('linaw import parser suite', async (t) => {
  await t.test('JSON array happy path — 2 records, tags array preserved', () => {
    const payload = JSON.stringify([
      {
        ordinanceNumber: 1,
        seriesYear: 2020,
        title: 'An ordinance regulating tricycle fares',
        content: 'Section 1. Title.',
        subjectTags: ['transport', 'fares'],
      },
      {
        ordinanceNumber: 2,
        seriesYear: 2021,
        title: 'An ordinance fixing market fees',
        content: 'Section 1. Title. Market fees.',
        subjectTags: ['markets'],
      },
    ]);
    const { records, invalidRecords } = parseImportPayload({ text: payload });
    assert.equal(records.length, 2);
    assert.equal(invalidRecords.length, 0);
    assert.deepEqual(records[0].subjectTags, ['transport', 'fares']);
    assert.equal(records[1].ordinanceNumber, 2);
    assert.equal(records[1].seriesYear, 2021);
  });

  await t.test('JSON {records:[...]} envelope accepted', () => {
    const payload = JSON.stringify({
      records: [
        { ordinanceNumber: 3, seriesYear: 2019, title: 'An ordinance X', content: 'Body X.' },
      ],
    });
    const { records, invalidRecords } = parseImportPayload({ text: payload });
    assert.equal(records.length, 1);
    assert.equal(invalidRecords.length, 0);
    assert.equal(records[0].title, 'An ordinance X');
    assert.deepEqual(records[0].subjectTags, []);
  });

  await t.test('snake_case keys accepted', () => {
    const payload = JSON.stringify([
      {
        ordinance_number: '4',
        series_year: '2018',
        title: 'An ordinance in snake case',
        content: 'Body.',
        subject_tags: ['health'],
      },
    ]);
    const { records, invalidRecords } = parseImportPayload({ text: payload });
    assert.equal(invalidRecords.length, 0);
    assert.equal(records.length, 1);
    assert.equal(records[0].ordinanceNumber, 4);
    assert.equal(records[0].seriesYear, 2018);
    assert.deepEqual(records[0].subjectTags, ['health']);
  });

  await t.test('CSV: quoted comma + embedded newline + CRLF line endings', () => {
    const csv = [
      'ordinanceNumber,seriesYear,title,content,subjectTags',
      '5,2017,"An ordinance on permits, licenses","Section 1. Part A\r\nSection 2. Part B",permits',
    ].join('\r\n');
    const rows = parseCsvRows(csv);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].title, 'An ordinance on permits, licenses');
    assert.equal(rows[0].content, 'Section 1. Part A\r\nSection 2. Part B');

    const { records, invalidRecords } = parseImportPayload({ text: csv });
    assert.equal(invalidRecords.length, 0);
    assert.equal(records.length, 1);
    assert.equal(records[0].ordinanceNumber, 5);
    assert.deepEqual(records[0].subjectTags, ['permits']);
  });

  await t.test('CSV missing optional tags → []', () => {
    const csv = 'ordinanceNumber,seriesYear,title,content\n6,2016,An ordinance Y,Body Y.';
    const { records, invalidRecords } = parseImportPayload({ text: csv });
    assert.equal(invalidRecords.length, 0);
    assert.equal(records.length, 1);
    assert.deepEqual(records[0].subjectTags, []);
  });

  await t.test('tags given as ;-separated string', () => {
    const csv =
      'ordinanceNumber,seriesYear,title,content,subjectTags\n7,2015,An ordinance Z,Body Z.,"health; sanitation ;"';
    const { records, invalidRecords } = parseImportPayload({ text: csv });
    assert.equal(invalidRecords.length, 0);
    assert.deepEqual(records[0].subjectTags, ['health', 'sanitation']);
  });

  await t.test('per-record failures collected with correct indices; valid rows still parse', () => {
    const payload = JSON.stringify([
      { ordinanceNumber: 8, seriesYear: 2014, title: 'Valid row', content: 'Body.' },
      { ordinanceNumber: 0, seriesYear: 2014, title: 'Bad number', content: 'Body.' },
      { ordinanceNumber: 9, seriesYear: 2014, content: 'Missing title' },
      { ordinanceNumber: 10, seriesYear: 'abc', title: 'Bad year', content: 'Body.' },
      { ordinanceNumber: 11, seriesYear: 2013, title: 'Another valid', content: 'Body.' },
    ]);
    const { records, invalidRecords } = parseImportPayload({ text: payload });
    assert.equal(records.length, 2);
    assert.equal(records[0].ordinanceNumber, 8);
    assert.equal(records[1].ordinanceNumber, 11);
    assert.deepEqual(
      invalidRecords.map((r) => r.index),
      [1, 2, 3]
    );
    assert.match(invalidRecords[0].error, /record 1: ordinanceNumber must be a positive integer/);
    assert.match(invalidRecords[1].error, /record 2: title must be a non-empty string/);
    assert.match(invalidRecords[2].error, /record 3: seriesYear must be a positive integer/);
  });

  await t.test('DOCX round-trip — CSV-shaped text (escaping: & < > in title)', () => {
    const csv = [
      'ordinanceNumber,seriesYear,title,content,subjectTags',
      '12,2022,"An ordinance on signage & displays <main> gates","Body with & special <chars>.",signage',
    ].join('\n');
    const docx = buildMinimalDocx(csv);
    assert.equal(docx.readUInt32LE(0), 0x04034b50); // PK\x03\x04
    const { records, invalidRecords } = parseImportPayload({ docxBuffer: docx });
    assert.equal(invalidRecords.length, 0);
    assert.equal(records.length, 1);
    assert.equal(records[0].ordinanceNumber, 12);
    assert.equal(records[0].title, 'An ordinance on signage & displays <main> gates');
    assert.equal(records[0].content, 'Body with & special <chars>.');
  });

  await t.test('DOCX round-trip — JSON array text parses back to identical records', () => {
    const source = [
      {
        ordinanceNumber: 13,
        seriesYear: 2023,
        title: 'An ordinance with & ampersand and <angle> brackets',
        content: 'Section 1. Title. Content with > and < markers.',
        subjectTags: ['test'],
      },
      {
        ordinanceNumber: 14,
        seriesYear: 2024,
        title: 'Second record',
        content: 'Plain body.',
        subjectTags: [],
      },
    ];
    const docx = buildMinimalDocx(JSON.stringify(source));
    const { records, invalidRecords } = parseImportPayload({ docxBuffer: docx });
    assert.equal(invalidRecords.length, 0);
    assert.deepEqual(records, source.map((r) => ({ ...r })));
  });

  await t.test('extractDocxText throws DocxParseError on non-zip and on missing document.xml', () => {
    assert.throws(() => extractDocxText(Buffer.from('this is not a zip file')), DocxParseError);
    // A zip-shaped buffer with a PK signature but no word/document.xml entry.
    const noDoc = buildMinimalDocx('anything').subarray(0, 60);
    assert.throws(() => extractDocxText(noDoc), DocxParseError);
  });

  await t.test('500-record JSON array parses fully (cap is the route\'s job)', () => {
    const rows = Array.from({ length: 500 }, (_, i) => ({
      ordinanceNumber: i + 1,
      seriesYear: 2000 + (i % 25),
      title: `An ordinance ${i + 1}`,
      content: `Body ${i + 1}.`,
    }));
    const { records, invalidRecords } = parseImportPayload({ text: JSON.stringify(rows) });
    assert.equal(invalidRecords.length, 0);
    assert.equal(records.length, 500);
    assert.equal(MAX_IMPORT_RECORDS, 500);
  });
});
