# Assistant Markdown Rendering Design

## Goal

Render Markdown in assistant text messages while leaving user messages and
other agent message types unchanged.

## Architecture

Add a focused `MarkdownContent` component beside the agent message renderer.
It owns the `react-markdown` and `remark-gfm` assembly and imports its own
styles. `AgentMessageList` uses it only for assistant `text` content blocks
inside the existing borderless Bubble.

Raw HTML remains disabled through the default `react-markdown` behavior. GFM
adds tables, task lists, strikethrough, and autolinks without introducing an
HTML execution path.

## Theme

Markdown typography, links, blockquotes, inline code, code blocks, tables, and
horizontal rules use central `--app-*` CSS variables. New variables are defined
for both light and dark modes before the component consumes them.

## Testing

Component tests verify headings and GFM tables render as semantic HTML, raw
HTML is not executed, user Markdown stays plain text, and Markdown styles use
application theme variables.
