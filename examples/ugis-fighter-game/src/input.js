import { useEffect, useRef } from 'react';

const PREVENT_DEFAULT = new Set([
  'KeyW', 'KeyA', 'KeyS', 'KeyD',
  'KeyJ', 'KeyK', 'KeyL', 'KeyU', 'KeyI', 'KeyO', 'KeyF',
  'Space', 'ShiftLeft', 'ShiftRight',
]);

export function useKeyboardInput() {
  const inputRef = useRef({ down: new Set(), pressed: new Set() });

  useEffect(() => {
    const onDown = event => {
      if (PREVENT_DEFAULT.has(event.code)) event.preventDefault();
      const state = inputRef.current;
      if (!state.down.has(event.code)) state.pressed.add(event.code);
      state.down.add(event.code);
    };
    const onUp = event => {
      if (PREVENT_DEFAULT.has(event.code)) event.preventDefault();
      inputRef.current.down.delete(event.code);
    };
    const onBlur = () => {
      inputRef.current.down.clear();
      inputRef.current.pressed.clear();
    };

    window.addEventListener('keydown', onDown, { passive: false });
    window.addEventListener('keyup', onUp, { passive: false });
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  return inputRef;
}

export function consumePressed(inputRef, code) {
  const pressed = inputRef.current.pressed;
  if (!pressed.has(code)) return false;
  pressed.delete(code);
  return true;
}

export function isDown(inputRef, code) {
  return inputRef.current.down.has(code);
}
