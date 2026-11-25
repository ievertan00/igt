import assert from 'node:assert/strict';
import { test } from 'node:test';
import { asText, markdownBody } from '../apps/web/src/LearningPresentation.ts';

test('learning fields preserve readable content without exposing arbitrary payloads', () => {
  assert.equal(asText('I bought a book.'), 'I bought a book.');
  assert.equal(asText(0), '0');
  assert.equal(asText(['Use the past tense.', 'Keep the article.']), 'Use the past tense.\nKeep the article.');
  assert.equal(asText('["Use the past tense.","Keep the article."]'), 'Use the past tense.\nKeep the article.');
  for (const value of [{ cardId: 7, feedback: 'internal' }, '{"cardId":7}', true, null, undefined, '[object Object]']) {
    assert.equal(asText(value), '');
  }
  assert.equal(asText(['Useful note', { internal: 'hidden' }]), 'Useful note');
});

test('machine references and Markdown metadata do not appear as learning content', () => {
  assert.equal(asText('grammar:0123456789abcdef0123456789abcdef'), '');
  assert.equal(asText('01234567-89ab-cdef-0123-456789abcdef'), '');
  const source = '---\r\nentryId: hidden\r\n---\r\n# My note\r\n<!-- internal -->\r\n**Entry ID**: hidden\r\n\r\nUse an article.';
  assert.equal(markdownBody(source).includes('hidden'), false);
  assert.equal(markdownBody(source).includes('internal'), false);
  assert.match(markdownBody(source), /# My note[\s\S]*Use an article\./);
});
