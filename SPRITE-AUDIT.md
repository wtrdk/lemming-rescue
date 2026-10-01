# Spritecontrole — 30 september 2026

De framevormen zijn onafhankelijk gecontroleerd met de echte bitmap- en maskergegevens uit de gedecomprimeerde Amiga SPS 0132 `Code`-binary. De aangeleverde Megasis-rip blijft de hoofdbron. De controle omvat 28 oorspronkelijke animatiereeksen, 337 frames: 334 frames op de aangeleverde sheet, twee springsprites en één explosiesprite.

## Herstelde koppelingen en uitsneden

| Actie | Frames per richting | Native grootte | Herstel |
|---|---:|---|---|
| Vallen | 4 | 16×10 | De echte rijen op y=20 en y=30; eigen horizontale oorsprong per richting |
| Klimmen | 8 | 16×12 | De klimrijen op y=40 en y=52, zonder vertraging naar vier verkeerde frames |
| Optrekken | 8 | 16×12 | Individuele bronhoogte per frame; voetanker -12 voorkomt dubbele verticale verplaatsing |
| Lopen | 8 | 16×10 | Horizontale oorsprong gecorrigeerd; originele framevolgorde voor links hersteld |
| Parachute | 8 | 16×16 | Vier openingsframes gevolgd door een herhalende reeks van vier zweefframes; voeten niet meer afgesneden |
| Bouwen | 16 | 16×13 | Ontbrekende onderste pixel van de rechter reeks hersteld |
| Bashen | 32 | 16×10 | Bovenste rij en beide stroken correct uitgesneden |
| Mijnen | 24 | 16×13 | Beide stroken, stofpixels en voetanker -12 hersteld |
| Graven | 16 | 16×14 | Bovenste stofpixels en het voetanker -12 hersteld |
| Blokkeren | 16 | 16×10 | Bovenste pixels hersteld; geen pixels van de volgende rij |
| Verdrinken | 16 | 16×10 | Volledige oorspronkelijke frames en voetanker; drie beschadigde ripframes vervangen uit Amiga-data |
| Branden | 14 | 16×14 | Volledige hoogte en origineel anker -10; één beschadigd ripframe uit Amiga-data hersteld |
| Oh-no | 16 | 16×10 | Alleen de eigen rij; geen pixels van de pletteranimatie |
| Pletteren | 16 | 16×10 | Volledige originele vorm, zonder pixels van de blockerreeks |
| Uitgang | 8 | 16×13 | Juiste rij en voetanker; geen pixels van branden of bouwen |
| Schouders ophalen | 8 | 16×10 | Beide richtingen op hetzelfde native anker |

`sprite-atlas.js` bewaart iedere exacte uitsnede met een afzonderlijk voetanker. De vier herstelde frames staan in `public/assets/sprites/sprite-corrections.png`; hun kleuren sluiten aan op de aangeleverde rip. De bronafbeelding zelf is ongewijzigd. Springen en de explosie gebruiken de eerder uit Amiga-data geëxtraheerde aanvullende sprites.

## Onafhankelijke browsercontrole

`qa-fixtures/sprite-reference.json` bevat de 337 originele transparantiemaskers en de oorspronkelijke afmetingen en ankers. De browsertest rendert iedere sprite met de echte game-renderer en vergelijkt iedere pixel van de gerenderde vorm en positie met deze referentie. Alle speltoestanden worden bovendien in beide richtingen gecontroleerd. Ingang, korte val, lange val, parachuteloop en het einde van dood-/uitgangsanimaties hebben afzonderlijke controles. Deze lokale QA-route en referentie worden niet in de websitebuild opgenomen.

Reproduceer de atlas en referentie met Pillow:

```sh
python scripts/map-sprites.py /path/to/amiga-disks/0132/1/Code
```

Het script verifieert zowel de SHA-256 van de oorspronkelijke binary als die van de aangeleverde sheet. De Amiga-maskers stemmen overeen met de ondoorzichtige bitmap-pixels. De ruwe Code-binary wordt niet in de repository opgenomen. Bron: https://www.camanis.net/lemmings/files/rips/disks/amiga_lemmings_disk_rips_decrunched.7z ; formaatreferentie: https://www.camanis.net/lemmings/files/docs/lemmings_main_dat_file_format.txt .
