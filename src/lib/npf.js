const keyBy = (array, input) => array.reduce((accumulator, currentValue) => Object.assign(accumulator, { [currentValue[input]]: currentValue }), {});
Object.prototype.tap = function(f) { f(this); return this; };

export const renderContent = ({ content: blocks, layout }) => {
  const content = [];
  const { rows, ask } = keyBy(layout, 'type');
  const { truncate_after } = rows || {};

  let askContent, details;

  const renderRow = ({ blocks: blockIndexes, mode }) => {
    const elements = blockIndexes.map(i => renderBlock(blocks[i]));

    if (elements.length !== 1) {
      return [document.createElement('div').tap(row => {
        row.className = `row ${mode ? mode.type : ''}`.trim();
        row.append(...elements);
      })];
    } else {
      return elements;
    }
  };

  normalizeRows(rows, blocks).forEach(row => {
    if (ask && row.blocks.find(i => ask.blocks.includes(i)) !== undefined) {
      askContent = askContent || [];
      askContent.push(...renderRow(row));
    } else if (row.blocks.find(i => i > truncate_after) !== undefined) {
      details = details || document.createElement('details').tap(d => {
        d.append(document.createElement('summary').tap(s => s.textContent = 'Keep reading'));
        content.push(d);
      });
      details.append(...renderRow(row));
    } else {
      content.push(...renderRow(row));
    }
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
  text ({ subtype, text, formatting }) {
    const element = document.createElement(({
      heading1: 'h1',
      heading2: 'h2',
      indented: 'blockquote',
      'ordered-list-item': 'li',
      'unordered-list-item': 'li'
    })[subtype] || 'p');

    const className = {
      quirky: 'npf_quirky',
      quote: 'npf_quote',
      chat: 'npf_chat'
    }[subtype];

    if (subtype === 'ordered-list-item') element.dataset.ordered = true;
    if (subtype === 'unordered-list-item') element.dataset.ordered = false;

    if (className !== undefined) Object.assign(element, { className });
    element.append(...applyFormatting({ text, formatting }));

    return element;
  },

  image ({ attribution, alt_text, media }) {
    return document.createElement('figure').tap(figure => {
      figure.append(document.createElement('img').tap(img => {
        alt_text && (img.alt = img.title = alt_text);
        img.srcset = media.filter(m => !m.cropped)
          .map(m => `${m.url} ${m.width}w`).join(',\n');
        const [largestWidthMedia] = media.sort(descendBy(i => i.width));
        img.src = largestWidthMedia.url;
      }));
      if (attribution?.url) {
        figure.append(document.createElement('a').tap(a => {
          a.href = attribution.url;
          a.target = '_blank';

          if (attribution.display_text) {
            a.textContent = attribution.display_text;
          } else if (attribution.blog?.name) {
            a.className = 'gif-attribution';
            a.textContent = 'GIF by ';
            a.append(Object.assign(document.createElement('strong'), { textContent: attribution.blog.name }));
          } else {
            a.textContent = attribution.url;
          }
        }));
      }
    });
  },

  link ({ url, title, description }) {
    return document.createElement('a').tap(a => {
      a.href = url;
      a.target = '_blank';
      a.style.display = 'block';
      a.style.border = '1px dashed';
      a.style.padding = '0.5em';
      a.append(document.createElement('h3').tap(h => {
        h.append(title);
        h.style.margin = '0 0 0.5em';
      }));
      a.append(description);
    });
  },

  audio ({ media, provider, embed_html, url, title, artist }) {
    if (media && provider === 'tumblr') {
      return document.createElement('audio').tap(audio => {
        audio.src = media.url;
        audio.controls = true;
        audio.style.width = '100%';
      });
    } else if (media && provider === 'bandcamp') {
      const embed_params = {
        size: 'medium',
        bgcol: 'ffffff',
        linkcol: '0687f5',
        notracklist: 'true',
        transparent: 'true',
        track: /track_id=(\d+)/.exec(media.url)[1]
      };

      return document.createElement('iframe').tap(iframe => {
        iframe.src = `https://bandcamp.com/EmbeddedPlayer/${
          Object.entries(embed_params).map(p => p.join('=')).join('/')
        }/`;
        iframe.width = '100%';
        iframe.height = '120';
        iframe.frameborder = '0';
        iframe.allowtransparency = true;
        iframe.append(document.createElement('a').tap(link => {
          link.href = url;
          link.target = '_blank';
          link.append(`${title} by ${artist}`);
        }));
      });
    } else if (embed_html) {
      return { __html: embed_html };
    } else {
      return document.createElement('a').tap(a => {
        a.href = url;
        a.target = '_blank';
        a.append('(audio)');
      });
    }
  },

  video ({ media, embed_html, url, poster }) {
    if (media) {
      return document.createElement('figure').tap(f => {
        f.append(document.createElement('video').tap(video => {
          video.src = media.url;
          video.controls = true;
          video.loop = true;
          poster && (video.poster = poster[0].url);
          video.style.width = '100%';
        }));
        f.style.margin = 0;
      });
    } else if (embed_html) {
      return { __html: embed_html };
    } else {
      return document.createElement('a').tap(a => {
        a.href = url;
        a.target = '_blank';
        a.append('(video)');
      });
    }
  }
};

const renderBlock = block => blockRenderers[block.type](block);

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

  const output = document.createElement('span');
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

  return [...output.children];
};

const formatRenderers = {
  bold: () => document.createElement('strong'),
  italic: () => document.createElement('em'),
  strikethrough: () => document.createElement('s'),
  small: () => document.createElement('small'),
  link: ({ url }) => document.createElement('a').tap(a => {
    a.href = url;
    a.target = '_blank';
  }),
  mention: ({ blog: { url } }) => document.createElement('a').tap(a => {
    a.href = url;
    a.target = '_blank';
    a.classList.push('h-card', 'mention');
  }),
  color: ({ hex }) => document.createElement('font').tap(font => {
    font.color = hex;
  }),
  default: () => document.createElement('span')
};

const renderFormatting = format =>
  (formatRenderers[format.type] || formatRenderers.default)(format);

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

const descendBy = (...funcs) => ascendBy(...funcs.map(func => i => -func(i)));

const splitArray = (array, index) => [
  array.slice(0, index),
  array.slice(index)
];

export const buildLists = parentNode => {
  const getFirstListItem = () => parentNode.querySelector(':scope > li[data-ordered]');
  while (getFirstListItem() !== null) {
    const firstListItem = getFirstListItem();
    const { ordered } = firstListItem.dataset;

    const listElement = document.createElement(ordered === "true" ? 'ol' : 'ul');
    parentNode.insertBefore(listElement, firstListItem);
    while (listElement.nextElementSibling?.dataset.ordered === ordered) {
      listElement.append(listElement.nextElementSibling);
    }
  }
};
