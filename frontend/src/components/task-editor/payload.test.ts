import test from 'node:test';
import assert from 'node:assert/strict';
import { createPayloadDraft, INVALID_DISCORD_PAYLOAD, isRenderableDiscordPayload } from './payload';

test('accepts complete payloads without removing unrecognized Discord fields or extra embeds', () => {
  const payload: unknown = JSON.parse(
    '{"content":"hello","allowed_mentions":{"parse":[]},"embeds":[{"footer":{"text":"first","icon_url":"https://example.com/icon.png"}},{"title":"second"}]}'
  );
  assert.equal(isRenderableDiscordPayload(payload), true);
  assert.deepEqual(payload, {
    content: 'hello',
    allowed_mentions: { parse: [] },
    embeds: [
      { footer: { text: 'first', icon_url: 'https://example.com/icon.png' } },
      { title: 'second' },
    ],
  });
});

test('rejects JSON shapes that would crash the visual editor or preview', () => {
  for (const payload of [
    null,
    [],
    { content: 3 },
    { username: {} },
    { avatar_url: [] },
    { embeds: {} },
    { embeds: [null] },
    { embeds: [{ title: {} }] },
    { embeds: [{ footer: { text: {} } }] },
    { embeds: [{ fields: {} }] },
    { embeds: [{ footer: {} }] },
    { embeds: [{ fields: [{}] }] },
    { embeds: [{ fields: [null] }] },
    { embeds: [{ fields: [{ name: {} }] }] },
  ]) {
    assert.equal(isRenderableDiscordPayload(payload), false);
  }
});

test('keeps an invalid saved payload in the JSON draft without rendering unsafe fields', () => {
  const savedPayload = { content: { text: 'broken' }, allowed_mentions: { parse: [] } };
  const draft = createPayloadDraft(savedPayload);

  assert.deepEqual(JSON.parse(draft.rawJson), savedPayload);
  assert.deepEqual(draft.payload, {});
  assert.equal(draft.jsonError, INVALID_DISCORD_PAYLOAD);
});
