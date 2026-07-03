const ARCHIVE_PH_URL = "https://archive.ph/";

function buildArchiveLookupUrl(pageUrl) {
  const strippedUrl = stripUrlParameterValues(pageUrl);
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

function containsHttpUrl(value) {
  return /https?:\/\/\S+/i.test(value);
}

function stripUrlParameterValues(pageUrl) {
  const url = new URL(pageUrl);
  const strippedParams = new URLSearchParams();
  let strippedAnyParam = false;

  url.searchParams.forEach((value, name) => {
    if (containsHttpUrl(value)) {
      strippedAnyParam = true;
      return;
    }

    strippedParams.append(name, value);
  });

  if (!strippedAnyParam) {
    return pageUrl;
  }

  url.search = strippedParams.toString();
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
