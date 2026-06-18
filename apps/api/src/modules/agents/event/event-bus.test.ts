import { describe, expect, it, vi } from "vitest";

import { createAgentEventBus } from "./event-bus";

describe("agent event bus", () => {
  it("replays existing events and sends new events to active subscribers", () => {
    const bus = createAgentEventBus();

    bus.emit({ agentId: "agent-1", type: "agent_start" });

    const listener = vi.fn();
    const subscription = bus.subscribe({ agentId: "agent-1" }, listener);
    bus.emit({ agentId: "agent-1", payload: { delta: "hello" }, type: "message_update" });

    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        agentId: "agent-1",
        sequence: 1,
        type: "agent_start"
      })
    );
    expect(listener.mock.calls[1]?.[0]).toEqual(
      expect.objectContaining({
        payload: { delta: "hello" },
        sequence: 2,
        type: "message_update"
      })
    );

    subscription.unsubscribe();
    bus.emit({ agentId: "agent-1", type: "agent_end" });

    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("replays only events after the requested sequence", () => {
    const bus = createAgentEventBus();

    bus.emit({ agentId: "agent-1", type: "agent_start" });
    bus.emit({ agentId: "agent-1", type: "message_update" });
    bus.emit({ agentId: "agent-1", type: "turn_end" });

    const listener = vi.fn();
    bus.subscribe({ afterSequence: 1, agentId: "agent-1" }, listener);

    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener.mock.calls.map((call) => call[0].sequence)).toEqual([2, 3]);
  });
});
