import { renderContent } from './lib/npf.js';

const mainElement = document.querySelector('main');

const constructItem = ([timestamp, { recipient, content, layout }]) => {
  const articleElement = document.createElement('article');

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

  return articleElement;
};

browser.storage.local.get()
  .then(storageObject => Object.entries(storageObject).reverse())
  .then(items => items.map(constructItem).forEach(element => mainElement.appendChild(element)));
