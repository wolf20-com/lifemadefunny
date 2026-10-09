"""One-time, loss-checked migration of the original static HTML to editable JSON.

Run from the repository root with Python 3. No network or third-party packages.
The old public/ tree remains a migration snapshot; production is built into dist/.
"""
from html.parser import HTMLParser
from pathlib import Path
from collections import defaultdict
import hashlib
import json
import re


class Node:
    def __init__(self, tag='', attrs=(), parent=None):
        self.tag, self.attrs, self.parent, self.children = tag, dict(attrs), parent, []

    def all(self, tag=None, cls=None):
        result = []
        for child in self.children:
            if isinstance(child, Node):
                if (tag is None or child.tag == tag) and (cls is None or cls in child.attrs.get('class', '').split()):
                    result.append(child)
                result.extend(child.all(tag, cls))
        return result

    def text(self):
        return re.sub(r'\s+', ' ', ''.join(c.text() if isinstance(c, Node) else c for c in self.children)).strip()


class DOM(HTMLParser):
    def __init__(self, source):
        super().__init__(convert_charrefs=True)
        self.root = self.node = Node()
        self.feed(source)

    def handle_starttag(self, tag, attrs):
        child = Node(tag, attrs, self.node)
        self.node.children.append(child)
        if tag not in {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'}:
            self.node = child

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        self.handle_endtag(tag)

    def handle_endtag(self, tag):
        node = self.node
        while node.parent and node.tag != tag:
            node = node.parent
        if node.parent:
            self.node = node.parent

    def handle_data(self, text):
        self.node.children.append(text)


def path_url(path):
    value = '/' + path.relative_to(Path('public')).as_posix()
    return value[:-10] if value.endswith('index.html') else value[:-5] + '/'


out = Path('src/content')
out.mkdir(parents=True, exist_ok=True)
legacy = {'pages': [], 'redirects': [], 'baseline': {}}
total = 0
for lang in ('ja', 'en', 'fr', 'pt', 'es', 'de'):
    data = {'topics': [], 'tags': {}, 'terms': []}
    for path in sorted((Path('public') / lang / 'categories').glob('*/*/index.html')):
        group, slug = path.parts[-3:-1]
        root = DOM(path.read_text()).root
        title = root.all('h1')[0].text()
        image = root.all(cls='hero-image')[0].all('img')[0].attrs['src']
        topic = {'group': group, 'slug': slug, 'title': title, 'image': image, 'stories': []}
        seen = set()
        sources = [path] + sorted(path.parent.glob('page*.html'), key=lambda p: int(re.search(r'page(\d+)', p.name)[1]))
        for source in sources:
            page = DOM(source.read_text()).root
            first_id = None
            posts = page.all(cls='post-item')
            for post in posts:
                title_node = post.all(cls='post-title')
                body_node = post.all(cls='post-explanation')
                assert len(title_node) == 1 and len(body_node) == 1, source
                heading, body = title_node[0].text(), body_node[0].text()
                assert heading and body, source
                story_id = 'moment-' + hashlib.sha256((heading + '\n' + body).encode()).hexdigest()[:12]
                first_id = first_id or story_id
                if story_id in seen:
                    continue
                seen.add(story_id)
                tags = []
                for a in post.all(cls='post-tagwrap')[0].all('a'):
                    key = a.attrs['href'].strip('/').split('/')[-1]
                    data['tags'][key] = a.text().lstrip('#')
                    tags.append(key)
                date_text = post.all(cls='createat-wrap')[0].text()
                date_match = re.search(r'(\d{4})/(\d{1,2})/(\d{1,2})', date_text)
                date = '-'.join([date_match[1], date_match[2].zfill(2), date_match[3].zfill(2)]) if date_match else None
                topic['stories'].append({'id': story_id, 'title': heading, 'body': body, 'tags': tags, 'published': date})
            if source != path:
                legacy['redirects'].append({'from': path_url(source), 'to': path_url(path) + '#' + first_id})
        assert topic['stories'], path
        data['topics'].append(topic)
        total += len(topic['stories'])

    for path in sorted((Path('public') / lang / 'tags').rglob('*.html')):
        if path.name.startswith('page'):
            legacy['redirects'].append({'from': path_url(path), 'to': '/' + path.parent.relative_to('public').as_posix() + '/'})
        elif path.parent.name != 'tags':
            # Preserve old tag URLs even if their content only existed in an archive.
            key = path.parent.name
            if key not in data['tags']:
                root = DOM(path.read_text()).root
                data['tags'][key] = root.all('h1')[0].text().lstrip('#')

    terms = DOM((Path('public') / lang / 'static' / 'terms.html').read_text()).root.all('main')[0]
    # Preserve the existing terms as readable text, without the obsolete page shell.
    for node in terms.all():
        if node.tag in {'h2', 'p', 'li'} and not (node.tag == 'p' and node.parent.tag == 'li'):
            text = node.text()
            if text:
                data['terms'].append({'tag': 'h2' if node.tag == 'h2' else 'p', 'text': text})
    (out / f'{lang}.json').write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
    print(lang, len(data['topics']), 'topics;', sum(len(t['stories']) for t in data['topics']), 'stories;', len(data['tags']), 'tags')

legacy['pages'] = [path_url(p) for p in sorted(Path('public').rglob('*.html')) if p.name not in {'404.html', 'backup_index.html'}]
legacy['baseline'] = {'htmlPages': 2453, 'tagPages': 1892, 'brokenHreflangPages': 2450, 'sitemapUrls': 2449, 'stories': total}
(out / 'migration.json').write_text(json.dumps(legacy, ensure_ascii=False, indent=2) + '\n')
print(total, 'stories preserved;', len(legacy['redirects']), 'legacy pagination URLs mapped')
