(function () {
  const ARCHIVE_PH_URL = "https://archive.ph/";
  const ARCHIVE_HOSTNAME = "archive.ph";
  const LOOKUP_URL_ATTRIBUTE = "data-find-in-archive-ph-lookup-url";

  function buildArchiveLookupUrl(pageUrl) {
    const strippedUrl = stripUrlParameters(pageUrl);
    return `${ARCHIVE_PH_URL}${encodeURIComponent(strippedUrl).replaceAll("%2F", "/")}`;
  }

  function isHttpUrl(pageUrl) {
    try {
      const { protocol } = new URL(pageUrl);
      return protocol === "http:" || protocol === "https:";
    } catch {
      return false;
    }
  }

  function stripUrlParameters(pageUrl) {
    const url = new URL(pageUrl);

    if (!url.search) {
      return pageUrl;
    }

    url.search = "";
    return url.toString();
  }

  function storeLookupUrl(anchor, lookupUrl) {
    if (typeof anchor.setAttribute === "function") {
      anchor.setAttribute(LOOKUP_URL_ATTRIBUTE, lookupUrl);
    } else {
      anchor[LOOKUP_URL_ATTRIBUTE] = lookupUrl;
    }
  }

  function extractOriginalUrlFromArchiveOutboundLink(linkUrl, baseUrl) {
    try {
      const archiveUrl = new URL(linkUrl, baseUrl);
      if (archiveUrl.hostname !== ARCHIVE_HOSTNAME) {
        return null;
      }

      const match = archiveUrl.pathname.match(/^\/o\/[^/]+\/(.+)$/i);
      if (!match) {
        return null;
      }

      let originalUrl = match[1];
      if (/^https?%3A/i.test(originalUrl)) {
        originalUrl = decodeURIComponent(originalUrl);
      } else {
        originalUrl += archiveUrl.search + archiveUrl.hash;
      }

      return isHttpUrl(originalUrl) ? originalUrl : null;
    } catch {
      return null;
    }
  }

  function rewriteArchiveOutboundLink(anchor) {
    const originalUrl = extractOriginalUrlFromArchiveOutboundLink(
      anchor.href,
      document.location.href
    );

    if (!originalUrl) {
      return false;
    }

    const lookupUrl = buildArchiveLookupUrl(originalUrl);
    anchor.href = lookupUrl;
    storeLookupUrl(anchor, lookupUrl);
    return true;
  }

  function getClosestAnchor(target) {
    if (!target) {
      return null;
    }

    if (typeof target.closest === "function") {
      return target.closest("a[href]");
    }

    return target.href ? target : null;
  }

  function getAnchorTarget(anchor) {
    if (typeof anchor.getAttribute === "function") {
      return anchor.getAttribute("target") || "";
    }

    return anchor.target || "";
  }

  function shouldOpenInNewContext(event, anchor) {
    const target = getAnchorTarget(anchor).trim().toLowerCase();
    return event.type === "auxclick" ||
      event.button === 1 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      Boolean(target && target !== "_self");
  }

  function navigateToArchiveLookup(lookupUrl, event, anchor, browserWindow) {
    if (shouldOpenInNewContext(event, anchor)) {
      const target = getAnchorTarget(anchor) || "_blank";
      browserWindow.open(lookupUrl, target);
      return;
    }

    if (browserWindow.location && typeof browserWindow.location.assign === "function") {
      browserWindow.location.assign(lookupUrl);
      return;
    }

    browserWindow.location.href = lookupUrl;
  }

  function getStoredLookupUrl(anchor) {
    if (typeof anchor.getAttribute === "function") {
      return anchor.getAttribute(LOOKUP_URL_ATTRIBUTE);
    }

    return anchor[LOOKUP_URL_ATTRIBUTE] || null;
  }

  function getLookupUrlForAnchor(anchor) {
    const storedLookupUrl = getStoredLookupUrl(anchor);
    if (storedLookupUrl) {
      return storedLookupUrl;
    }

    const originalUrl = extractOriginalUrlFromArchiveOutboundLink(
      anchor.href,
      document.location.href
    );

    return originalUrl ? buildArchiveLookupUrl(originalUrl) : null;
  }

  function handleArchiveOutboundLinkEvent(event, browserWindow) {
    const anchor = getClosestAnchor(event.target);
    if (!anchor) {
      return false;
    }

    const lookupUrl = getLookupUrlForAnchor(anchor);
    if (!lookupUrl) {
      return false;
    }

    anchor.href = lookupUrl;
    storeLookupUrl(anchor, lookupUrl);

    if (event.type === "click" || event.type === "auxclick") {
      event.preventDefault();
      event.stopImmediatePropagation();
      navigateToArchiveLookup(lookupUrl, event, anchor, browserWindow || window);
    }

    return true;
  }

  function rewriteArchiveOutboundLinks(root) {
    let rewriteCount = 0;
    root.querySelectorAll("a[href]").forEach((anchor) => {
      if (rewriteArchiveOutboundLink(anchor)) {
        rewriteCount += 1;
      }
    });
    return rewriteCount;
  }

  function rewriteAddedNode(node) {
    if (node.nodeType !== Node.ELEMENT_NODE) {
      return;
    }

    if (node.matches("a[href]")) {
      rewriteArchiveOutboundLink(node);
    }

    rewriteArchiveOutboundLinks(node);
  }

  function run() {
    document.addEventListener("pointerdown", handleArchiveOutboundLinkEvent, true);
    document.addEventListener("mousedown", handleArchiveOutboundLinkEvent, true);
    document.addEventListener("contextmenu", handleArchiveOutboundLinkEvent, true);
    document.addEventListener("click", handleArchiveOutboundLinkEvent, true);
    document.addEventListener("auxclick", handleArchiveOutboundLinkEvent, true);

    let observer = null;

    function rewriteAndObserve() {
      rewriteArchiveOutboundLinks(document);

      if (observer || typeof MutationObserver === "undefined" || !document.documentElement) {
        return;
      }

      observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === "attributes") {
            rewriteArchiveOutboundLink(mutation.target);
            return;
          }

          mutation.addedNodes.forEach(rewriteAddedNode);
        });
      });

      observer.observe(document.documentElement, {
        attributeFilter: [
          "href"
        ],
        attributes: true,
        childList: true,
        subtree: true
      });
    }

    rewriteAndObserve();

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", rewriteAndObserve, { once: true });
    }
  }

  const api = {
    buildArchiveLookupUrl,
    extractOriginalUrlFromArchiveOutboundLink,
    handleArchiveOutboundLinkEvent,
    rewriteArchiveOutboundLink,
    rewriteArchiveOutboundLinks,
    stripUrlParameters
  };

  if (typeof module === "object" && module.exports) {
    module.exports = api;
    return;
  }

  run();
}());
