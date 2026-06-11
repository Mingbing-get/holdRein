# Chat Auto Scroll Design

## Goal

Keep the active web chat pinned to its newest content unless the user has
manually scrolled away from the bottom. Returning to the bottom resumes
automatic scrolling, and opening a conversation always starts at the bottom.

## Ownership

`ChatWorkspace` owns the behavior because it owns the scrollable message
container. `AgentMessageList` remains responsible only for rendering messages.

## Behavior

- When the active task changes, the message container scrolls to the bottom.
- While automatic following is enabled, every rendered message-content update
  scrolls to the bottom, including streaming updates that grow an existing
  message.
- A trusted user scroll event updates whether automatic following is enabled.
- If the user is away from the bottom, new content does not change scroll
  position.
- If the user scrolls back to the bottom, automatic following resumes.
- Programmatic scroll events do not change the user's follow preference.

## Implementation

Render a bottom sentinel after `AgentMessageList` and call its
`scrollIntoView()` method when the active task or rendered messages change.
Track the follow state in a ref so scroll events do not cause unnecessary
renders. Determine whether the container is at the bottom using a small pixel
tolerance to account for browser rounding.

## Testing

Add focused `ChatWorkspace` tests that verify:

- first entering a task scrolls to the bottom;
- new message content scrolls while following;
- a trusted user scroll away from the bottom pauses scrolling;
- a trusted user scroll back to the bottom resumes scrolling;
- an untrusted/programmatic scroll does not pause following.
