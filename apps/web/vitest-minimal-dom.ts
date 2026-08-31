import type { Environment } from "vitest";

let currentDocument: Document | null = null;

function createElement(tagName: string) {
  const element = Object.create(HTMLElementStub.prototype) as Record<string, unknown> & {
    tagName: string;
    nodeType: number;
    children: unknown[];
    attributes: Record<string, string>;
    parentNode: unknown;
    ownerDocument: Document | null;
  };

  Object.assign(element, {
    tagName: tagName.toUpperCase(),
    nodeType: 1,
    children: [],
    attributes: {},
    style: {},
    classList: {
      add: () => {},
      remove: () => {},
      toggle: () => {},
      contains: () => false,
    },
    parentNode: null,
    ownerDocument: currentDocument,
    appendChild(child: unknown) {
      element.children.push(child);
      (child as { parentNode: unknown }).parentNode = element;
      return child;
    },
    removeChild(child: unknown) {
      element.children = element.children.filter((node) => node !== child);
      return child;
    },
    insertBefore(newNode: unknown) {
      element.children.unshift(newNode);
      return newNode;
    },
    replaceChildren(...nodes: unknown[]) {
      element.children = nodes;
      for (const node of nodes) {
        (node as { parentNode: unknown }).parentNode = element;
      }
    },
    setAttribute(name: string, value: string) {
      element.attributes[name] = value;
    },
    getAttribute(name: string) {
      return element.attributes[name] ?? null;
    },
    removeAttribute(name: string) {
      delete element.attributes[name];
    },
    hasAttribute(name: string) {
      return name in element.attributes;
    },
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => true,
    focus: () => {},
    blur: () => {},
    click: () => {},
    innerHTML: "",
    textContent: "",
    firstChild: null,
    lastChild: null,
    nextSibling: null,
    previousSibling: null,
    contains: () => false,
    cloneNode: () => createElement(tagName),
  });

  Object.defineProperty(element, "firstChild", {
    get() {
      return element.children[0] ?? null;
    },
  });

  return element;
}

class HTMLElementStub {
  focus() {}
  blur() {}
}
class HTMLInputElementStub extends HTMLElementStub {}
class HTMLTextAreaElementStub extends HTMLElementStub {}
class HTMLIFrameElementStub extends HTMLElementStub {}

function installMinimalDom() {
  const html = createElement("html");
  const head = createElement("head");
  const body = createElement("body");
  html.appendChild(head);
  html.appendChild(body);

  const document = {
    nodeType: 9,
    body,
    head,
    documentElement: html,
    createElement,
    createTextNode(text: string) {
      return { nodeType: 3, textContent: text, parentNode: null };
    },
    getElementById: () => null,
    getElementsByTagName(tagName: string) {
      if (tagName.toLowerCase() === "head") return [head];
      if (tagName.toLowerCase() === "body") return [body];
      return [];
    },
    querySelector: (selector: string) => {
      if (selector === "head") return head;
      if (selector === "body") return body;
      return null;
    },
    querySelectorAll: () => [],
    addEventListener: () => {},
    removeEventListener: () => {},
    defaultView: null as unknown,
    activeElement: body,
  } as unknown as Document;

  currentDocument = document;

  for (const node of [body, head, html]) {
    (node as { ownerDocument: Document }).ownerDocument = document;
  }

  const window = {
    document,
    navigator: { userAgent: "node" },
    HTMLElement: HTMLElementStub,
    HTMLInputElement: HTMLInputElementStub,
    HTMLTextAreaElement: HTMLTextAreaElementStub,
    HTMLIFrameElement: HTMLIFrameElementStub,
    Node: { ELEMENT_NODE: 1, TEXT_NODE: 3 },
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => true,
    requestAnimationFrame: (cb: FrameRequestCallback) => setTimeout(() => cb(Date.now()), 0),
    cancelAnimationFrame: (id: number) => clearTimeout(id),
    getComputedStyle: () => ({ getPropertyValue: () => "" }),
    Event: class Event {
      type: string;
      constructor(type: string) {
        this.type = type;
      }
    },
  };

  (document as { defaultView: unknown }).defaultView = window;

  globalThis.window = window as unknown as Window & typeof globalThis;
  globalThis.document = document;
  globalThis.HTMLElement = HTMLElementStub as unknown as typeof HTMLElement;
  globalThis.HTMLInputElement = HTMLInputElementStub as unknown as typeof HTMLInputElement;
  globalThis.HTMLTextAreaElement = HTMLTextAreaElementStub as unknown as typeof HTMLTextAreaElement;
  globalThis.HTMLIFrameElement = HTMLIFrameElementStub as unknown as typeof HTMLIFrameElement;
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: window.navigator,
  });
  globalThis.requestAnimationFrame = window.requestAnimationFrame;
  globalThis.cancelAnimationFrame = window.cancelAnimationFrame;
  globalThis.getComputedStyle = window.getComputedStyle as typeof getComputedStyle;
}

export default {
  name: "minimal-dom",
  transformMode: "web",
  viteEnvironment: "client",
  setup() {
    installMinimalDom();
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    return {
      teardown() {
        delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
        delete (globalThis as { window?: unknown }).window;
        delete (globalThis as { document?: unknown }).document;
      },
    };
  },
} satisfies Environment;
