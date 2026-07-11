const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

function loadBackgroundScript() {
  const source = fs.readFileSync(
    path.join(__dirname, "..", "src", "background.js"),
    "utf8"
  );
  const createdTabs = [];
  const removedTabs = [];
  let clickListener;

  const chrome = {
    action: {
      onClicked: {
        addListener(listener) {
          clickListener = listener;
        }
      }
    },
    tabs: {
      create(properties, callback) {
        createdTabs.push(properties);
        if (callback) {
          callback({ id: 99 });
        }
      },
      remove(tabId) {
        removedTabs.push(tabId);
      }
    }
  };

  const context = vm.createContext({
    chrome,
    encodeURIComponent,
    URL
  });

  vm.runInContext(source, context, { filename: "src/background.js" });

  assert.equal(typeof clickListener, "function");

  return {
    clickListener,
    createdTabs,
    removedTabs
  };
}

function asPlainValue(value) {
  return JSON.parse(JSON.stringify(value));
}

test("replaces the current tab with an archive.ph exact URL lookup", () => {
  const { clickListener, createdTabs, removedTabs } = loadBackgroundScript();

  clickListener({
    id: 42,
    index: 3,
    windowId: 5,
    url: "https://example.com/a/b?x=1&y=two%20words"
  });

  assert.deepEqual(asPlainValue(createdTabs), [
    {
      active: true,
      index: 3,
      windowId: 5,
      url: "https://archive.ph/https%3A//example.com/a/b"
    }
  ]);
  assert.deepEqual(removedTabs, [42]);
});

test("strips all query parameters before lookup", () => {
  const { clickListener, createdTabs, removedTabs } = loadBackgroundScript();

  clickListener({
    id: 42,
    index: 3,
    windowId: 5,
    url: "https://example.com/a?keep=1&redirect=https%3A%2F%2Ftarget.example%2Ffoo&also=http://other.example/path#frag"
  });

  assert.deepEqual(asPlainValue(createdTabs), [
    {
      active: true,
      index: 3,
      windowId: 5,
      url: "https://archive.ph/https%3A//example.com/a%23frag"
    }
  ]);
  assert.deepEqual(removedTabs, [42]);
});

test("strips tracking parameters from The Information URLs before lookup", () => {
  const { clickListener, createdTabs, removedTabs } = loadBackgroundScript();

  clickListener({
    id: 42,
    index: 3,
    windowId: 5,
    url: "https://www.theinformation.com/newsletters/ai-agenda/universities-fret-anthropic-openai-meta-deepmind-lure-professors?utm_campaign=article_email&utm_content=article-17441&utm_medium=email&utm_source=sg"
  });

  assert.deepEqual(asPlainValue(createdTabs), [
    {
      active: true,
      index: 3,
      windowId: 5,
      url: "https://archive.ph/https%3A//www.theinformation.com/newsletters/ai-agenda/universities-fret-anthropic-openai-meta-deepmind-lure-professors"
    }
  ]);
  assert.deepEqual(removedTabs, [42]);
});

test("replaces non-web Chrome pages with archive.ph homepage", () => {
  const { clickListener, createdTabs, removedTabs } = loadBackgroundScript();

  clickListener({
    id: 7,
    index: 0,
    windowId: 5,
    url: "chrome://extensions/"
  });

  assert.deepEqual(asPlainValue(createdTabs), [
    {
      active: true,
      index: 0,
      windowId: 5,
      url: "https://archive.ph/"
    }
  ]);
  assert.deepEqual(removedTabs, [7]);
});

test("opens archive.ph homepage when no tab is available", () => {
  const { clickListener, createdTabs, removedTabs } = loadBackgroundScript();

  clickListener();

  assert.deepEqual(asPlainValue(createdTabs), [
    {
      active: true,
      url: "https://archive.ph/"
    }
  ]);
  assert.deepEqual(removedTabs, []);
});
