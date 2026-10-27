const logicalCodes = new Map([
  ['ArrowUp', 'ArrowUp'], ['ArrowDown', 'ArrowDown'],
  ['ArrowLeft', 'ArrowLeft'], ['ArrowRight', 'ArrowRight'],
  [' ', 'Space'], ['Spacebar', 'Space'], ['Escape', 'Escape'],
  ['1', 'Digit1'], ['2', 'Digit2'], ['3', 'Digit3'], ['4', 'Digit4'],
  ['c', 'KeyC'], ['C', 'KeyC'],
]);
const physicalCodes = new Set(logicalCodes.values());

/** Embedded browsers may supply a logical key with an empty/unknown code. */
export function controlCode(event: Pick<KeyboardEvent, 'code' | 'key'>): string {
  return physicalCodes.has(event.code) ? event.code : logicalCodes.get(event.key) ?? '';
}
