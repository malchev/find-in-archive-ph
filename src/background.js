const ARCHIVE_PH_URL = "https://archive.ph/";

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

chrome.action.onClicked.addListener((tab) => {
  const currentUrl = tab && tab.url;
  const archiveUrl = isHttpUrl(currentUrl)
    ? buildArchiveLookupUrl(currentUrl)
    : ARCHIVE_PH_URL;

  if (tab && typeof tab.id === "number") {
    const createProperties = {
      active: true,
      url: archiveUrl
    };

    if (typeof tab.index === "number") {
      createProperties.index = tab.index;
    }

    if (typeof tab.windowId === "number") {
      createProperties.windowId = tab.windowId;
    }

    chrome.tabs.create(createProperties, () => {
      chrome.tabs.remove(tab.id);
    });
    return;
  }

  chrome.tabs.create({ active: true, url: archiveUrl });
});
