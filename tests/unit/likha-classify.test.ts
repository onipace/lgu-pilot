// tests/unit/likha-classify.test.ts
// Sprint 4 (S4-C3) — L007 classification prompt + parser unit tests (hermetic).
// No DB, no network, no @/ alias: relative imports + node:test only. The parser
// is asserted to NEVER throw, to filter labels to the D21 legal union, clamp
// confidence to [0,1], dedupe (first wins), and cap the result at 5.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CLASSIFICATION_SYSTEM_PROMPT,
  buildClassificationUserPrompt,
  parseClassificationResponse,
} from '../../src/lib/likha/prompts';
import {
  LIKHA_CLASSIFICATION_LABELS,
  LIKHA_CODE_TITLES,
  LIKHA_SUBJECTS,
} from '../../src/types/likha';

test('likha classification prompt + parser suite', async (t) => {
  await t.test('parses a clean strict-JSON bare array', () => {
    const input =
      '[{"label":"Title III - Taxation & Fiscal Affairs","confidence":0.88},' +
      '{"label":"Taxation & Revenue","confidence":0.73}]';
    const out = parseClassificationResponse(input);
    assert.equal(out.length, 2);
    assert.equal(out[0].label, 'Title III - Taxation & Fiscal Affairs');
    assert.equal(out[0].confidence, 0.88);
    assert.equal(out[1].label, 'Taxation & Revenue');
    assert.equal(out[1].confidence, 0.73);
  });

  await t.test('strips markdown fences + surrounding prose', () => {
    const arr =
      '[{"label":"Title III - Taxation & Fiscal Affairs","confidence":0.88},' +
      '{"label":"Taxation & Revenue","confidence":0.73}]';
    const input = 'Here you go:\n```json\n' + arr + '\n```\nHope that helps';
    const out = parseClassificationResponse(input);
    assert.equal(out.length, 2);
    assert.equal(out[0].label, 'Title III - Taxation & Fiscal Affairs');
    assert.equal(out[1].confidence, 0.73);
  });

  await t.test('clamps confidence to [0,1] and coerces numerics', () => {
    const input = JSON.stringify([
      { label: LIKHA_SUBJECTS[0], confidence: 1.7 },
      { label: LIKHA_SUBJECTS[1], confidence: -0.4 },
      { label: LIKHA_SUBJECTS[2], confidence: '0.5' },
      { label: LIKHA_SUBJECTS[3], confidence: null },
    ]);
    const out = parseClassificationResponse(input);
    assert.equal(out.length, 4);
    const byLabel = new Map(out.map((s) => [s.label, s.confidence]));
    assert.equal(byLabel.get(LIKHA_SUBJECTS[0]), 1);
    assert.equal(byLabel.get(LIKHA_SUBJECTS[1]), 0);
    assert.equal(byLabel.get(LIKHA_SUBJECTS[2]), 0.5);
    assert.equal(byLabel.get(LIKHA_SUBJECTS[3]), 0);
  });

  await t.test('filters labels outside the legal union (decision D21, exact match)', () => {
    const input = JSON.stringify([
      { label: 'Aerospace & Orbital Mechanics', confidence: 0.9 },
      { label: LIKHA_CODE_TITLES[0], confidence: 0.8 },
      { label: LIKHA_SUBJECTS[4], confidence: 0.7 },
      // Case-sensitive: lowercased legal label is NOT a match.
      { label: LIKHA_SUBJECTS[5].toLowerCase(), confidence: 0.65 },
    ]);
    const out = parseClassificationResponse(input);
    assert.equal(out.length, 2);
    assert.deepEqual(
      out.map((s) => s.label),
      [LIKHA_CODE_TITLES[0], LIKHA_SUBJECTS[4]]
    );
    for (const s of out) {
      assert.ok(
        LIKHA_CLASSIFICATION_LABELS.includes(s.label),
        `label in union: ${s.label}`
      );
    }
  });

  await t.test('never throws on garbage — returns []', () => {
    const garbage = ['', 'no json here', '{not an array}', 'null', '[{"label": 5}]'];
    for (const g of garbage) {
      let out: Array<{ label: string; confidence: number }> | undefined;
      assert.doesNotThrow(() => {
        out = parseClassificationResponse(g);
      });
      assert.deepEqual(out, [], `garbage ${JSON.stringify(g)} -> []`);
    }
  });

  await t.test('deduplicates by label — first occurrence wins', () => {
    const input = JSON.stringify([
      { label: LIKHA_SUBJECTS[0], confidence: 0.9 },
      { label: LIKHA_SUBJECTS[1], confidence: 0.8 },
      { label: LIKHA_SUBJECTS[0], confidence: 0.99 },
    ]);
    const out = parseClassificationResponse(input);
    assert.equal(out.length, 2);
    const first = out.find((s) => s.label === LIKHA_SUBJECTS[0]);
    assert.equal(first?.confidence, 0.9, 'first occurrence kept, not the 0.99 repeat');
  });

  await t.test('caps the result set at top-5 by confidence', () => {
    // 40 entries cycling the 25 legal labels. The first five entries carry the
    // five highest confidences on distinct labels; everything else is low.
    const entries: Array<{ label: string; confidence: number }> = [];
    for (let i = 0; i < 40; i += 1) {
      const label = LIKHA_CLASSIFICATION_LABELS[i % LIKHA_CLASSIFICATION_LABELS.length];
      const confidence = i < 5 ? 0.99 - i * 0.01 : 0.1 + (i % 10) * 0.01;
      entries.push({ label, confidence });
    }
    const out = parseClassificationResponse(JSON.stringify(entries));
    assert.ok(out.length <= 5, `at most 5, got ${out.length}`);
    assert.equal(out.length, 5);
    // Sorted by confidence descending.
    for (let i = 1; i < out.length; i += 1) {
      assert.ok(out[i - 1].confidence >= out[i].confidence, 'sorted desc');
    }
    assert.deepEqual(
      out.map((s) => s.label),
      [
        LIKHA_CLASSIFICATION_LABELS[0],
        LIKHA_CLASSIFICATION_LABELS[1],
        LIKHA_CLASSIFICATION_LABELS[2],
        LIKHA_CLASSIFICATION_LABELS[3],
        LIKHA_CLASSIFICATION_LABELS[4],
      ]
    );
  });

  await t.test('prompt builder contract', () => {
    const longText = 'x'.repeat(20_000);
    const user = buildClassificationUserPrompt(longText, 'An ordinance on market fees');
    assert.ok(user.includes('An ordinance on market fees'), 'includes the title');
    assert.ok(user.includes('x'.repeat(12_000)), 'carries truncated text');
    assert.ok(!user.includes('x'.repeat(12_001)), 'truncated to 12,000 chars');
    assert.ok(/json/i.test(user), 'mentions the strict-JSON requirement');

    // System prompt surfaces the taxonomy (>= 3 code titles + >= 3 subjects).
    let titleHits = 0;
    for (const title of LIKHA_CODE_TITLES) {
      if (CLASSIFICATION_SYSTEM_PROMPT.includes(title)) titleHits += 1;
    }
    let subjectHits = 0;
    for (const subject of LIKHA_SUBJECTS) {
      if (CLASSIFICATION_SYSTEM_PROMPT.includes(subject)) subjectHits += 1;
    }
    assert.ok(titleHits >= 3, `system prompt names >=3 code titles (got ${titleHits})`);
    assert.ok(subjectHits >= 3, `system prompt names >=3 subjects (got ${subjectHits})`);
    assert.ok(/json/i.test(CLASSIFICATION_SYSTEM_PROMPT), 'demands a JSON array');
  });
});
