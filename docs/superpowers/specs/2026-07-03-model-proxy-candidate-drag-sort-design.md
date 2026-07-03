# Model Proxy Candidate Drag Sort Design

## Goal

Allow users to reorder model proxy candidates by dragging a dedicated handle. The visible candidate number and submitted priority must follow the new order.

## Interaction

- Show a drag handle beside each candidate title.
- Only the handle starts a drag, so form controls remain safe to interact with.
- Use the complete candidate card as the native drag preview.
- A candidate card accepts the dragged item as a drop target and shows a border-based drop cue using existing `--app-*` theme variables.
- Auto-scroll the modal form when the pointer enters the top or bottom 48-pixel edge zone. Scrolling accelerates as the pointer approaches or crosses the edge.
- Dropping on the same candidate or outside the candidate list leaves the order unchanged.

## Implementation

Use native HTML drag events and Ant Design `Form.List`'s existing `move(from, to)` operation. Store only the active source index and current target index in component state. On drop, call `move`, then clear transient drag state.

At drag start, pass the candidate card to `dataTransfer.setDragImage`. While a candidate is active, a document-level drag-over listener calculates scroll speed from the pointer position relative to the modal form's scroll container. A `requestAnimationFrame` loop applies the speed continuously and is cancelled on drop, drag end, modal close, or unmount.

The form array remains the single source of truth. Existing submission code already derives `priority` from array position, so no API or payload changes are needed.

## Testing

Add a component test with two distinct candidate values. Simulate dragging the second handle onto the first card, verify the visible field order changes, submit the form, and assert that priorities follow the reordered values.

Also verify that drag start configures the complete card as the drag image, that top and bottom edge positions scroll in the expected direction, and that drag end cancels pending animation.

Run the focused Vitest file, TypeScript checking, and ESLint for the modified files.
