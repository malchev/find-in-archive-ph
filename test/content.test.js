const assert = require("node:assert/strict");
const test = require("node:test");

global.document = {
  location: {
    href: "https://archive.ph/fgc1o#selection-3027.0-3027.49"
  }
};

const {
  buildArchiveLookupUrl,
  extractOriginalUrlFromArchiveOutboundLink,
  handleArchiveOutboundLinkEvent,
  rewriteArchiveOutboundLink
} = require("../src/content.js");

function createAnchor(href, target = "") {
  const attributes = new Map();

  return {
    href,
    target,
    closest(selector) {
      return selector === "a[href]" ? this : null;
    },
    getAttribute(name) {
      if (name === "target") {
        return target;
      }

      return attributes.get(name) || null;
    },
    setAttribute(name, value) {
      attributes.set(name, value);
    }
  };
}

function createEvent(type, target, overrides = {}) {
  const event = {
    button: 0,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    target,
    type,
    defaultPrevented: false,
    propagationStopped: false,
    preventDefault() {
      this.defaultPrevented = true;
    },
    stopImmediatePropagation() {
      this.propagationStopped = true;
    },
    ...overrides
  };

  return event;
}

test("extracts original URL from archive.ph outbound link", () => {
  const originalUrl = "https://www.bloomberg.com/news/articles/2024-08-14/apple-pushes-ahead-with-tabletop-home-device-in-shift-to-robotics";
  const outboundUrl = `https://archive.ph/o/fgc1o/${originalUrl}`;

  assert.equal(
    extractOriginalUrlFromArchiveOutboundLink(outboundUrl, document.location.href),
    originalUrl
  );
});

test("preserves original URL query and hash from raw archive.ph outbound link", () => {
  assert.equal(
    extractOriginalUrlFromArchiveOutboundLink(
      "https://archive.ph/o/abc123/https://example.com/a/b?x=1#section",
      document.location.href
    ),
    "https://example.com/a/b?x=1#section"
  );
});

test("extracts original URL from encoded archive.ph outbound link", () => {
  assert.equal(
    extractOriginalUrlFromArchiveOutboundLink(
      "https://archive.ph/o/abc123/https%3A%2F%2Fexample.com%2Fa%2Fb%3Fx%3D1%23section",
      document.location.href
    ),
    "https://example.com/a/b?x=1#section"
  );
});

test("rewrites archive.ph outbound link to archive.ph exact URL lookup", () => {
  const anchor = {
    href: "https://archive.ph/o/fgc1o/https://www.bloomberg.com/news/articles/2024-08-14/apple-pushes-ahead-with-tabletop-home-device-in-shift-to-robotics"
  };

  assert.equal(rewriteArchiveOutboundLink(anchor), true);
  assert.equal(
    anchor.href,
    "https://archive.ph/https%3A//www.bloomberg.com/news/articles/2024-08-14/apple-pushes-ahead-with-tabletop-home-device-in-shift-to-robotics"
  );
});

test("intercepts rewritten target blank links and opens archive.ph lookup", () => {
  const anchor = createAnchor(
    "https://archive.ph/o/fgc1o/https://www.bloomberg.com/news/articles/2024-08-14/apple-pushes-ahead-with-tabletop-home-device-in-shift-to-robotics",
    "_blank"
  );
  const lookupUrl = "https://archive.ph/https%3A//www.bloomberg.com/news/articles/2024-08-14/apple-pushes-ahead-with-tabletop-home-device-in-shift-to-robotics";
  const pointerEvent = createEvent("pointerdown", anchor);
  const clickEvent = createEvent("click", anchor);
  const openedWindows = [];
  const browserWindow = {
    location: {
      href: ""
    },
    open(url, target) {
      openedWindows.push({ target, url });
    }
  };

  assert.equal(handleArchiveOutboundLinkEvent(pointerEvent, browserWindow), true);
  assert.equal(anchor.href, lookupUrl);
  assert.equal(pointerEvent.defaultPrevented, false);

  assert.equal(handleArchiveOutboundLinkEvent(clickEvent, browserWindow), true);
  assert.equal(clickEvent.defaultPrevented, true);
  assert.equal(clickEvent.propagationStopped, true);
  assert.deepEqual(openedWindows, [
    {
      target: "_blank",
      url: lookupUrl
    }
  ]);
  assert.equal(browserWindow.location.href, "");
});

test("intercepts regular clicks and navigates to archive.ph lookup", () => {
  const anchor = createAnchor("https://archive.ph/o/abc123/https://example.com/a/b");
  const clickEvent = createEvent("click", anchor);
  const assignedUrls = [];
  const browserWindow = {
    location: {
      assign(url) {
        assignedUrls.push(url);
      }
    },
    open() {
      throw new Error("regular click should not open a new window");
    }
  };

  assert.equal(handleArchiveOutboundLinkEvent(clickEvent, browserWindow), true);
  assert.equal(clickEvent.defaultPrevented, true);
  assert.equal(clickEvent.propagationStopped, true);
  assert.deepEqual(assignedUrls, [
    "https://archive.ph/https%3A//example.com/a/b"
  ]);
});

test("does not rewrite non-archive.ph outbound links", () => {
  const anchor = {
    href: "https://example.com/path"
  };

  assert.equal(rewriteArchiveOutboundLink(anchor), false);
  assert.equal(anchor.href, "https://example.com/path");
});

test("builds archive.ph lookup URLs consistently", () => {
  assert.equal(
    buildArchiveLookupUrl("https://example.com/a/b?x=1&y=two%20words"),
    "https://archive.ph/https%3A//example.com/a/b%3Fx%3D1%26y%3Dtwo%2520words"
  );
});
