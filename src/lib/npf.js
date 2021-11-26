/* npf.js by nightpool
 * https://gist.github.com/nightpool/2fd5c94ef222bf67f9ad58a7a739a26f
 *
 * Modified by April Sylph
 * https://gist.github.com/AprilSylph/667c158595418f5bc15b23c661f6a707
 * https://github.com/AprilSylph/Outbox-for-Tumblr/commits/main/src/lib/npf.js
 */

const keyBy = (array, input) => array.reduce((accumulator, currentValue) => Object.assign(accumulator, { [currentValue[input]]: currentValue }), {});
Object.prototype.tap = function (f) { f(this); return this; };

export const renderContent = ({ content: blocks, layout }) => {
  const { rows, ask } = keyBy(layout, 'type');
  const { truncate_after } = rows || {};

  const content = new DocumentFragment();
  const askContent = ask && new DocumentFragment();
  let details;

  const renderRow = ({ blocks: blockIndexes, mode }) => {
    const elements = blockIndexes.map(i => renderBlock(blocks[i]));

    if (elements.length !== 1) {
      return [document.createElement('div').tap(row => {
        row.dataset.row = mode ? mode.type : '';
        row.append(...elements);
      })];
    } else {
      return elements;
    }
  };

  if (askContent && ask.attribution) askContent.append(renderAttribution(ask.attribution));

  normalizeRows(rows, blocks).forEach(row => {
    if (ask && row.blocks.find(i => ask.blocks.includes(i)) !== undefined) {
      askContent.append(...renderRow(row));
    } else if (row.blocks.find(i => i > truncate_after) !== undefined) {
      details = details || document.createElement('details').tap(d => {
        d.dataset.condensed = '';
        d.append(document.createElement('summary').tap(s => { s.textContent = 'Keep reading'; }));
        content.append(d);
      });
      details.append(...renderRow(row));
    } else {
      content.append(...renderRow(row));
    }
  });

  [content, askContent]
    .filter(variable => variable instanceof Node)
    .forEach(node => {
      node.normalize();
      buildLists(node);
    });

  return {
    content,
    ask: askContent ? { content: askContent, ...ask } : undefined
  };
};

const normalizeRows = (rows, blocks) => {
  if (!rows) {
    return blocks.map((_, i) => ({ blocks: [i] }));
  } else if (!rows.display) {
    return rows.rows.map(indexes => ({ blocks: indexes }));
  } else {
    return rows.display;
  }
};

const blockRenderers = {
  text ({ text, subtype, formatting }) {
    const element = document.createElement(({
      heading1: 'h1',
      heading2: 'h2',
      indented: 'blockquote',
      'ordered-list-item': 'li',
      'unordered-list-item': 'li'
    })[subtype] || 'p');

    element.append(applyFormatting({ text, formatting }));

    return element;
  },

  image ({ media, attribution, alt_text, caption }) {
    return document.createElement('figure').tap(figure => {
      figure.append(document.createElement('img').tap(img => {
        alt_text && (img.alt = img.title = alt_text);
        img.src = media[0].url;
        img.srcset = media
          .filter(({ cropped }) => !cropped)
          .reverse()
          .map(({ url, width }) => `${url} ${width}w`)
          .join(',\n');
      }));

      if (attribution) figure.append(renderAttribution(attribution));
      if (caption) figure.append(Object.assign(document.createElement('figcaption'), { textContent: caption }));
    });
  },

  link ({ url, title, description, author, siteName, site_name = siteName, displayUrl, display_url = displayUrl, poster }) {
    return document.createElement('a').tap(a => {
      a.href = url;
      a.target = '_blank';

      const titleElement = document.createElement('h3');
      titleElement.textContent = title ?? site_name;

      if (poster !== undefined) {
        const posterElement = document.createElement('figure');
        posterElement.style.backgroundImage = `url(${poster[0].url})`;
        posterElement.append(titleElement);
        a.append(posterElement);
      } else {
        a.append(titleElement);
      }

      a.append(
        description ? Object.assign(document.createElement('p'), { textContent: description }) : '',
        Object.assign(document.createElement('small'), {
          textContent: author && site_name
            ? `${site_name} | ${author}`
            : title !== undefined && site_name
              ? site_name
              : display_url || url
        })
      );
    });
  },

  audio ({ url, media, title, artist, embedHtml, embed_html = embedHtml, attribution }) {
    const figure = document.createElement('figure');

    if (embed_html) {
      Object.assign(figure, { innerHTML: embed_html });
    } else if (media) {
      figure.append(Object.assign(document.createElement('audio'), {
        src: media.url,
        controls: true
      }));
    } else {
      figure.append(Object.assign(document.createElement('a'), {
        href: url,
        target: '_blank',
        textContent: `${title || 'Audio'}${artist ? ` by ${artist}` : ''}`
      }));
    }

    if (attribution) figure.append(renderAttribution(attribution));

    return figure;
  },

  video ({ url, media, embedHtml, embed_html = embedHtml, poster, attribution }) {
    const figure = document.createElement('figure');

    if (embed_html) {
      Object.assign(figure, { innerHTML: embed_html });
    } else if (media) {
      const video = Object.assign(document.createElement('video'), {
        src: media.url,
        controls: true,
        loop: true,
        muted: true
      });
      if (poster) Object.assign(video, { poster: poster[0].url });
      figure.append(video);
    } else {
      figure.append(Object.assign(document.createElement('a'), {
        href: url,
        target: '_blank',
        textContent: 'Video'
      }));
    }

    if (attribution) figure.append(renderAttribution(attribution));

    return figure;
  },

  paywall ({ title, text }) {
    return document.createElement('details').tap(details => details.append(
      Object.assign(document.createElement('summary'), { textContent: title }),
      Object.assign(document.createElement('p'), { textContent: text })
    ));
  }
};

const renderBlock = block => blockRenderers[block.type](block).tap(element => {
  element.dataset.block = block.type;
  if (block.subtype) element.dataset.subtype = block.subtype;
});

const applyFormatting = ({ text, formatting = [] }) => {
  if (!formatting.length) {
    return [text];
  }

  const tokens = [];
  const length = f => f.end - f.start;
  formatting.sort(ascendBy(length)).forEach(format => {
    tokens.unshift(['start', format.start, format]);
    tokens.push(['end', format.end, format]);
  });
  tokens.sort(ascendBy(([, index]) => index));

  const output = new DocumentFragment();
  let currentString = [...text];
  let currentStringOffset = 0;

  const elementStack = [output];
  const currentElement = () => elementStack[elementStack.length - 1];

  tokens.forEach(([tokenType, tokenIndex, tokenFormat]) => {
    const [beforeString, afterString] = splitArray(
      currentString,
      tokenIndex - currentStringOffset
    );
    currentString = afterString;
    currentStringOffset = tokenIndex;

    if (tokenType === 'start') {
      const newElement = renderFormatting(tokenFormat);
      newElement.format = tokenFormat;
      currentElement().append(beforeString.join(''), newElement);
      elementStack.push(newElement);
    } else if (tokenType === 'end') {
      currentElement().append(beforeString.join(''));

      const formattingsToReopen = [];
      let element;
      while (element = elementStack.pop()) {
        if (element.format === tokenFormat) {
          break;
        } else {
          formattingsToReopen.push(element.format);
        }
      }

      let format;
      while (format = formattingsToReopen.pop()) {
        const newElement = renderFormatting(format);
        newElement.format = format;
        currentElement().append(newElement);
        elementStack.push(newElement);
      }
    }
  });

  output.append(currentString.join(''));

  return output;
};

const formatRenderers = {
  bold: () => document.createElement('strong'),
  italic: () => document.createElement('em'),
  strikethrough: () => document.createElement('s'),
  small: () => document.createElement('small'),
  link: ({ url }) => Object.assign(document.createElement('a'), {
    href: /^https?:\/\/.+/.test(url) ? url : `https://${url}`,
    target: '_blank'
  }),
  mention: ({ blog: { url } }) => Object.assign(document.createElement('a'), {
    href: /^https?:\/\/.+/.test(url) ? url : `https://${url}/`,
    target: '_blank'
  }),
  color: ({ hex }) => Object.assign(document.createElement('font'), { color: hex }),
  default: () => document.createElement('span')
};

const renderFormatting = format =>
  (formatRenderers[format.type] || formatRenderers.default)(format);

const attributionRenderers = {
  post: ({ url, blog: { name, uuid } }) => document.createElement('a').tap(a => {
    Object.assign(a, { href: url, target: '_blank' });
    a.append(
      'Originally posted by ',
      Object.assign(document.createElement('strong'), { textContent: name || uuid })
    );
  }),

  link: ({ url }) => Object.assign(document.createElement('a'), {
    href: url,
    target: '_blank',
    textContent: url
  }),

  blog: ({ blog: { url, title, name, uuid } }) => document.createElement('p').tap(p => p.append(
    Object.assign(document.createElement('a'), {
      href: url,
      target: '_blank',
      title,
      textContent: name || uuid
    })
  )),

  app ({ url, appName, app_name = appName, displayText, display_text = displayText, logo }) {
    const a = Object.assign(document.createElement('a'), {
      href: url,
      target: '_blank',
      textContent: display_text
    });

    if (logo) {
      a.dataset.hasLogo = true;
      a.append(Object.assign(document.createElement('img'), { src: logo.url }));
    }

    return a;
  }
};

const renderAttribution = attribution => attributionRenderers[attribution.type](attribution).tap(element => {
  element.dataset.attribution = attribution.type;
});

const ascendBy = (...funcs) => (negativeFirstItem, postiveFirstItem) => {
  for (const func of funcs) {
    const negativeFirstValue = func(negativeFirstItem);
    const positiveFirstValue = func(postiveFirstItem);
    if (negativeFirstValue < positiveFirstValue) {
      return -1;
    } else if (positiveFirstValue < negativeFirstValue) {
      return 1;
    }
  }

  return 0;
};

const splitArray = (array, index) => [
  array.slice(0, index),
  array.slice(index)
];

const buildLists = rootNode => {
  const getNextStrayListItem = () =>
    [...rootNode.children].find(element => element.matches('li')) ||
    rootNode.querySelector(':not(ul):not(ol) > li');

  let listItem = getNextStrayListItem();
  while (listItem !== null) {
    const { parentNode } = listItem;
    const { subtype } = listItem.dataset;

    const listElement = document.createElement(subtype === 'ordered-list-item' ? 'ol' : 'ul');
    parentNode.insertBefore(listElement, listItem);
    while (listElement.nextElementSibling?.dataset.subtype === subtype) {
      listElement.append(listElement.nextElementSibling);
    }

    listItem = getNextStrayListItem();
  }
};
