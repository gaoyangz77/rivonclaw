import { onSnapshot } from "mobx-state-tree";
import "./styles.css";
import { applyOAuthDocumentLanguage, detectOAuthLanguage, getOAuthCopy } from "./oauth-i18n";
import { OAuthPageState } from "./oauth-types";
import { OAuthCallbackStore, type OAuthCallbackStoreInstance } from "./oauth-store";

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("OAuth callback root is missing.");

const appRoot = app;
const language = detectOAuthLanguage();
const copy = getOAuthCopy(language);
applyOAuthDocumentLanguage(language);

const store = OAuthCallbackStore.create({
  pageState: OAuthPageState.IDLE,
  attempts: [],
  result: null,
  errorMessage: null,
});

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function pageCopy(state: OAuthCallbackStoreInstance): { eyebrow: string; title: string; body: string; tone: string } {
  if (state.pageState === OAuthPageState.READY) {
    return {
      eyebrow: copy.successEyebrow,
      title: copy.successTitle,
      body: copy.successBody,
      tone: "success",
    };
  }

  if (state.pageState === OAuthPageState.ERROR) {
    return {
      eyebrow: copy.errorEyebrow,
      title: copy.errorTitle,
      body: state.errorMessage ?? copy.errorBody,
      tone: "error",
    };
  }

  return {
    eyebrow: copy.loadingEyebrow,
    title: copy.loadingTitle,
    body: copy.loadingBody,
    tone: "waiting",
  };
}

function resultRows(state: OAuthCallbackStoreInstance): string {
  if (!state.result) return "";
  return `
    <div class="receipt-table">
      <div class="receipt-row">
        <span>${escapeHtml(copy.shop)}</span>
        <strong>${escapeHtml(state.result.shopName)}</strong>
      </div>
      <div class="receipt-row">
        <span>${escapeHtml(copy.platform)}</span>
        <strong>${escapeHtml(state.result.platform)}</strong>
      </div>
    </div>
  `;
}

function tryCloseCurrentTab(): void {
  window.open("", "_self")?.close();
  window.close();
}

function render(state: OAuthCallbackStoreInstance): void {
  const current = pageCopy(state);
  const busy = state.pageState === OAuthPageState.LOADING || state.pageState === OAuthPageState.IDLE;

  appRoot.innerHTML = `
    <section class="oauth-viewport">
      <a class="brand" href="/" aria-label="RivonClaw">
        <img src="/assets/LOGO_EN.png" alt="" />
      </a>

      <article class="oauth-panel oauth-panel-${current.tone}">
        <div class="status-mark ${busy ? "status-mark-loading" : ""}" aria-hidden="true">
          <span></span>
        </div>
        <p class="eyebrow">${escapeHtml(current.eyebrow)}</p>
        <h1>${escapeHtml(current.title)}</h1>
        <p class="summary">${escapeHtml(current.body)}</p>
        ${resultRows(state)}
        <div class="actions">
          <a class="primary-action" href="/">${escapeHtml(copy.returnHome)}</a>
          <button class="secondary-action" type="button" data-close>${escapeHtml(copy.closeTab)}</button>
        </div>
      </article>
    </section>
  `;

  appRoot.querySelector<HTMLButtonElement>("[data-close]")?.addEventListener("click", () => {
    tryCloseCurrentTab();
  });
}

function readParam(name: string): string | null {
  return new URLSearchParams(window.location.search).get(name);
}

onSnapshot(store, () => render(store));
render(store);
void store.complete(readParam("code"), readParam("state"), copy.missingParams);
