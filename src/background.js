browser.browserAction.onClicked.addListener(() => browser.runtime.openOptionsPage());

const handledRequests = [];

browser.webRequest.onBeforeRequest.addListener(({ method, requestBody, requestId, timeStamp, url }) => {
  if (handledRequests.includes(requestId)) {
    return;
  } else {
    handledRequests.push(requestId);
  }

  if (['POST', 'PUT'].includes(method) === false) { return; }

  const { pathname } = new URL(url);
  const addressee = pathname.split('/')[4];
  const recipient = addressee.startsWith('t:') ? null : addressee;

  const decoder = new TextDecoder();
  const rawData = requestBody.raw[0].bytes;
  const decodedData = decoder.decode(rawData);
  const parsedData = JSON.parse(decodedData);
  const { state, is_private: isPrivate, content, layout } = parsedData;

  const hasContent = Array.isArray(content);
  const isAsk = state === 'ask';
  const isPrivateAnswer = state === undefined && isPrivate === true && layout[0].type === 'ask';

  if (hasContent && (isAsk || isPrivateAnswer)) {
    browser.storage.local.set({ [timeStamp]: { recipient, content, layout } });
  }
}, {
  urls: [
    '*://www.tumblr.com/api/v2/blog/*/posts',
    '*://www.tumblr.com/api/v2/blog/*/posts/*'
  ],
  types: ['xmlhttprequest']
}, [
  'requestBody'
]);

browser.webRequest.onBeforeRequest.addListener(({ method, requestBody, requestId, timeStamp }) => {
  if (handledRequests.includes(requestId)) {
    return;
  } else {
    handledRequests.push(requestId);
  }

  if (method !== 'POST') { return; }

  const decoder = new TextDecoder();
  const rawData = requestBody.raw[0].bytes;
  const decodedData = decoder.decode(rawData);
  const parsedData = JSON.parse(decodedData);
  const { question, recipient } = parsedData;

  browser.storage.local.set({
    [timeStamp]: {
      recipient,
      content: [{ type: 'text', text: question, formatting: [] }],
      layout: [{ blocks: [0], type: 'ask' }]
    }
  });
}, {
  urls: ['*://www.tumblr.com/svc/post/ask'],
  types: ['xmlhttprequest']
}, [
  'requestBody'
]);

browser.webRequest.onBeforeRequest.addListener(({ documentUrl, method, requestBody: { formData }, requestId, timeStamp }) => {
  if (handledRequests.includes(requestId)) {
    return;
  } else {
    handledRequests.push(requestId);
  }

  if (method !== 'POST') { return; }

  const addresseeUrl = Object.assign(new URL(documentUrl), { pathname: '/' });
  const recipientUrl = addresseeUrl.toString();

  browser.storage.local.set({
    [timeStamp]: {
      recipientUrl,
      content: formData['post[one]'].map(text => ({ type: 'text', text, formatting: [] })),
      layout: [{ blocks: [0], type: 'ask' }]
    }
  });
}, {
  urls: ['*://www.tumblr.com/ask_form/*?t='],
  types: ['sub_frame']
}, [
  'requestBody'
]);

browser.storage.onChanged.addListener(async (changes, areaName) => {
  const storageObject = await browser.storage[areaName].get();
  const storageKeys = Object.keys(storageObject).sort((a, b) => a - b);
  const keysToRemove = storageKeys.splice(0, storageKeys.length - 512);

  if (keysToRemove.length > 0) browser.storage[areaName].remove(keysToRemove);
});
