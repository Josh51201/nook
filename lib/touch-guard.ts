// A checkbox inside a Hearth widget and the widget's own tap (which opens
// its editor) both see the same touch. The checkbox calls guardTouches() the
// moment it's pressed, and the Hearth ignores widget taps for a moment so
// ticking an item doesn't also open the editor.
let until = 0;

export function guardTouches(ms = 500) {
  until = Date.now() + ms;
}

export function touchesGuarded() {
  return Date.now() < until;
}
