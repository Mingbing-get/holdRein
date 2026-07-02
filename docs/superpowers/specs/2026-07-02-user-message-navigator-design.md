# User Message Navigator Design

## Goal

Add a compact navigator to the vertical center of the chat workspace's right
edge. It represents every non-empty user message, previews messages on hover,
tracks the message currently being viewed, and jumps to a selected message.

## Scope

- Count messages whose role is `user` and whose displayed text is non-empty
  after trimming whitespace.
- Render one horizontal marker for each counted message.
- Keep the navigator centered in the visible message-scroll viewport rather
  than in the scrolling document.
- Do not change assistant, tool, approval, or sender behavior.

## Component Design

Create an independent `UserMessageNavigator` component under the chat module.
Its public props are the task messages and a ref to the chat scroll element.

The existing message list will expose a stable `data-message-id` anchor on
each visible user-message wrapper. The navigator will use those anchors for
measurement and scrolling. This avoids depending on Ant Design's private DOM
structure while keeping scroll tracking outside the message renderer.

The chat workspace will wrap the scroll area in a positioned container. The
scroll area and navigator will be siblings, allowing the navigator to remain
fixed within the viewport while message content scrolls underneath it.

## Interaction

The observation line is 60 pixels below the scroll container's top edge. The
active marker is the final user message whose top has crossed that line. Before
the first message crosses it, the first marker is active.

Markers use a short, subdued default style. The active marker is darker. A
hovered marker also becomes darker and expands horizontally with a short CSS
transition. Hovering opens an Ant Design `Popover` to the left containing the
full user-message text.

Clicking a marker smoothly scrolls the chat container so the selected message
starts 60 pixels below its top. The same calculation works regardless of the
container's position in the page:

`nextScrollTop = currentScrollTop + targetTop - containerTop - 60`

Programmatic navigation must not incorrectly change the existing follow-new-
messages preference.

## Styling And Accessibility

Add navigator marker colors to the central theme file for both light and dark
modes, using the `--app-*` namespace. Component CSS consumes only these
variables and does not branch on theme mode.

Each marker is a real button with an accessible label that includes its
one-based message number. Focus-visible styling makes keyboard navigation
discoverable. The popover is supplementary; the label and button action do not
depend on hover.

## Testing

Following test-driven development, add failing tests before implementation for:

- filtering empty and whitespace-only user messages;
- rendering one marker per eligible user message;
- selecting the marker associated with the 60-pixel observation line;
- updating the active marker on scroll;
- showing the matching message in the popover on hover;
- scrolling the target to the 60-pixel offset on click; and
- preserving the existing chat auto-follow behavior.

Run focused Vitest tests first, followed by the web package typecheck/build and
the relevant test suite.
