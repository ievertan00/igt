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

  // Apply 'tokyo-night' theme
  const resultTokyo = applyTheme('tokyo-night');
  assert.strictEqual(resultTokyo, true);
  assert.strictEqual(ui.currentTheme, 'tokyo-night');
  assert.strictEqual(colors.cyan, themes['tokyo-night'].cyan);
  assert.strictEqual(colors.yellow, themes['tokyo-night'].yellow);

  // Apply 'catppuccin' theme
  const resultCat = applyTheme('catppuccin');
  assert.strictEqual(resultCat, true);
  assert.strictEqual(ui.currentTheme, 'catppuccin');
  assert.strictEqual(colors.cyan, themes.catppuccin.cyan);
  assert.strictEqual(colors.yellow, themes.catppuccin.yellow);

  // Apply 'gruvbox' theme
  const resultGruv = applyTheme('gruvbox');
  assert.strictEqual(resultGruv, true);
  assert.strictEqual(ui.currentTheme, 'gruvbox');
  assert.strictEqual(colors.cyan, themes.gruvbox.cyan);
  assert.strictEqual(colors.yellow, themes.gruvbox.yellow);

  // Apply 'nord-light' theme
  const resultNordLight = applyTheme('nord-light');
  assert.strictEqual(resultNordLight, true);
  assert.strictEqual(ui.currentTheme, 'nord-light');
  assert.strictEqual(colors.cyan, themes['nord-light'].cyan);
  assert.strictEqual(colors.yellow, themes['nord-light'].yellow);

  // Apply 'tokyo-night-light' theme
  const resultTokyoLight = applyTheme('tokyo-night-light');
  assert.strictEqual(resultTokyoLight, true);
  assert.strictEqual(ui.currentTheme, 'tokyo-night-light');
  assert.strictEqual(colors.cyan, themes['tokyo-night-light'].cyan);
  assert.strictEqual(colors.yellow, themes['tokyo-night-light'].yellow);

  // Apply 'catppuccin-latte' theme
  const resultLatte = applyTheme('catppuccin-latte');
  assert.strictEqual(resultLatte, true);
  assert.strictEqual(ui.currentTheme, 'catppuccin-latte');
  assert.strictEqual(colors.cyan, themes['catppuccin-latte'].cyan);
  assert.strictEqual(colors.yellow, themes['catppuccin-latte'].yellow);

  // Apply 'academic' theme
  const resultAcademic = applyTheme('academic');
  assert.strictEqual(resultAcademic, true);
  assert.strictEqual(ui.currentTheme, 'academic');
  assert.strictEqual(colors.cyan, themes.academic.cyan);
  assert.strictEqual(colors.yellow, themes.academic.yellow);

  // Clean up state
  applyTheme('auto');
});
