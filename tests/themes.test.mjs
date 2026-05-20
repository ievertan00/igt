import test from 'node:test';
import assert from 'node:assert';
import { applyTheme, colors } from '../lib/cli/ui/index.mjs';
import ui from '../lib/cli/ui/index.mjs';
import { themes } from '../lib/cli/ui/themes.mjs';

test('applyTheme returns false for invalid inputs', () => {
  const result = applyTheme('nonexistent_theme');
  assert.strictEqual(result, false);
  
  const numResult = applyTheme(123);
  assert.strictEqual(numResult, false);
});

test('applyTheme correctly mutates colors properties, updates currentTheme, and returns true', () => {
  // Ensure we start with a known state
  applyTheme('auto');
  assert.strictEqual(ui.currentTheme, 'auto');
  assert.strictEqual(colors.cyan, themes.auto.cyan);

  // Apply 'dark' theme
  const resultDark = applyTheme('dark');
  assert.strictEqual(resultDark, true);
  
  // Check if currentTheme is updated
  assert.strictEqual(ui.currentTheme, 'dark');

  // Check if colors is mutated and matches dark theme colors
  assert.strictEqual(colors.cyan, themes.dark.cyan);
  assert.strictEqual(colors.yellow, themes.dark.yellow);

  // Apply 'light' theme
  const resultLight = applyTheme('light');
  assert.strictEqual(resultLight, true);

  // Check if currentTheme is updated
  assert.strictEqual(ui.currentTheme, 'light');

  // Check if colors is mutated and matches light theme colors
  assert.strictEqual(colors.cyan, themes.light.cyan);
  assert.strictEqual(colors.yellow, themes.light.yellow);

  // Clean up state
  applyTheme('auto');
});
