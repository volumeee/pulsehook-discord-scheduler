import test from 'node:test';
import assert from 'node:assert/strict';
import { DISCORD_PAYLOAD_PRESETS, decimalToHexColor, hexToDecimalColor } from './discordTemplates';

test('converts hex and Discord integer embed colors accurately', () => {
  assert.equal(hexToDecimalColor('#5865F2'), 5793266);
  assert.equal(decimalToHexColor(5793266), '#5865F2');
  assert.equal(hexToDecimalColor('not-a-color'), 5793266);
  assert.equal(decimalToHexColor(undefined), '#5865F2');
});

test('ships valid Discord webhook payload presets with content or embeds', () => {
  assert.ok(DISCORD_PAYLOAD_PRESETS.length >= 3);
  for (const preset of DISCORD_PAYLOAD_PRESETS) {
    assert.ok(preset.label.length > 0);
    const hasContent = Boolean(preset.payload.content?.trim());
    const hasEmbeds = Boolean(preset.payload.embeds?.length);
    assert.equal(hasContent || hasEmbeds, true);
  }
});
