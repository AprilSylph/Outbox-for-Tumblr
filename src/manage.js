import { renderContent } from './lib/npf.js';

const mainElement = document.querySelector('main');

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
  articleElement.remove();

  browser.storage.local.remove(timestamp);
};

const constructItem = ([timestamp, { recipient, content, layout }]) => {
  const articleElement = document.createElement('article');
  Object.assign(articleElement.dataset, { timestamp });

  if (recipient) {
    const headerElement = document.createElement('header');
    articleElement.appendChild(headerElement);

    headerElement.appendChild(Object.assign(document.createElement('a'), {
      href: `https://${recipient}.tumblr.com/`,
      target: '_blank',
      textContent: recipient
    }));
  }

  const bodyElement = Object.assign(document.createElement('section'), { className: 'body' });
  articleElement.appendChild(bodyElement);

  const { ask, content: renderedContent } = renderContent({ content, layout });

  if (ask) {
    const askElement = Object.assign(document.createElement('div'), { className: 'ask' });
    bodyElement.appendChild(askElement);
    const { attribution } = ask;

    if (attribution) {
      const { blog } = attribution;
      askElement.appendChild(Object.assign(document.createElement('a'), {
        className: 'attribution',
        textContent: blog.name,
        href: blog.url,
        title: blog.title,
        target: '_blank'
      }));
    }

    askElement.append(...ask.content);
  }

  const footerElement = document.createElement('footer');
  articleElement.appendChild(footerElement);

  const deleteButton = Object.assign(document.createElement('button'), { textContent: 'Delete' });
  deleteButton.addEventListener('click', onDeleteButtonClicked);

  const timestampDate = new Date(parseInt(timestamp));
  const timestampElement = Object.assign(document.createElement('span'), { textContent: timeFormat.format(timestampDate) });

  footerElement.append(timestampElement, deleteButton);

  return articleElement;
};

browser.storage.local.get()
  .then(storageObject => Object.entries(storageObject).reverse())
  .then(items => items.map(constructItem).forEach(element => mainElement.appendChild(element)));
