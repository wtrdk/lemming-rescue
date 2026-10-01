# Lemming Rescue

Een browsergame met de volledige Amiga-singleplayercampagne: Fun, Tricky, Taxing en Mayhem (30 levels per groep). De originele Amiga-campagne bevat 120 speelposities op 80 unieke levelindelingen; herhaalde levels met een andere moeilijkheid blijven apart speelbaar. De twintig Amiga-tweepelerslevels zijn beschikbaar via `versus.html`. De eigen Rescue-puzzel staat op `rescue.html`.

## Spelen

Kies een level uit een van de vier moeilijkheidsgroepen en start. Selecteer daarna een skill en klik op een lemming. De acht skillvakken volgen de klassieke volgorde. Met Tab en Enter kies je lemmings vanaf het speelveld; Shift beperkt de selectie tot walkers. Klik of sleep om het level te verplaatsen, gebruik de minimap of pijltjestoetsen om te navigeren en zoom met de keuzelijst of twee vingers.

Spatie pauzeert wanneer het speelveld focus heeft; in pauze kun je skills blijven toewijzen. Met `−` en `+` verander je de instroomsnelheid. Bevestig Nuke door tweemaal te klikken of tweemaal N te drukken. De oefenstand biedt vijf seconden terugspoelen, één simulatiestap en een tijdlijn; oefenpogingen tellen niet mee in het opgeslagen record.

## Wat erin zit

- 120 Amiga-singleplayerlevels (Fun 1–30, Tricky 1–30, Taxing 1–30 en Mayhem 1–30), inclusief de originele levelherhalingen met afzonderlijke moeilijkheid, metadata en voortgang.
- 20 aparte Amiga-tweepelerslevels met twee lokale teams, onafhankelijke skillvoorraden en de originele levelobjecten en terrein.
- Alle vijf oorspronkelijke Amiga-paletstijlen: terrein wordt als afzonderlijke pixelstukken gerenderd; ingangen, uitgangen, decoratie, vallen en vloeistoffen gebruiken hun eigen frames en triggers.
- De aangeleverde personagesheet met pixelgeverifieerde uitsneden, framevolgordes en voetankers voor alle animaties. Vier beschadigde ripframes, de sprongen en de explosie zijn uit originele Amiga-data hersteld. `SPRITE-AUDIT.md` beschrijft de controle van alle 337 frames.
- Een vaste Amiga-PAL-simulatiecadans van 50/3 stappen per seconde, integer-pixelbeweging, gevormde terreinbotsingen, framegestuurde skills, traps, staal en eenrichtings-terrein.
- De eerste vijf originele Amiga-muziektracks en twintig Amiga-effecten. Muziek, effecten en volume zijn instelbaar.
- Klassieke status-HUD, instroomregeling, klikbare minimap, scrollen, zoom, toetsenbord- en aanraakbediening.
- Voortgang en beste score op de privésite, plus importeren, downloaden en afspelen van deterministische replays. De sitegateway beschermt de voortgangs-API; de records staan in D1.
- De oude Rescue-puzzel en zijn bestaande bediening blijven beschikbaar via `rescue.html`.

## Getrouwheid en grenzen

De 120 singleplayerlevelrecords zijn gereconstrueerd met de originele Amiga-levelbestanden en de oorspronkelijke niveauvolgorde. De reconstructie is een browserimplementatie en geen Amiga-emulator; timing, botsingen en animatie zijn pixel- en framegestuurd maar niet cycle-perfect tegen de originele 68000-uitvoering geverifieerd. De vier Amiga-speciallevels gebruiken hun eigen achtergrondafbeeldingen uit de oorspronkelijke ILBM-bestanden. De countdowncijfers gebruiken nog een als DOS geïdentificeerd masker. De geluidsmix speelt de muziek en effecten tegelijk en wijkt daarmee af van het originele Amiga-audiomengsel. De testdekking en resterende afwijkingen staan in `FIDELITY-AUDIT.md`.

## Ontwikkelen en testen

`npm install`, `npm run dev` en `npm run build` starten en bouwen de game. De lokale `/qa.html`-route voert de echte engine en browserassets door mechaniektests; deze route wordt niet in het websitepakket gebouwd. Voortgang gebruikt voor de lokale Vite-preview een SQLite-testdatabase. De gehoste site gebruikt het door Sites beheerde D1.

## Bronnen

Zie `THIRD-PARTY-NOTICES.md` en `public/assets/audio/provenance.json` voor bronvermelding van sprites, level- en terrain-rips, oorspronkelijke soundtrack- en effectopnames, en de MIT-code waarop een deel van de framegedreven skilllogica is gebaseerd. Bronbestanden en detailvergelijkingen staan beschreven in `FIDELITY-AUDIT.md`.

## Zelf hosten

Start de game met Docker Compose via de instructies in [`DOCKER.md`](DOCKER.md). De container serveert de game en bewaart scores en replays in een blijvende SQLite-map. De bestaande gehoste site blijft privé.
