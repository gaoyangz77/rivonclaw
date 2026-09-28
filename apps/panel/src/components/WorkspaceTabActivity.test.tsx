import { useEffect, useState, useSyncExternalStore } from "react";
import { ApolloClient, ApolloLink, InMemoryCache, Observable, gql } from "@apollo/client";
import { ApolloProvider, useQuery } from "@apollo/client/react";
import { observable, runInAction } from "mobx";
import { observer } from "mobx-react-lite";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WorkspaceTabActivity } from "./WorkspaceTabActivity.js";

describe("WorkspaceTabActivity", () => {
  it("preserves local state while disconnecting inactive effects", async () => {
    const effectStarted = vi.fn();
    const effectStopped = vi.fn();

    function Probe() {
      const [count, setCount] = useState(0);
      useEffect(() => {
        effectStarted();
        return effectStopped;
      }, []);
      return <button onClick={() => setCount((value) => value + 1)}>count:{count}</button>;
    }

    const { rerender } = render(
      <WorkspaceTabActivity active>
        <Probe />
      </WorkspaceTabActivity>,
    );

    await waitFor(() => expect(effectStarted).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByRole("button").textContent).toBe("count:1");

    rerender(
      <WorkspaceTabActivity active={false}>
        <Probe />
      </WorkspaceTabActivity>,
    );
    await waitFor(() => expect(effectStopped).toHaveBeenCalledTimes(1));

    rerender(
      <WorkspaceTabActivity active>
        <Probe />
      </WorkspaceTabActivity>,
    );
    await waitFor(() => expect(effectStarted).toHaveBeenCalledTimes(2));
    expect(screen.getByRole("button").textContent).toBe("count:1");
  });

  it("unsubscribes inactive external stores and catches up when shown again", async () => {
    let value = 0;
    const listeners = new Set<() => void>();
    const subscribe = vi.fn((listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    });

    function Probe() {
      const snapshot = useSyncExternalStore(subscribe, () => value, () => value);
      return <span>snapshot:{snapshot}</span>;
    }

    const { rerender } = render(
      <WorkspaceTabActivity active>
        <Probe />
      </WorkspaceTabActivity>,
    );
    await waitFor(() => expect(listeners.size).toBe(1));

    rerender(
      <WorkspaceTabActivity active={false}>
        <Probe />
      </WorkspaceTabActivity>,
    );
    await waitFor(() => expect(listeners.size).toBe(0));

    value = 1;
    for (const listener of listeners) listener();

    rerender(
      <WorkspaceTabActivity active>
        <Probe />
      </WorkspaceTabActivity>,
    );
    await waitFor(() => expect(listeners.size).toBe(1));
    expect(screen.getByText("snapshot:1").textContent).toBe("snapshot:1");
  });

  it("stops MobX observer renders while inactive and catches up once visible", async () => {
    const store = observable({ value: 0 });
    const rendered = vi.fn();
    const Probe = observer(function Probe() {
      rendered(store.value);
      return <span>mobx:{store.value}</span>;
    });

    const { rerender } = render(
      <WorkspaceTabActivity active>
        <Probe />
      </WorkspaceTabActivity>,
    );
    await waitFor(() => expect(screen.getByText("mobx:0").textContent).toBe("mobx:0"));

    rerender(
      <WorkspaceTabActivity active={false}>
        <Probe />
      </WorkspaceTabActivity>,
    );
    await new Promise((resolve) => setTimeout(resolve, 20));
    const rendersAfterHide = rendered.mock.calls.length;
    act(() => {
      runInAction(() => {
        store.value = 1;
      });
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(rendered).toHaveBeenCalledTimes(rendersAfterHide);

    rerender(
      <WorkspaceTabActivity active>
        <Probe />
      </WorkspaceTabActivity>,
    );
    await waitFor(() => expect(screen.getByText("mobx:1").textContent).toBe("mobx:1"));
    expect(rendered.mock.calls.at(-1)).toEqual([1]);
  });

  it("stops Apollo polling while inactive and resumes it when visible", async () => {
    const query = gql`
      query ActivityPollingProbe {
        activityPollingProbe
      }
    `;
    let requests = 0;
    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link: new ApolloLink(
        () =>
          new Observable((observer) => {
            requests += 1;
            observer.next({ data: { activityPollingProbe: requests } });
            observer.complete();
          }),
      ),
    });

    function Probe() {
      useQuery(query, { fetchPolicy: "network-only", pollInterval: 25 });
      return null;
    }

    const renderTree = (active: boolean) => (
      <ApolloProvider client={client}>
        <WorkspaceTabActivity active={active}>
          <Probe />
        </WorkspaceTabActivity>
      </ApolloProvider>
    );
    const { rerender } = render(renderTree(true));
    await waitFor(() => expect(requests).toBeGreaterThanOrEqual(2));

    rerender(renderTree(false));
    await new Promise((resolve) => setTimeout(resolve, 75));
    const requestsAfterHide = requests;
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(requests).toBe(requestsAfterHide);

    rerender(renderTree(true));
    await waitFor(() => expect(requests).toBeGreaterThan(requestsAfterHide));
  });
});
