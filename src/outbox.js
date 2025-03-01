import { renderContent } from './lib/npf.js';

const anonymousAvatarSrc = 'data:image/png;base64,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';

const mainElement = document.querySelector('main');
const exportLink = document.getElementById('export');
const importInput = document.getElementById('import');

const timeFormat = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit'
});

const onDeleteButtonClicked = ({ currentTarget }) => {
  if (!window.confirm('Delete this copy of your sent message?\nThis cannot be undone!')) {
    return;
  }

  const articleElement = currentTarget.closest('article');
  const { timestamp } = articleElement.dataset;
  chrome.storage.local.remove(timestamp);
};

const constructItem = ([timestamp, { recipient, recipientUrl, error, content, layout }]) => {
  const articleElement = Object.assign(document.createElement('article'), { tabIndex: -1 });
  Object.assign(articleElement.dataset, { timestamp });

  const headerElement = document.createElement('header');
  articleElement.appendChild(headerElement);

  if (recipient || recipientUrl) {
    headerElement.appendChild(Object.assign(document.createElement('a'), {
      href: recipientUrl || `https://${recipient}.tumblr.com/`,
      target: '_blank',
      textContent: recipient || recipientUrl
    }));
  }

  if (error) {
    articleElement.append(Object.assign(document.createElement('section'), {
      className: 'error',
      textContent: 'This item could not be sent. You will need to retry manually.'
    }));
  }

  const bodyElement = Object.assign(document.createElement('section'), { className: 'body' });
  articleElement.appendChild(bodyElement);

  const { ask, content: renderedContent } = renderContent({ content, layout });

  if (ask) {
    const askWrapper = Object.assign(document.createElement('div'), { className: 'ask-wrapper' });
    const askElement = Object.assign(document.createElement('div'), { className: 'ask' });
    askWrapper.append(
      askElement,
      Object.assign(document.createElement('img'), {
        className: 'ask-avatar',
        src: ask.attribution?.blog
          ? `https://api.tumblr.com/v2/blog/${ask.attribution.blog.uuid}/avatar/40`
          : anonymousAvatarSrc
      })
    );
    askElement.append(ask.content);
    bodyElement.append(askWrapper);
  }

  bodyElement.append(renderedContent);

  const footerElement = document.createElement('footer');
  articleElement.appendChild(footerElement);

  const deleteButton = Object.assign(document.createElement('button'), { textContent: 'Delete' });
  deleteButton.addEventListener('click', onDeleteButtonClicked);

  const timestampDate = new Date(parseInt(timestamp));
  const timestampElement = Object.assign(document.createElement('span'), { textContent: timeFormat.format(timestampDate) });

  footerElement.append(timestampElement, deleteButton);

  return articleElement;
};

const updateExportDownload = () => {
  chrome.storage.local.get()
    .then(storageObject => {
      const storageKeys = Object.keys(storageObject);
      mainElement.dataset.showLimitWarning = storageKeys.length >= 512;
      return JSON.stringify(storageObject, null, 2);
    })
    .then(storageString => {
      const now = new Date();

      const fourDigitYear = now.getFullYear().toString().padStart(4, '0');
      const twoDigitMonth = (now.getMonth() + 1).toString().padStart(2, '0');
      const twoDigitDate = now.getDate().toString().padStart(2, '0');

      const dateString = `${fourDigitYear}-${twoDigitMonth}-${twoDigitDate}`;

      exportLink.href = `data:application/json,${encodeURIComponent(storageString)}`;
      exportLink.download = `Outbox Backup @ ${dateString}.json`;
    });
};

const onStorageChanged = (changes, areaName) => {
  if (areaName !== 'local') return;

  const changedKeys = Object.keys(changes);
  const deletedKeys = changedKeys.filter(key => changes[key].newValue === undefined);
  deletedKeys.forEach(deletedKey => mainElement.querySelector(`:scope > article[data-timestamp="${deletedKey}"]`)?.remove());

  const changedEntries = Object.entries(changes);

  const newEntries = changedEntries.filter(([key]) => changes[key].oldValue === undefined);
  const newItems = newEntries.map(([key, { newValue }]) => [key, newValue]).map(constructItem);
  newItems.forEach(newNode => {
    const newTimestamp = newNode.dataset.timestamp;
    const referenceNode = [...mainElement.children].find(({ dataset: { timestamp } }) => timestamp < newTimestamp);
    mainElement.insertBefore(newNode, referenceNode || null);
  });

  const modifiedEntries = changedEntries.filter(([key]) => changes[key].oldValue !== undefined && changes[key].newValue !== undefined);
  const modifiedItems = modifiedEntries.map(([key, { newValue }]) => [key, newValue]).map(constructItem);
  modifiedItems.forEach(newNode => {
    const oldNode = mainElement.querySelector(`:scope > article[data-timestamp="${newNode.dataset.timestamp}"]`);
    oldNode?.replaceWith(newNode);
  });

  updateExportDownload();
};

const onImportInputChanged = async ({ currentTarget }) => {
  try {
    const { files } = currentTarget;
    if (files.length === 0) return;

    const [importedBackup] = files;

    if (importedBackup.type !== 'application/json') {
      throw new Error('Invalid file type selected.');
    }

    const storageString = await importedBackup.text();
    const storageObject = JSON.parse(storageString);

    const keysAreValid = Object.keys(storageObject).every(key => isNaN(key) === false);
    const valuesAreValid = Object.values(storageObject).every(({ content, layout }) => Array.isArray(content) && Array.isArray(layout));

    if (!keysAreValid) throw new Error('Imported data contains invalid keys.');
    if (!valuesAreValid) throw new Error('Imported data contains invalid values.');

    await chrome.storage.local.set(storageObject);
  } catch (exception) {
    window.alert(exception.toString());
  } finally {
    currentTarget.value = currentTarget.defaultValue;
  }
};

chrome.storage.local.get()
  .then(storageObject => Object.entries(storageObject).sort(([a], [b]) => a - b).reverse())
  .then(items => mainElement.append(...items.map(constructItem)))
  .catch(exception => {
    console.error(exception);
    mainElement.append(...[
      Object.assign(document.createElement('p'), { textContent: 'Something went wrong.' }),
      Object.assign(document.createElement('pre'), { textContent: `${exception}` })
    ]);
  })
  .finally(() => mainElement.setAttribute('aria-busy', false));

chrome.storage.onChanged.addListener(onStorageChanged);
updateExportDownload();

importInput.addEventListener('change', onImportInputChanged);
