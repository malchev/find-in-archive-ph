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
      create(properties) {
        createdTabs.push(properties);
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
    createdTabs
  };
}

function asPlainValue(value) {
  return JSON.parse(JSON.stringify(value));
}

test("opens an archive.ph exact URL lookup beside the current tab", () => {
  const { clickListener, createdTabs } = loadBackgroundScript();

  clickListener({
    id: 42,
    index: 3,
    url: "https://example.com/a/b?x=1&y=two%20words"
  });

  assert.deepEqual(asPlainValue(createdTabs), [
    {
      active: true,
      index: 4,
      openerTabId: 42,
      url: "https://archive.ph/https%3A//example.com/a/b%3Fx%3D1%26y%3Dtwo%2520words"
    }
  ]);
});

test("opens archive.ph homepage for non-web Chrome pages", () => {
  const { clickListener, createdTabs } = loadBackgroundScript();

  clickListener({
    id: 7,
    index: 0,
    url: "chrome://extensions/"
  });

  assert.deepEqual(asPlainValue(createdTabs), [
    {
      active: true,
      index: 1,
      openerTabId: 7,
      url: "https://archive.ph/"
    }
  ]);
});

test("opens archive.ph homepage when no tab is available", () => {
  const { clickListener, createdTabs } = loadBackgroundScript();

  clickListener();

  assert.deepEqual(asPlainValue(createdTabs), [
    {
      active: true,
      url: "https://archive.ph/"
    }
  ]);
});
