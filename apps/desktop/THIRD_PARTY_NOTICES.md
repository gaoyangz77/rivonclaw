# Third-Party Notices

TK Copilot Desktop bundles the third-party components listed below. Each entry
records where the component ships inside the application, who holds copyright in
it, and the licence it is distributed under.

This file is copied into the packaged application's resources directory, so the
notices travel with every build.

---

## 1. FS Pixel Sans Unicode Regular

The pixel-art office renders every on-screen label in this font.

| | |
|---|---|
| Bundled as | `panel-dist/office/fonts/FSPixelSansUnicode-Regular.ttf` (served by the Panel at `/office/fonts/`) |
| Designer | NZWStudios2024 — <https://fontstruct.com/fontstructors/show/2431873/nzwstudios2024> |
| Source | <https://fontstruct.com/fontstructions/show/2606508/fs-pixel-sans-unicode-regular> |
| Licence | SIL Open Font License, Version 1.1 |

The font is distributed unmodified. Its `name` table declares the licence in
name ID 13 (License Description) as `Open Font License`; it carries no
License Info URL (name ID 14).

**Reserved Font Name:** none. The font's `name` table contains no
"Reserved Font Name" statement, so clause 3 of the licence below has no reserved
name to attach to. We neither modify nor rename the font in any case.

The copyright notice below is reproduced verbatim from name ID 0 of the font's
`name` table, including its line break and its unmatched opening quotation mark:

```
Copyright NZWStudios2024 2025
“FS Pixel Classic Regular
```

The licence text that follows is the canonical SIL Open Font License 1.1,
retrieved on 2026-09-01 from <https://openfontlicense.org/documents/OFL.txt>.
Only the licence header's placeholder copyright block has been replaced with the
font's actual copyright notice, quoted above; the licence body is unaltered.

```
Copyright NZWStudios2024 2025
“FS Pixel Classic Regular

This Font Software is licensed under the SIL Open Font License, Version 1.1.
This license is copied below, and is also available with a FAQ at:
https://openfontlicense.org


-----------------------------------------------------------
SIL OPEN FONT LICENSE Version 1.1 - 26 February 2007
-----------------------------------------------------------

PREAMBLE
The goals of the Open Font License (OFL) are to stimulate worldwide
development of collaborative font projects, to support the font creation
efforts of academic and linguistic communities, and to provide a free and
open framework in which fonts may be shared and improved in partnership
with others.

The OFL allows the licensed fonts to be used, studied, modified and
redistributed freely as long as they are not sold by themselves. The
fonts, including any derivative works, can be bundled, embedded,
redistributed and/or sold with any software provided that any reserved
names are not used by derivative works. The fonts and derivatives,
however, cannot be released under any other type of license. The
requirement for fonts to remain under this license does not apply
to any document created using the fonts or their derivatives.

DEFINITIONS
"Font Software" refers to the set of files released by the Copyright
Holder(s) under this license and clearly marked as such. This may
include source files, build scripts and documentation.

"Reserved Font Name" refers to any names specified as such after the
copyright statement(s).

"Original Version" refers to the collection of Font Software components as
distributed by the Copyright Holder(s).

"Modified Version" refers to any derivative made by adding to, deleting,
or substituting -- in part or in whole -- any of the components of the
Original Version, by changing formats or by porting the Font Software to a
new environment.

"Author" refers to any designer, engineer, programmer, technical
writer or other person who contributed to the Font Software.

PERMISSION & CONDITIONS
Permission is hereby granted, free of charge, to any person obtaining
a copy of the Font Software, to use, study, copy, merge, embed, modify,
redistribute, and sell modified and unmodified copies of the Font
Software, subject to the following conditions:

1) Neither the Font Software nor any of its individual components,
in Original or Modified Versions, may be sold by itself.

2) Original or Modified Versions of the Font Software may be bundled,
redistributed and/or sold with any software, provided that each copy
contains the above copyright notice and this license. These can be
included either as stand-alone text files, human-readable headers or
in the appropriate machine-readable metadata fields within text or
binary files as long as those fields can be easily viewed by the user.

3) No Modified Version of the Font Software may use the Reserved Font
Name(s) unless explicit written permission is granted by the corresponding
Copyright Holder. This restriction only applies to the primary font name as
presented to the users.

4) The name(s) of the Copyright Holder(s) or the Author(s) of the Font
Software shall not be used to promote, endorse or advertise any
Modified Version, except to acknowledge the contribution(s) of the
Copyright Holder(s) and the Author(s) or with their explicit written
permission.

5) The Font Software, modified or unmodified, in part or in whole,
must be distributed entirely under this license, and must not be
distributed under any other license. The requirement for fonts to
remain under this license does not apply to any document created
using the Font Software.

TERMINATION
This license becomes null and void if any of the above conditions are
not met.

DISCLAIMER
THE FONT SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO ANY WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT
OF COPYRIGHT, PATENT, TRADEMARK, OR OTHER RIGHT. IN NO EVENT SHALL THE
COPYRIGHT HOLDER BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
INCLUDING ANY GENERAL, SPECIAL, INDIRECT, INCIDENTAL, OR CONSEQUENTIAL
DAMAGES, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF THE USE OR INABILITY TO USE THE FONT SOFTWARE OR FROM
OTHER DEALINGS IN THE FONT SOFTWARE.
```

---

## 2. Pixel Agents

The pixel-art office renderer. Built from the upstream sources and staged into
the Panel's static assets.

| | |
|---|---|
| Bundled as | `panel-dist/office/` (the built renderer and its assets) |
| Source | <https://github.com/pixel-agents-hq/pixel-agents> |
| Licence | MIT |

```
MIT License

Copyright (c) 2026 Pablo De Lucca

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## 3. MetroCity — Free Top Down Character Pack

The character sprites the office draws its agents with. Pixel Agents credits
this pack as the basis for its characters; the sprites reach the app through the
Pixel Agents build.

| | |
|---|---|
| Bundled as | character sprites encoded in `panel-dist/office/scene-assets.json`, and the character strip `panel-dist/office/characters.png` |
| Author | JIK-A-4 |
| Source | <https://jik-a-4.itch.io/metrocity-free-topdown-character-pack> |
| Retrieved | 2026-09-01 |
| Licence | Creative Commons Zero v1.0 Universal (CC0 1.0) |

Evidence recorded from the source page on 2026-09-01, quoted as it appears there:

- The page's information table lists the field **Asset license** with the value
  "Creative Commons Zero v1.0 Universal".
- The pack description states: "This is a completely free asset pack for top
  down games."
- On attribution, the page states: "Credits are not necessary but would be
  appreciated."
- In the page's comment thread, asked "Does the license also allow it to be used
  in commercial games?", the author JIK-A-4 replied: "Yes you can also use it in
  a commercial project. ;-)" (This is a comment on the page, not part of the
  licence declaration; the CC0 field above is the operative grant.)

Credits are not required under CC0. This notice records them because the page
asks for them and because the provenance is worth preserving.
