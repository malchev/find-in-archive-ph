const ARCHIVE_PH_URL = "https://archive.ph/";

function buildArchiveLookupUrl(pageUrl) {
  return `${ARCHIVE_PH_URL}${encodeURIComponent(pageUrl).replaceAll("%2F", "/")}`;
}

function isHttpUrl(pageUrl) {
  try {
    const { protocol } = new URL(pageUrl);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

chrome.action.onClicked.addListener((tab) => {
  const currentUrl = tab && tab.url;
  const archiveUrl = isHttpUrl(currentUrl)
    ? buildArchiveLookupUrl(currentUrl)
    : ARCHIVE_PH_URL;

  const createProperties = {
    active: true,
    url: archiveUrl
  };

  if (tab && typeof tab.index === "number") {
    createProperties.index = tab.index + 1;
  }

  if (tab && typeof tab.id === "number") {
    createProperties.openerTabId = tab.id;
  }

  chrome.tabs.create(createProperties);
});
