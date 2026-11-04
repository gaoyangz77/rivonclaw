import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useMessageTranslation } from "./useMessageTranslation.js";
import { MessageTranslationPreview } from "../components/inputs/MessageTranslationPreview.js";
import i18n from "../i18n/index.js";
const state = vi.hoisted(() => ({
  translate: vi.fn(),
  send: vi.fn(),
  user: { userId: "owner", accountId: "owner" },
}));
vi.mock("../store/EntityStoreProvider.js", () => ({
  useEntityStore: () => ({
    currentUser: state.user,
    messageTranslation: { translate: state.translate },
  }),
}));
function View({ route = "one", draft = "你好", auto = false }: { route?: string; draft?: string; auto?: boolean }) {
  const controller = useMessageTranslation({
    routeKey: route,
    text: draft,
    draftFingerprint: () => draft,
    samples: [],
    signature: "",
    fallbackLanguage: "es",
    disabled: false,
    send: state.send,
  });
  return (
    <>
      <button onClick={() => void controller.generate({ autoSend: auto })}>Translate</button>
      <MessageTranslationPreview controller={controller} />
    </>
  );
}
beforeEach(async () => {
  await i18n.changeLanguage("zh");
  state.user = { userId: "owner", accountId: "owner" };
  state.translate.mockReset();
  state.send.mockReset();
});
describe("translation request lifetime", () => {
  it("ignores cancelled results and aborts the request", async () => {
    let finish!: (value: unknown) => void;
    state.translate.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    render(<View />);
    fireEvent.click(screen.getByText("Translate"));
    const signal = state.translate.mock.calls[0][0].signal;
    fireEvent.click(screen.getByRole("button", { name: "取消" }));
    expect(signal.aborted).toBe(true);
    await act(async () => finish({ language: "es", source: "site", text: "Hola" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(state.send).not.toHaveBeenCalled();
  });
  it.each(["route", "identity"])("ignores late results after %s switches", async (change) => {
    let finish!: (value: unknown) => void;
    state.translate.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const view = render(<View />);
    fireEvent.click(screen.getByText("Translate"));
    if (change === "identity") state.user = { userId: "member", accountId: "owner" };
    view.rerender(<View route={change === "route" ? "two" : "one"} />);
    await act(async () => finish({ language: "es", source: "site", text: "Hola" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(state.send).not.toHaveBeenCalled();
  });
  it("requires explicit confirmation, and does not dismiss during a send", async () => {
    state.translate.mockResolvedValue({ language: "es", source: "site", text: "Hola" });
    let finish!: (value: unknown) => void;
    state.send.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    render(<View />);
    fireEvent.click(screen.getByText("Translate"));
    await waitFor(() => expect(screen.getByDisplayValue("Hola")).toBeTruthy());
    expect(state.send).not.toHaveBeenCalled();
    const send = screen.getByRole("button", { name: "发送译文" });
    fireEvent.click(send);
    fireEvent.click(send);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(state.send).toHaveBeenCalledOnce();
    await act(async () => finish({ complete: true }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
  it("refuses a preview whose source draft changed outside the locked composer", async () => {
    state.translate.mockResolvedValue({ language: "es", source: "site", text: "Hola" });
    const view = render(<View />);
    fireEvent.click(screen.getByText("Translate"));
    await waitFor(() => expect(screen.getByDisplayValue("Hola")).toBeTruthy());
    view.rerender(<View draft="新草稿" />);
    fireEvent.click(screen.getByRole("button", { name: "发送译文" }));
    expect(state.send).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
describe("one-click send", () => {
  it("sends without a modal when the language came from messages", async () => {
    state.translate.mockResolvedValue({ language: "fr", source: "messages", text: "Bonjour" });
    state.send.mockResolvedValue({ complete: true });
    render(<View auto />);
    fireEvent.click(screen.getByText("Translate"));
    expect(screen.queryByRole("dialog")).toBeNull();
    await waitFor(() => expect(state.send).toHaveBeenCalledWith("Bonjour", false, "fr"));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
  it("opens the modal for a site-default language and does not send", async () => {
    state.translate.mockResolvedValue({ language: "es", source: "site", text: "Hola" });
    render(<View auto />);
    fireEvent.click(screen.getByText("Translate"));
    await waitFor(() => expect(screen.getByDisplayValue("Hola")).toBeTruthy());
    expect(state.send).not.toHaveBeenCalled();
  });
  it("opens the modal for the default flow even with a messages-based language", async () => {
    state.translate.mockResolvedValue({ language: "fr", source: "messages", text: "Bonjour" });
    render(<View />);
    fireEvent.click(screen.getByText("Translate"));
    await waitFor(() => expect(screen.getByDisplayValue("Bonjour")).toBeTruthy());
    expect(state.send).not.toHaveBeenCalled();
  });
  it("sends nothing when the draft changed while translating", async () => {
    let finish!: (value: unknown) => void;
    state.translate.mockImplementation(() => new Promise((resolve) => (finish = resolve)));
    const view = render(<View auto />);
    fireEvent.click(screen.getByText("Translate"));
    view.rerender(<View auto draft="新草稿" />);
    await act(async () => finish({ language: "fr", source: "messages", text: "Bonjour" }));
    expect(state.send).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
