import { renderContent } from './lib/npf.js';

const anonymousAvatarSrc40 = chrome.runtime.getURL('anonymous_40.webp');
const anonymousAvatarSrc96 = chrome.runtime.getURL('anonymous_96.webp');
const anonymousAvatarSrcSet = `${anonymousAvatarSrc40} 40w, ${anonymousAvatarSrc96} 96w`;

const fileInput = document.getElementById('file-input');
const mainElement = document.querySelector('main');
const exportLink = document.getElementById('export');
const importButton = document.getElementById('import');

const capacityDisplay = document.getElementById('capacity');
const quotaDisplay = document.getElementById('quota');
const versionDisplay = document.getElementById('version');

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

    /** @type {string?} */
    const avatarSrcSet = ask.attribution?.blog?.avatar
      ? ask.attribution.blog.avatar.toReversed().map(({ url, width }) => `${url} ${width}w`).join(', ')
      : null;

    askWrapper.append(
      askElement,
      Object.assign(document.createElement('img'), {
        className: 'ask-avatar',
        loading: 'lazy',
        sizes: '40px',
        ...(avatarSrcSet && {
          src: ask.attribution.blog.avatar[0].url,
          srcset: avatarSrcSet,
        }),
        ...(!avatarSrcSet && {
          src: anonymousAvatarSrc96,
          srcset: anonymousAvatarSrcSet,
        }),
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
  const timestampElement = Object.assign(document.createElement('time'), {
    dateTime: timestampDate.toISOString(),
    textContent: timeFormat.format(timestampDate),
  });

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

const updateInfoDisplay = () => chrome.storage.local.get().then(storageObject => {
  const storageUsed = Object.keys(storageObject).length;

  capacityDisplay.firstElementChild.style.backgroundColor = storageUsed < 512 ? 'var(--accent)' : 'var(--brand-orange)';
  capacityDisplay.firstElementChild.style.width = `${(storageUsed / 512) * 100}%`;

  quotaDisplay.replaceChildren(
    Object.assign(document.createElement('strong'), { textContent: `${storageUsed}` }),
    ' out of 512 items saved'
  );
});

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
  updateInfoDisplay();
};

const onImportButtonClicked = () => fileInput.showPicker();

const onFileInputChanged = async ({ currentTarget }) => {
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
updateInfoDisplay();

fileInput.addEventListener('change', onFileInputChanged);
importButton.addEventListener('click', onImportButtonClicked);
versionDisplay.textContent = `v${chrome.runtime.getManifest().version}`;
