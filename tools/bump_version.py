#!/usr/bin/env python3
"""Dopisuje ?v=WERSJA do lokalnych plików js/css we wszystkich stronach .html,
żeby po aktualizacji przeglądarki (i GitHub Pages) nie trzymały starych plików w pamięci.
Uruchom przed każdym commitem:  python3 tools/bump_version.py"""
import glob, os, re, time
root = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
ver = time.strftime('%Y%m%d%H%M')
for f in glob.glob(os.path.join(root, '*.html')):
    s = open(f, encoding='utf-8').read()
    n = re.sub(r'((?:src|href)="(?:js|css)/[^"?]+\.(?:js|css))(?:\?v=[0-9a-z]+)?"', r'\1?v=' + ver + '"', s)
    if n != s:
        open(f, 'w', encoding='utf-8').write(n)
        print('wersja', ver, '→', os.path.basename(f))
