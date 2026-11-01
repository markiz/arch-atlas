import urllib.request, urllib.parse, json, pathlib, re, html, concurrent.futures, io
from PIL import Image
from atlas_source import FREE_PHOTO_WIDTH, PHOTO_QUALITY, fit_width, save_photo
from progress import Progress
root = pathlib.Path(__file__).resolve().parent.parent
names = {'theatre1': 'Mardjanishvili Theatre Tbilisi.jpg', 'theatre2': 'Marjanishvili Theatre in Tbilisi, Georgia, at night. 2022.jpg', 'gallery1': 'National Gallery, Rustaveli Avenue, Tbilisi, Georgia.jpg', 'gallery2': 'Tbilisi, Tbilisi National Gallery 2, Georgia.jpg'}
# The existing hero may already use a chosen file; duplicates are removed by source URL later.
params = urllib.parse.urlencode({'action': 'query', 'format': 'json', 'prop': 'imageinfo', 'iiprop': 'url|extmetadata', 'iiurlwidth': '1920', 'titles': '|'.join('File:' + x for x in names.values())})
h = {'User-Agent': 'TbilisiAtlasResearch/0.2 (educational architecture atlas)'}
def fetch(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=h), timeout=45) as r: return r.read()
j = json.loads(fetch('https://commons.wikimedia.org/w/api.php?' + params))
def clean(x): return html.unescape(re.sub('<[^>]*>', '', x or '')).strip()
by = {p['title'].replace('_', ' '): p for p in j['query']['pages'].values()}
progress = Progress(len(names), 'fetch curated photos')
def one(item):
    key, name = item
    try:
        p = by['File:' + name.replace('_', ' ')]; info = p['imageinfo'][0]; meta = info['extmetadata']; v = lambda k: clean(meta.get(k, {}).get('value', ''))
        author, lic, licenseurl = v('Artist'), v('LicenseShortName'), v('LicenseUrl')
        if not (author and lic and licenseurl): raise ValueError('missing attribution')
        if len(author) > 180: author = author.split('\n')[0][:180]
        b = fetch(info.get('thumburl') or info['url']); img = Image.open(io.BytesIO(b)); img = fit_width(img, FREE_PHOTO_WIDTH); relative = save_photo(img.convert('RGB'), key, quality=PHOTO_QUALITY)
        return key, {'file': relative, 'author': author, 'license': lic, 'licenseUrl': licenseurl, 'source': info['descriptionurl'], 'modifications': 'уменьшен размер, преобразовано в WebP'}
    except Exception as ex:
        print('Error', key, ex, flush=True)
        return key, None
def tracked(item):
    key, photo = one(item)
    progress.advance(f'{key}: {"ok" if photo else "skipped"}')
    return key, photo
progress.start(f'{len(names)} files')
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as p: out = dict(p.map(tracked, names.items()))
progress.finish()
(root / 'data/specific-fixes.json').write_text(json.dumps({k: v for k, v in out.items() if v}, ensure_ascii=False, indent=2))
print('curated photos', sum(v is not None for v in out.values()), flush=True)
