import { Popover } from "antd";
import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";

import type { WebPlugin } from "@hold-rein/plugin-web";
import "./index.css";

const OBSERVATION_OFFSET_PX = 60;

interface UserMessageItem {
  id: string;
  text: string;
}

export interface UserMessageNavigatorProps {
  messages: WebPlugin.AgentMessage[];
  scrollContainerRef: RefObject<HTMLDivElement | null>;
}

export function UserMessageNavigator({
  messages,
  scrollContainerRef
}: UserMessageNavigatorProps) {
  const [cachedUserMessages, setCachedUserMessages] = useState<
    UserMessageItem[]
  >(() => getUserMessages(messages));
  const anchorByMessageIdRef = useRef(new Map<string, HTMLElement>());
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const nextUserMessages = getUserMessages(messages);

    setCachedUserMessages((currentUserMessages) =>
      areUserMessagesEqual(currentUserMessages, nextUserMessages)
        ? currentUserMessages
        : nextUserMessages
    );
  }, [messages]);

  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer || cachedUserMessages.length === 0) {
      anchorByMessageIdRef.current = new Map();
      setActiveIndex(0);
      return;
    }

    const messageIndexById = new Map(
      cachedUserMessages.map((message, index) => [message.id, index] as const)
    );
    const anchorByMessageId = collectMessageAnchors(
      scrollContainer,
      messageIndexById
    );
    anchorByMessageIdRef.current = anchorByMessageId;
    const updateActiveIndex = () => {
      setActiveIndex(
        getActiveIndexAtObservationLine(
          scrollContainer,
          cachedUserMessages,
          anchorByMessageId
        )
      );
    };

    const observer = new IntersectionObserver(
      updateActiveIndex,
      {
        root: scrollContainer,
        rootMargin: `-${OBSERVATION_OFFSET_PX}px 0px 0px 0px`,
        threshold: 0
      }
    );

    anchorByMessageId.forEach((anchor) => observer.observe(anchor));
    updateActiveIndex();
    return () => {
      observer.disconnect();
    };
  }, [cachedUserMessages, scrollContainerRef]);

  const scrollToMessage = useCallback(
    (messageId: string) => {
      const scrollContainer = scrollContainerRef.current;
      if (!scrollContainer) {
        return;
      }
      const anchor =
        anchorByMessageIdRef.current.get(messageId) ??
        findMessageAnchor(scrollContainer, messageId);
      if (!anchor) {
        return;
      }

      const top =
        scrollContainer.scrollTop +
        anchor.getBoundingClientRect().top -
        scrollContainer.getBoundingClientRect().top -
        OBSERVATION_OFFSET_PX;
      scrollContainer.scrollTo({ behavior: "smooth", top });
    },
    [scrollContainerRef]
  );

  if (cachedUserMessages.length === 0) {
    return null;
  }

  return (
    <nav aria-label="用户消息导航" className="user-message-navigator">
      {cachedUserMessages.map((message, index) => (
        <Popover content={message.text} key={message.id} placement="left">
          <button
            aria-current={index === activeIndex ? "true" : undefined}
            aria-label={`用户消息 ${index + 1}`}
            className="user-message-navigator__marker"
            type="button"
            onClick={() => scrollToMessage(message.id)}
          />
        </Popover>
      ))}
    </nav>
  );
}

function getUserMessages(
  messages: WebPlugin.AgentMessage[]
): UserMessageItem[] {
  return messages.flatMap((message) => {
    if (message.role !== "user") {
      return [];
    }
    const text = getText(message.content).trim();
    return text ? [{ id: message.id, text }] : [];
  });
}

function getText(content: string | { type: string; text?: string }[]): string {
  if (typeof content === "string") {
    return content;
  }
  return content
    .filter((block) => block.type === "text")
    .map((block) => block.text ?? "")
    .join("");
}

function areUserMessagesEqual(
  left: UserMessageItem[],
  right: UserMessageItem[]
): boolean {
  return (
    left.length === right.length &&
    left.every(
      (message, index) =>
        message.id === right[index]?.id && message.text === right[index]?.text
    )
  );
}

function findMessageAnchor(
  scrollContainer: HTMLDivElement,
  messageId: string
): HTMLElement | undefined {
  return Array.from(
    scrollContainer.querySelectorAll<HTMLElement>("[data-user-message-id]")
  ).find((element) => element.dataset.userMessageId === messageId);
}

function collectMessageAnchors(
  scrollContainer: HTMLDivElement,
  messageIndexById: Map<string, number>
): Map<string, HTMLElement> {
  const anchorByMessageId = new Map<string, HTMLElement>();

  scrollContainer
    .querySelectorAll<HTMLElement>("[data-user-message-id]")
    .forEach((element) => {
      const messageId = element.dataset.userMessageId;
      if (messageId && messageIndexById.has(messageId)) {
        anchorByMessageId.set(messageId, element);
      }
    });

  return anchorByMessageId;
}

function getActiveIndexAtObservationLine(
  scrollContainer: HTMLDivElement,
  userMessages: UserMessageItem[],
  anchorByMessageId: Map<string, HTMLElement>
): number {
  const observationTop =
    scrollContainer.getBoundingClientRect().top + OBSERVATION_OFFSET_PX;
  let activeIndex = 0;

  userMessages.forEach((message, index) => {
    const anchor = anchorByMessageId.get(message.id);
    if (anchor && anchor.getBoundingClientRect().top <= observationTop) {
      activeIndex = index;
    }
  });

  return activeIndex;
}
