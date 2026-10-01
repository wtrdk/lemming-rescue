# Zelf hosten met Docker Compose

Vereist: Docker Engine met de Docker Compose-plugin. De game draait in één container; er is geen Cloudflare-account nodig. Scores en replays staan lokaal in `./data/progress.sqlite` en blijven bewaard wanneer de container wordt vervangen.

## Starten op een eigen server

1. Kopieer de projectmap naar je server.
2. Start vanuit die map:

   ```sh
   docker compose up -d --build
   ```

3. Open `http://localhost:8080`. Het hostpoortnummer is standaard alleen op de server zelf bereikbaar.

Bekijk status en logboek met `docker compose ps` en `docker compose logs -f`. Stop de game met `docker compose down`; de opgeslagen voortgang in `./data` blijft staan. Maak voor een back-up eerst de container kort stil met `docker compose stop`, kopieer daarna `data/progress.sqlite` en start weer met `docker compose start`.

## Via Nginx Proxy Manager

Deze Compose-opstelling gebruikt standaard het Docker-netwerk `npm_default` dat op `t-rex` al voor Nginx Proxy Manager wordt gebruikt. Start de game vanuit deze map met:

```sh
docker compose -f docker-compose.yml -f docker-compose.npm.yml up -d --build
```

Maak in Nginx Proxy Manager een Proxy Host met forward hostname `lemming-rescue`, poort `8080` en schema `http`. Stel daar je domein en HTTPS-certificaat in. De hostpoort blijft aan `127.0.0.1` gebonden; Nginx Proxy Manager bereikt de container via het interne Docker-netwerk. Voor een andere Docker-server zonder `npm_default` gebruik je alleen `docker-compose.yml`.

## Instellingen en bijwerken

- Wijzig `LEMMING_RESCUE_PORT` in een `.env`-bestand om de lokale hostpoort te veranderen. Dit wijzigt alleen de poortbinding op `127.0.0.1`.
- Maak desgewenst dat `.env`-bestand met `cp .env.example .env`.
- Haal een nieuwere projectversie op en voer `docker compose up -d --build` opnieuw uit. De bestaande `./data`-map wordt hergebruikt.
- De image-tag in `docker-compose.yml` volgt de versie van dit project. Na een nieuwe projectversie wordt die tag mee bijgewerkt.

Wanneer je de Nginx Proxy Manager override gebruikt, voeg bij vervolgcommando's dezelfde twee `-f`-opties toe, bijvoorbeeld `docker compose -f docker-compose.yml -f docker-compose.npm.yml down`.

De gehoste Sites-versie blijft los hiervan privé. Docker gebruikt SQLite; de gehoste versie blijft de door Sites beheerde D1-opslag gebruiken.
