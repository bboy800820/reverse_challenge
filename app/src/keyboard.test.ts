import { expect, it } from 'vitest';
import { controlCode } from './keyboard';

it.each([
  ['', 'ArrowDown', 'ArrowDown'],
  ['', ' ', 'Space'],
  ['Unidentified', 'ArrowDown', 'ArrowDown'],
  ['Unidentified', ' ', 'Space'],
  ['Numpad2', 'ArrowDown', 'ArrowDown'],
  ['', '4', 'Digit4'],
  ['', 'C', 'KeyC'],
  ['ArrowDown', 'Unidentified', 'ArrowDown'],
  ['Space', 'Unidentified', 'Space'],
  ['KeyQ', 'q', ''],
])('recognizes control with code=%s, key=%s', (code, key, expected) => {
  expect(controlCode({ code, key })).toBe(expected);
});
