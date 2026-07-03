import { Popover } from "antd";
import { useCallback, useEffect, useMemo, useState } from "react";
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
  const userMessages = useMemo(() => getUserMessages(messages), [messages]);
  const [activeIndex, setActiveIndex] = useState(0);

  const updateActiveIndex = useCallback(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer || userMessages.length === 0) {
      setActiveIndex(0);
      return;
    }

    const observationTop =
      scrollContainer.getBoundingClientRect().top + OBSERVATION_OFFSET_PX;
    let nextActiveIndex = 0;

    userMessages.forEach((message, index) => {
      const anchor = findMessageAnchor(scrollContainer, message.id);
      if (anchor && anchor.getBoundingClientRect().top <= observationTop) {
        nextActiveIndex = index;
      }
    });
    setActiveIndex(nextActiveIndex);
  }, [scrollContainerRef, userMessages]);

  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) {
      return;
    }

    updateActiveIndex();
    scrollContainer.addEventListener("scroll", updateActiveIndex);
    return () => {
      scrollContainer.removeEventListener("scroll", updateActiveIndex);
    };
  }, [scrollContainerRef, updateActiveIndex]);

  const scrollToMessage = useCallback(
    (messageId: string) => {
      const scrollContainer = scrollContainerRef.current;
      if (!scrollContainer) {
        return;
      }
      const anchor = findMessageAnchor(scrollContainer, messageId);
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

  if (userMessages.length === 0) {
    return null;
  }

  return (
    <nav aria-label="用户消息导航" className="user-message-navigator">
      {userMessages.map((message, index) => (
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

function findMessageAnchor(
  scrollContainer: HTMLDivElement,
  messageId: string
): HTMLElement | undefined {
  return Array.from(
    scrollContainer.querySelectorAll<HTMLElement>("[data-user-message-id]")
  ).find((element) => element.dataset.userMessageId === messageId);
}
