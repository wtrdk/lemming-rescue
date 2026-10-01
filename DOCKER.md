# Zelf hosten met Docker Compose

Vereist: Docker Engine met de Docker Compose-plugin. De app draait in één container met Node 24. Node of npm op de host is niet nodig voor bouwen of draaien. De database staat in `./data/progress.sqlite`; automatische back-ups staan in `./backups`. Beide hostmappen blijven bestaan wanneer de container wordt vervangen.

## Nieuwe installatie

Kopieer of clone de volledige broncode. Voor de private GitHub-repository heb je een werkende SSH-sleutel met toegang nodig:

```sh
git clone git@github.com:wtrdk/lemming-rescue.git
cd lemming-rescue
cp .env.example .env
nano .env
```

Kies `LEMMING_RESCUE_USERNAME` en een uniek `LEMMING_RESCUE_PASSWORD` van 12–256 tekens. De eerste gebruiker wordt beheerder. Start daarna:

```sh
docker compose up -d --build
```

Open `http://localhost:8080` op de server. Standaard is de hostpoort alleen aan loopback gebonden. Via de login meld je aan met je gebruikersnaam en wachtwoord. Nieuwe accounts maak je aan op **Beheer**. Er is geen openbare registratie.

De initiële gebruikersnaam en het initiële wachtwoord worden alleen gebruikt als de gebruikerstabel leeg is. Later aanpassen in `.env` wijzigt geen bestaand account. Gebruik **Mijn account**, **Beheer** of het terminalcommando uit [MULTIUSER.md](MULTIUSER.md). Na de eerste geslaagde start mag het initiële wachtwoord uit `.env` worden verwijderd.

## Bestaande installatie op t-rex

Behoud je huidige `.env`; vervang die niet door het voorbeeldbestand. Voor direct LAN-gebruik op `t-rex` staan hierin:

```dotenv
LEMMING_RESCUE_BIND=192.168.2.75
LEMMING_RESCUE_PORT=8280
```

Bij de eerste logininstallatie voeg je ook `LEMMING_RESCUE_PASSWORD` toe. `LEMMING_RESCUE_USERNAME` is standaard `wtrdk`. De eerdere gedeelde scores gaan bij de migratie naar het eerste account; het eerste bestaande account wordt beheerder.

Bij een updatepakket volg je [FEATURES.md](FEATURES.md). Het installatiescript maakt vooraf een kopie van de bestaande data. Voor een update vanuit Git gebruik je de procedure hieronder.

## LAN en Nginx Proxy Manager

Met de bovenstaande LAN-instellingen open je `http://192.168.2.75:8280`. De container blijft intern op `8080` luisteren; verander daarom de Compose-omgeving `PORT` niet. Een wijziging van `.env` pas je toe met `docker compose up -d`.

Voor Nginx Proxy Manager gebruik je het aparte override-bestand dat de app aan het bestaande netwerk `npm_default` koppelt:

```sh
docker compose -f docker-compose.yml -f docker-compose.npm.yml up -d --build
```

De basisconfiguratie alleen gebruikt dit externe netwerk niet. Stel in Nginx Proxy Manager een Proxy Host in met forward hostname `lemming-rescue`, poort `8080`, schema `http`, jouw domein en een HTTPS-certificaat. Gebruik HTTPS buiten je vertrouwde thuisnetwerk. Nginx Proxy Manager bereikt de container via het interne Docker-netwerk; daarvoor kun je `LEMMING_RESCUE_BIND=127.0.0.1` laten staan.

Gebruik voor latere Compose-commando's dezelfde twee `-f`-opties als je met deze override hebt gestart. De override verandert je ingestelde hostbinding niet.

## Instellingen

| Variabele in `.env` | Standaard | Betekenis |
| --- | --- | --- |
| `LEMMING_RESCUE_BIND` | `127.0.0.1` | Hostadres waaraan de gepubliceerde poort wordt gebonden |
| `LEMMING_RESCUE_PORT` | `8080` | Hostpoort; containerpoort blijft `8080` |
| `LEMMING_RESCUE_USERNAME` | `wtrdk` | Gebruikersnaam voor het eerste account |
| `LEMMING_RESCUE_PASSWORD` | Geen | Vereist bij een lege gebruikerstabel; 12–256 tekens |
| `LEMMING_BACKUP_KEEP_DAYS` | `14` | Bewaartermijn, 1–365 dagen |
| `LEMMING_BACKUP_HOUR` | `3` | Uur voor de dagelijkse back-up, 0–23 |
| `LEMMING_BACKUP_TIMEZONE` | `Europe/Amsterdam` | Tijdzone voor de dagelijkse planning |

Het `.env`-bestand bevat privé-instellingen en hoort niet in Git. Gebruik `docker compose config --quiet` om de configuratie te controleren zonder de ingevulde waarden af te drukken.

## Bedienen en controleren

```sh
docker compose ps
docker compose logs --tail=50 lemming-rescue
docker compose port lemming-rescue 8080
curl --fail http://192.168.2.75:8280/api/health
```

Pas het adres in de laatste opdracht aan bij een andere binding. Een gezonde server antwoordt met `{"status":"ok"}`. De logmelding over `0.0.0.0:8080` gaat over de containerpoort; die hoeft niet gelijk te zijn aan je hostpoort.

`docker compose stop` stopt de app. `docker compose start` start een bestaande container opnieuw; dit bouwt geen gewijzigde code en verwerkt geen nieuwe omgevingsinstellingen. Daarvoor gebruik je `docker compose up -d --build`. `docker compose down` verwijdert de container en het projectnetwerk; de hostmappen met data en back-ups blijven behouden.

## Bijwerken vanuit Git

Commit en push eerst eventuele eigen bronwijzigingen volgens [GITHUB.md](GITHUB.md). Gebruik `git pull` pas nadat je lokale wijzigingen zijn verwerkt. Bewaar vóór een upgrade een kopie van de volledige data-map, terwijl de container gestopt is:

```sh
cd /opt/lemmings
docker compose stop
mkdir -p "$HOME/lemmings-backups"
cp -a data "$HOME/lemmings-backups/before-update-$(date +%Y%m%d-%H%M%S)"
git pull --ff-only github main
docker compose up -d --build
```

Bij een database-upgrade is teruggaan naar oudere code soms alleen mogelijk door ook de vooraf gemaakte data-back-up terug te zetten. Herstelstappen staan in [FEATURES.md](FEATURES.md).

## Testen en opslag

```sh
sh check-project.sh
```

Dit voert build en tests uit met Node 24 in een tijdelijke Docker-container. De Node-versie op `t-rex` mag 18 blijven. Accounts, persoonlijke scores en challenge-records staan samen in SQLite. Dagelijkse back-ups zijn consistente kopieën van die database; download en herstel staan beschreven in [FEATURES.md](FEATURES.md).

De bestaande Sites-versie blijft afzonderlijk privé en gebruikt D1. Zelf hosten met Docker publiceert die Site niet.
