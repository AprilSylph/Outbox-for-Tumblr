browser.browserAction.onClicked.addListener(() => browser.tabs.create({ url: browser.runtime.getURL('/manage.html') }));

const handledRequests = [];

browser.webRequest.onBeforeRequest.addListener(({ method, url, requestBody, requestId, timeStamp }) => {
  if (handledRequests.includes(requestId)) {
    return;
  } else {
    handledRequests.push(requestId);
  }

  if (method !== 'POST') { return; }

  const { pathname } = new URL(url);
  const recipient = pathname.split('/')[4];

  const decoder = new TextDecoder();

  const rawData = requestBody.raw[0].bytes;
  const decodedData = decoder.decode(rawData);
  const parsedData = JSON.parse(decodedData);
  const { state, content, layout } = parsedData;

  if (state === 'ask' && Array.isArray(content)) {
    browser.storage.local.set({ [timeStamp]: { recipient, content, layout } });
  }
}, {
  urls: ['*://www.tumblr.com/api/v2/blog/*/posts'],
  types: ['xmlhttprequest']
}, [
  'requestBody'
]);