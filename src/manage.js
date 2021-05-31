const mainElement = document.querySelector('main');

const constructItem = ([timestamp, { recipient, content }]) => {
  const articleElement = document.createElement('article');

  const headerElement = document.createElement('header');
  articleElement.appendChild(headerElement);

  headerElement.appendChild(Object.assign(document.createElement('span'), { textContent: 'You asked ' }));
  headerElement.appendChild(Object.assign(document.createElement('a'), {
    href: `https://${recipient}.tumblr.com/`,
    target: '_blank',
    textContent: recipient
  }));
  headerElement.appendChild(Object.assign(document.createElement('span'), { textContent: ':' }));

  const bodyElement = Object.assign(document.createElement('section'), { className: 'body' });
  articleElement.appendChild(bodyElement);

  content.forEach(block => {
    const blockElement = document.createElement('div');
    bodyElement.appendChild(blockElement);

    switch (block.type) {
      case 'text':
        blockElement.appendChild(Object.assign(document.createElement('p'), { textContent: block.text }));
        break;
    }
  });

  const footerElement = document.createElement('footer');
  articleElement.appendChild(footerElement);

  return articleElement;
};

browser.storage.local.get()
  .then(storageObject => Object.entries(storageObject))
  .then(items => items.map(constructItem).forEach(element => mainElement.appendChild(element)));
