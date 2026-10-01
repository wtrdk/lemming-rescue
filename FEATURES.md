# Back-ups, accountbeheer en privé challenges

Dit pakket breidt de bestaande Docker-versie uit. De bestaande `.env`, data en accounts blijven behouden. Zowel een installatie zonder login als de eerdere login- en multiuserversies kunnen worden bijgewerkt. Het eerste bestaande account krijgt bij de migratie de rol beheerder; bij een nieuwe installatie is dat standaard `wtrdk`.

## Installeren op t-rex

Download `lemming-features-update.tar.gz` naar je computer en kopieer het naar je server:

```sh
scp ~/Downloads/lemming-features-update.tar.gz wtrdk@t-rex:/tmp/
```

Voer op de server uit:

```sh
cd /opt/lemmings
tar -xzf /tmp/lemming-features-update.tar.gz
sh install-features.sh
```

Het installatiescript stopt eerst de container, kopieert de hele huidige data-map naar `~/lemmings-backups/before-features-DATUM-TIJD`, voegt back-upmappen toe aan Git- en Docker-uitsluitingen en bouwt/start de nieuwe container. Je `.env` wordt niet vervangen. Als je nog geen login hebt geïnstalleerd, zet dan vóór het starten `LEMMING_RESCUE_PASSWORD` (12–256 tekens) in `.env`; het eerste account krijgt dat wachtwoord.

Bij gebruik van de Nginx Proxy Manager override:

```sh
sh install-features.sh -f docker-compose.yml -f docker-compose.npm.yml
```

Open daarna de game en meld je opnieuw aan. De navigatie boven de game biedt **Scorebord**, **Mijn account** en, voor beheerders, **Beheer**. Deze pagina's zijn ook bereikbaar op `/scoreboard`, `/account` en `/admin`. Geen van deze pagina's is anoniem bereikbaar. De Sites-versie gebruikt haar bestaande toegangsbeveiliging en wordt niet door dit pakket gepubliceerd.

## Accountbeheer

Op **Beheer** maak je spelers of extra beheerders aan, stel je wachtwoorden opnieuw in en wijzig je rollen. Bij het verwijderen moet je de gebruikersnaam bevestigen; daarbij worden alle persoonlijke scores en challenge-records verwijderd. Je kunt hier niet je eigen account verwijderen of je eigen rol veranderen. Ook via het terminalbeheer kan de laatste beheerder niet worden verwijderd of teruggezet naar speler.

Op **Mijn account** kan iedere gebruiker zijn eigen wachtwoord wijzigen met het huidige wachtwoord. Na een wijziging moeten alle sessies van die gebruiker opnieuw inloggen. Een beheerder die een wachtwoord opnieuw instelt, trekt daarmee ook de bestaande sessies in. Rollen worden bij elk verzoek opnieuw gecontroleerd.

Het terminalbeheer blijft beschikbaar, onder andere voor herstel van toegang:

```sh
docker compose exec --user node lemming-rescue node server/manage-users.js list
docker compose exec --user node lemming-rescue node server/manage-users.js password wtrdk
docker compose exec --user node lemming-rescue node server/manage-users.js admin wtrdk
```

Met `user NAAM` zet je een andere beheerder terug naar speler. De wachtwoorden worden verborgen gevraagd en worden met scrypt en een willekeurige salt opgeslagen.

## Automatische back-ups

Bij de eerste start wordt direct een gecontroleerde SQLite-back-up gemaakt. Daarna wordt dagelijks vanaf **03:00, Europe/Amsterdam** gecontroleerd of de back-up voor die dag bestaat. De controle loopt iedere minuut zolang de server draait; bij een herstart na 03:00 wordt een ontbrekende dagkopie meteen gemaakt. Tijdens een langere serverstop worden geen historische dagkopieën gemaakt.

De SQLite online-back-upfunctie maakt een consistente kopie terwijl de game blijft draaien. Elke kopie wordt met `PRAGMA quick_check` gecontroleerd en pas daarna onder de definitieve bestandsnaam geplaatst. De kopie omvat accounts, wachtwoordhashes, persoonlijke voortgang en challenge-records. De bestanden staan op de host in **`/opt/lemmings/backups`**, buiten de statische websitebestanden. Alleen beheerders kunnen ze via de game downloaden. Bestandsrechten zijn 0600.

Standaard worden kopieën **14 dagen** bewaard. Oude kopieën worden pas na een geslaagde nieuwe back-up verwijderd. Op Beheer zie je de bestanden, de ingestelde bewaartermijn en eventuele fouten. Met **Nu een back-up maken** maak je een extra kopie. Back-ups op dezelfde server beschermen niet tegen verlies van de hele server; je kunt deze map meenemen in je bestaande externe back-up.

Optionele instellingen in `.env`:

```dotenv
LEMMING_BACKUP_KEEP_DAYS=14
LEMMING_BACKUP_HOUR=3
LEMMING_BACKUP_TIMEZONE=Europe/Amsterdam
```

Na aanpassen: `docker compose up -d`. De initiële `LEMMING_RESCUE_PASSWORD`-variabele wordt alleen gebruikt om het eerste account te maken en mag daarna uit `.env` worden verwijderd.

### Een back-up herstellen

Kies een bestaand bestand uit `backups` en vervang hieronder de voorbeeldnaam. De container moet tijdens deze handelingen gestopt blijven. Bewaar eerst de huidige data als terugvalmogelijkheid:

```sh
cd /opt/lemmings
docker compose stop
mkdir -p "$HOME/lemmings-backups"
cp -a data "$HOME/lemmings-backups/before-restore-$(date +%Y%m%d-%H%M%S)"
cp backups/lemming-2026-10-01.sqlite data/progress.sqlite
rm -f data/progress.sqlite-wal data/progress.sqlite-shm
docker compose up -d
```

Gebruik bij Nginx Proxy Manager dezelfde override-opties voor beide Compose-commando's. Oude WAL/SHM-bestanden worden uitsluitend verwijderd terwijl de server gestopt is, nadat de huidige data is gekopieerd. Als de bestanden aan een andere hostgebruiker toebehoren, kunnen voor kopiëren en verwijderen `sudo`-rechten nodig zijn. Herstel zet ook wachtwoorden, rollen en accountverwijderingen terug naar het moment van de back-up; alle gebruikers moeten opnieuw aanmelden.

## Het privé scorebord

De ranglijsten vergelijken spelers **per level**, met drie onafhankelijke persoonlijke records:

- **Meeste gered:** hoogste aantal geredde lemmings; bij gelijk resultaat volgt minder skills, daarna minder tijd.
- **Minste skills:** minste toegewezen klassieke skills; bij gelijk resultaat volgt meer gered, daarna minder tijd.
- **Snelste oplossing:** laagste aantal simulatiestappen; bij gelijk resultaat volgt meer gered, daarna minder skills.

Alleen gehaalde levels tellen mee. De tijd is simulatietijd (3/50 seconde per stap), zodat pauzes of afspeelsnelheid geen voordeel geven. Skilltoewijzingen worden uit de replaycommando's geteld. Instroomwijzigingen en Nuke zijn geen klassieke skills en tellen niet mee als skill. Bij een gelijk hoofdresultaat delen spelers hun rangnummer.

Een poging kan meerdere records verbeteren. De drie records blijven onafhankelijk van het opgeslagen persoonlijke reddingsrecord, zodat een oplossing met minder skills of tijd bewaard blijft als daarbij minder lemmings worden gered. Bestaande opgeslagen geslaagde replays worden één keer ingelezen; eerder niet opgeslagen pogingen kunnen niet worden teruggehaald.

De normale game stuurt oefenpogingen en afgespeelde replays niet in. De server controleert de levelmetadata, de replayvorm, het aantal geredde lemmings, de vereiste drempel en de tijdgrenzen. Het is een scorebord voor vertrouwde gebruikers: replays worden niet opnieuw door een server-simulatie afgespeeld en de ranglijst is niet fraudebestendig tegen zelfgemaakte API-verzoeken.

## Verificatie en GitHub

Voer vanuit de projectmap uit:

```sh
sh check-project.sh
```

Dit installeert dependencies, bouwt de game en voert tests uit met Node 24 in een tijdelijke Docker-container. Node 18 op de host hoeft niet te worden vervangen. De tests gebruiken tijdelijke databases en controleren rolbeveiliging, eigen wachtwoordwijziging, sessie-intrekking, accountbeheer, de drie aparte challenge-records, gedeelde rangnummers, uitsluiting van oefenpogingen, back-updownloads, dagelijkse planning, bewaartermijn en herstelbaarheid van de SQLite-kopie.

Het gecontroleerd toevoegen, committen en pushen van broncode en documentatie staat in [GITHUB.md](GITHUB.md). De echte `.env`, databases en back-ups horen niet in Git. De build en servercontroles zijn getest; Docker Compose zelf moet op jouw server worden uitgevoerd.
