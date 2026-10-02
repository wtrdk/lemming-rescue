# Lemming Rescue

Een browsergame met de volledige Amiga-singleplayercampagne: Fun, Tricky, Taxing en Mayhem (30 levels per groep). De originele Amiga-campagne bevat 120 speelposities op 80 unieke levelindelingen; herhaalde levels met een andere moeilijkheid blijven apart speelbaar. De twintig Amiga-tweepelerslevels zijn beschikbaar via `versus.html`. De eigen Rescue-puzzel staat op `rescue.html`.

## Spelen

Kies een level uit een van de vier moeilijkheidsgroepen en start. Selecteer daarna een skill en klik op een lemming. De acht skillvakken volgen de klassieke volgorde. Met Tab en Enter kies je lemmings vanaf het speelveld; Shift beperkt de selectie tot walkers. Klik of sleep om het level te verplaatsen, gebruik de minimap of pijltjestoetsen om te navigeren en zoom met de keuzelijst of twee vingers.

Spatie pauzeert wanneer het speelveld focus heeft; in pauze kun je skills blijven toewijzen. Met `−` en `+` verander je de instroomsnelheid. Bevestig Nuke door tweemaal te klikken of tweemaal N te drukken. De oefenstand biedt vijf seconden terugspoelen, één simulatiestap en een tijdlijn; oefenpogingen tellen niet mee in het opgeslagen record.

## Zelf hosten en aanmelden

De Docker-versie gebruikt persoonlijke accounts. De eerste gebruiker is standaard `wtrdk` en wordt beheerder. Iedere speler heeft eigen scores en replays; er is geen openbare registratie. De game, accountpagina's en voortgangs-API zijn pas na aanmelden bereikbaar. De healthcheck `/api/health` is anoniem beschikbaar en bevat alleen de serverstatus.

De navigatie biedt:

| Pagina | Functie | Toegang |
| --- | --- | --- |
| `/` | De 120 Amiga-singleplayerlevels | Alle aangemelde gebruikers |
| `/editor.html` | Eigen levels bouwen, testen en privé delen | Alle aangemelde gebruikers |
| `/versus.html` | 20 levels voor twee lokale spelers | Alle aangemelde gebruikers |
| `/rescue.html` | De eigen Rescue-puzzel | Alle aangemelde gebruikers |
| `/scoreboard` | Privé challenges per singleplayerlevel | Alle aangemelde gebruikers |
| `/account` | Zelf je wachtwoord wijzigen | Eigen account |
| `/admin` | Gebruikers, rollen en back-ups beheren | Beheerders |

Dagelijkse gecontroleerde back-ups worden standaard om 03:00 Nederlandse tijd gemaakt en 14 dagen bewaard. Het scorebord bewaart drie onafhankelijke records per speler en level: meeste lemmings gered, minste skills en snelste oplossing. Alleen gehaalde levels tellen mee.

Begin met [DOCKER.md](DOCKER.md). Voor accountbeheer zie [MULTIUSER.md](MULTIUSER.md), voor de levelbouwer [LEVELBOUWER.md](LEVELBOUWER.md), voor back-ups en challenges [FEATURES.md](FEATURES.md) en voor repositorybeheer [GITHUB.md](GITHUB.md).

## Wat erin zit

- 120 Amiga-singleplayerlevels (Fun 1–30, Tricky 1–30, Taxing 1–30 en Mayhem 1–30), inclusief de originele levelherhalingen met afzonderlijke moeilijkheid, metadata en voortgang.
- 20 aparte Amiga-tweepelerslevels met twee lokale teams, onafhankelijke skillvoorraden en de originele levelobjecten en terrein.
- Een levelbouwer met oorspronkelijke terrein- en objectgraphics, skillinstellingen, staal, levels opslaan per account, playtesten en gericht delen met andere accounts.
- Alle vijf oorspronkelijke Amiga-paletstijlen: terrein wordt als afzonderlijke pixelstukken gerenderd; ingangen, uitgangen, decoratie, vallen en vloeistoffen gebruiken hun eigen frames en triggers.
- De aangeleverde personagesheet met pixelgeverifieerde uitsneden, framevolgordes en voetankers voor alle animaties. Vier beschadigde ripframes, de sprongen en de explosie zijn uit originele Amiga-data hersteld. `SPRITE-AUDIT.md` beschrijft de controle van alle 337 frames.
- Een vaste Amiga-PAL-simulatiecadans van 50/3 stappen per seconde, integer-pixelbeweging, gevormde terreinbotsingen, framegestuurde skills, traps, staal en eenrichtings-terrein.
- De eerste vijf originele Amiga-muziektracks en twintig Amiga-effecten. Muziek, effecten en volume zijn instelbaar.
- Klassieke status-HUD, instroomregeling, klikbare minimap, scrollen, zoom, toetsenbord- en aanraakbediening.
- Voortgang en beste score op de privé gehoste Site, plus importeren, downloaden en afspelen van deterministische replays. De Site-gateway beschermt de voortgangs-API; records staan in D1. De Docker-versie vraagt eerst om een persoonlijke gebruikersnaam en wachtwoord en beschermt daarmee ook de gamebestanden en voortgangs-API.
- De oude Rescue-puzzel en zijn bestaande bediening blijven beschikbaar via `rescue.html`.

## Getrouwheid en grenzen

De 120 singleplayerlevelrecords zijn gereconstrueerd met de originele Amiga-levelbestanden en de oorspronkelijke niveauvolgorde. De reconstructie is een browserimplementatie en geen Amiga-emulator; timing, botsingen en animatie zijn pixel- en framegestuurd maar niet cycle-perfect tegen de originele 68000-uitvoering geverifieerd. De vier Amiga-speciallevels gebruiken hun eigen achtergrondafbeeldingen uit de oorspronkelijke ILBM-bestanden. De countdowncijfers gebruiken nog een als DOS geïdentificeerd masker. De geluidsmix speelt de muziek en effecten tegelijk en wijkt daarmee af van het originele Amiga-audiomengsel. De testdekking en resterende afwijkingen staan in `FIDELITY-AUDIT.md`.

## Ontwikkelen en testen

De server en lokale ontwikkeling vereisen **Node 24**. Je hebt geen Node-installatie op de host nodig als je Docker gebruikt. Controleer het project vanuit de projectmap met:

```sh
sh check-project.sh
```

Het script gebruikt `node:24-alpine`, installeert de dependencies met `npm ci`, bouwt de game en voert de server- en databasetests uit. Buildbestanden en dependencies worden met jouw gebruikersrechten gemaakt. Hiervoor worden tijdelijke testdatabases gebruikt; je echte accounts en scores blijven behouden.

Met een lokale Node 24-installatie kun je `npm ci`, `npm run dev`, `npm run build` en `node --test server/selfhost.test.js` uitvoeren. Node 18 ondersteunt de gebruikte ingebouwde SQLite-module niet. De lokale `/qa.html`-route voert de echte engine en browserassets door mechaniektests; deze route wordt niet in het websitepakket gebouwd.

De Vite-ontwikkelpreview gebruikt een eigen gedeelde SQLite-testdatabase en test niet de Docker-login. De Docker-server gebruikt persoonlijke accounts in `./data/progress.sqlite`. De afzonderlijke privé gehoste Sites-versie gebruikt haar gateway en de door Sites beheerde D1; de Docker-beheerfuncties worden daar niet automatisch gepubliceerd.

## Bronnen

Zie `THIRD-PARTY-NOTICES.md` en `public/assets/audio/provenance.json` voor bronvermelding van sprites, level- en terrain-rips, oorspronkelijke soundtrack- en effectopnames, en de MIT-code waarop een deel van de framegedreven skilllogica is gebaseerd. Bronbestanden en detailvergelijkingen staan beschreven in `FIDELITY-AUDIT.md`.

## Zelf hosten

Start de game met Docker Compose via de instructies in [`DOCKER.md`](DOCKER.md). De container serveert de game en bewaart scores en replays in een blijvende SQLite-map. De bestaande gehoste site blijft privé.
