chrome.action.onClicked.addListener(() => chrome.runtime.openOptionsPage());

const handledRequests = new Map();

chrome.webRequest.onBeforeRequest.addListener(({ method, requestBody, requestId, timeStamp, url }) => {
  if (handledRequests.has(requestId)) {
    return;
  } else {
    handledRequests.set(requestId, timeStamp);
    chrome.storage.session.set({ [requestId]: timeStamp });
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
  const isPrivateAnswer = state === undefined && isPrivate === true && layout.some(({ type }) => type === 'ask');

  if (hasContent && (isAsk || isPrivateAnswer)) {
    chrome.storage.local.set({ [timeStamp]: { recipient, content, layout } });
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

chrome.webRequest.onBeforeRequest.addListener(({ method, requestBody, requestId, timeStamp }) => {
  if (handledRequests.has(requestId)) {
    return;
  } else {
    handledRequests.set(requestId, timeStamp);
    chrome.storage.session.set({ [requestId]: timeStamp });
  }

  if (method !== 'POST') { return; }

  const decoder = new TextDecoder();
  const rawData = requestBody.raw[0].bytes;
  const decodedData = decoder.decode(rawData);
  const parsedData = JSON.parse(decodedData);
  const { question, recipient } = parsedData;

  chrome.storage.local.set({
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

chrome.webRequest.onBeforeRequest.addListener(({ documentUrl, method, requestBody: { formData }, requestId, timeStamp, url }) => {
  if (handledRequests.has(requestId)) {
    return;
  } else {
    handledRequests.set(requestId, timeStamp);
    chrome.storage.session.set({ [requestId]: timeStamp });
  }

  if (method !== 'POST') { return; }

  let recipientUrl;

  if (documentUrl) {
    const addresseeUrl = Object.assign(new URL(documentUrl), { pathname: '/' });
    recipientUrl = addresseeUrl.toString();
  } else {
    const { protocol, pathname } = new URL(url);
    recipientUrl = `${protocol}//${pathname.replace('/ask_form/', '')}/`;
  }

  chrome.storage.local.set({
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

chrome.webRequest.onErrorOccurred.addListener(async ({ requestId }) => {
  const timeStamp =
    handledRequests.get(requestId) ??
    await chrome.storage.session.get(requestId).then(({ [requestId]: timeStamp }) => timeStamp);

  if (timeStamp) {
    const { [timeStamp]: item } = await chrome.storage.local.get(timeStamp.toString());
    item.error = true;
    chrome.storage.local.set({ [timeStamp]: item });
  }
}, {
  urls: [
    '*://www.tumblr.com/api/v2/blog/*/posts',
    '*://www.tumblr.com/api/v2/blog/*/posts/*',
    '*://www.tumblr.com/svc/post/ask',
    '*://www.tumblr.com/ask_form/*?t='
  ]
});

chrome.webRequest.onCompleted.addListener(async ({ requestId, statusCode }) => {
  const timeStamp =
    handledRequests.get(requestId) ??
    await chrome.storage.session.get(requestId).then(({ [requestId]: timeStamp }) => timeStamp);

  if (/[45]\d\d/.test(statusCode) && timeStamp) {
    const { [timeStamp]: item } = await chrome.storage.local.get(timeStamp.toString());
    item.error = true;
    chrome.storage.local.set({ [timeStamp]: item });
  }
}, {
  urls: [
    '*://www.tumblr.com/api/v2/blog/*/posts',
    '*://www.tumblr.com/api/v2/blog/*/posts/*',
    '*://www.tumblr.com/svc/post/ask',
    '*://www.tumblr.com/ask_form/*?t='
  ]
});

chrome.storage.onChanged.addListener(async (changes, areaName) => {
  const storageObject = await chrome.storage[areaName].get();
  const storageKeys = Object.keys(storageObject).sort((a, b) => a - b);
  const keysToRemove = storageKeys.splice(0, storageKeys.length - 512);

  if (keysToRemove.length > 0) chrome.storage[areaName].remove(keysToRemove);
});
