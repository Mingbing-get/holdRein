import type { WebPlugin } from "@hold-rein/plugin-web";
import { useEffect, useMemo, useRef } from "react";

export interface SenderSuggestionPopupProps {
  activeIndex: number;
  className?: string | undefined;
  groups: WebPlugin.SuggestionGroup[];
  onSelect: (value: string) => void;
}

export function SenderSuggestionPopup({
  activeIndex,
  className,
  groups,
  onSelect
}: SenderSuggestionPopupProps): React.ReactElement | null {
  const activeItemRef = useRef<HTMLButtonElement | null>(null);
  const selectableItems = useMemo(() => flattenSuggestionItems(groups), [groups]);

  useEffect(() => {
    activeItemRef.current?.scrollIntoView?.({
      block: "nearest"
    });
  }, [activeIndex, selectableItems]);

  if (!groups.length) return null;

  return (
    <div
      className={className}
      role="listbox"
      style={{
        background: "var(--app-color-bg-elevated)",
        border: "1px solid var(--app-color-border-secondary)",
        borderRadius: 16,
        bottom: "calc(100% + 8px)",
        boxShadow:
          "0 18px 36px color-mix(in srgb, var(--app-color-shadow) 32%, transparent)",
        left: 0,
        maxHeight: "60vh",
        overflowY: "auto",
        padding: 6,
        position: "absolute",
        right: 0,
        zIndex: 20
      }}
    >
      {groups.map((group, groupIndex) => (
        <div key={`${group.trigger}-${group.title ?? ""}-${groupIndex}`}>
          {group.title ? (
            <div
              data-suggestion-group-title="true"
              style={{
                color: "var(--app-color-text-tertiary)",
                fontSize: 11,
                fontWeight: 600,
                padding: "6px 10px 4px"
              }}
            >
              {group.title}
            </div>
          ) : null}
          <SuggestionItemList
            activeIndex={activeIndex}
            activeItemRef={activeItemRef}
            items={group.suggestions}
            selectableItems={selectableItems}
            onSelect={onSelect}
          />
        </div>
      ))}
    </div>
  );
}

interface SuggestionItemListProps {
  activeIndex: number;
  activeItemRef: React.MutableRefObject<HTMLButtonElement | null>;
  items: WebPlugin.SuggestionItem[];
  onSelect: (value: string) => void;
  selectableItems: WebPlugin.SuggestionItem[];
}

function SuggestionItemList({
  activeIndex,
  activeItemRef,
  items,
  onSelect,
  selectableItems
}: SuggestionItemListProps): React.ReactNode {
  return items.map((item) => {
    const itemIndex = selectableItems.findIndex(
      (selectableItem) => selectableItem === item
    );
    const active = itemIndex === activeIndex;

    return (
      <div key={item.value}>
        <button
          aria-selected={active}
          ref={active ? activeItemRef : undefined}
          role="option"
          style={{
            alignItems: "center",
            background: active
              ? "var(--app-color-fill-secondary)"
              : "transparent",
            border: 0,
            borderRadius: 10,
            color: "var(--app-color-text)",
            cursor: "pointer",
            display: "flex",
            font: "inherit",
            gap: 8,
            padding: "8px 10px",
            textAlign: "left",
            width: "100%"
          }}
          type="button"
          onClick={() => onSelect(item.value)}
          onMouseDown={(event) => event.preventDefault()}
        >
          {item.icon ? <span>{item.icon}</span> : null}
          <span style={{ flex: 1 }}>{item.label}</span>
          {item.extra ? (
            <span style={{ color: "var(--app-color-text-tertiary)" }}>
              {item.extra}
            </span>
          ) : null}
        </button>
        {item.children?.length ? (
          <div style={{ paddingLeft: 14 }}>
            <SuggestionItemList
              activeIndex={activeIndex}
              activeItemRef={activeItemRef}
              items={item.children}
              selectableItems={selectableItems}
              onSelect={onSelect}
            />
          </div>
        ) : null}
      </div>
    );
  });
}

export function flattenSuggestionItems(
  groups: WebPlugin.SuggestionGroup[]
): WebPlugin.SuggestionItem[] {
  return groups.flatMap((group) => flattenSuggestionItemList(group.suggestions));
}

function flattenSuggestionItemList(
  items: WebPlugin.SuggestionItem[]
): WebPlugin.SuggestionItem[] {
  return items.flatMap((item) => [
    item,
    ...flattenSuggestionItemList(item.children ?? [])
  ]);
}
