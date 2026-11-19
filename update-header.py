#!/usr/bin/env python3
"""
Makes the header identical on every page of the Athelstan.Online site.

Run it from the repo root (the folder with index.html):
    python3 update-header.py

What it does, in every *.html file:
  1. Nav: Home | AI Visibility Report | About | Blogs | Contact Us   (no dropdown, no Citation Checker)
  2. Header button text: "Get a Quote" -> "Contact"
  3. Footer: removes the "Citation Checker" link
Safe to run more than once. It only touches the nav, the header button and that one footer link.
"""
import glob, re, sys

NAV = '''<nav class="links" id="navLinks">
      <a href="/">Home</a>
      <a href="/ai-visibility-score-checker">AI Visibility Report</a>
      <a href="/about">About</a>
      <a href="/blog">Blogs</a>
      <a href="/contact">Contact Us</a>
    </nav>'''

nav_re    = re.compile(r'<nav class="links" id="navLinks">.*?</nav>', re.S)
btn_re    = re.compile(r'(<a href="/contact" class="cta-btn nav-only">)\s*Get a Quote\s*(</a>)')
footer_re = re.compile(r'[ \t]*<a href="/citation-checker">Citation Checker</a>[ \t]*\r?\n')

changed, leftovers = [], []
for path in sorted(glob.glob('*.html')):
    with open(path, encoding='utf-8', newline='') as f:
        old = f.read()
    new, n_nav = nav_re.subn(lambda m: NAV, old, count=1)
    new, n_btn = btn_re.subn(r'\1Contact\2', new)
    new, n_ftr = footer_re.subn('', new)
    if not n_nav:
        print(f'  ! {path}: no <nav class="links" id="navLinks"> found, header NOT changed')
    if new != old:
        with open(path, 'w', encoding='utf-8', newline='') as f:
            f.write(new)
        changed.append(f'{path}  (nav:{n_nav} button:{n_btn} footer:{n_ftr})')
    if re.search(r'citation-checker|Citation Check', new, re.I):
        leftovers.append(path)

print('Updated:' if changed else 'Nothing to change (already up to date).')
for c in changed: print('  ✓', c)
if leftovers:
    print('\nStill mention the Citation Checker in page content (check if you want these removed):')
    for p in leftovers: print('  -', p)
