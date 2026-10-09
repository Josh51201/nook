// "Move it on your Hearth" from the widget editor (CORE-076): the editor
// saves, goes back, and leaves this note so the Hearth opens straight into
// moving that widget with the arrows, where you can watch it go.
let pending: string | null = null;

export function requestMove(id: string) {
  pending = id;
}

// The waiting request, if any — taking it clears it.
export function takeMoveRequest(): string | null {
  const id = pending;
  pending = null;
  return id;
}
