# Accounts en toegangsbeheer

De Docker-versie gebruikt persoonlijke accounts met afzonderlijke scores en replays. Er is geen openbare registratie. Gebruikersbeheer is beschikbaar voor beheerders op `/admin` en voor iemand met toegang tot Docker op de server.

## Eerste account en migratie

Bij een lege gebruikerstabel worden de waarden uit `.env` gebruikt:

```dotenv
LEMMING_RESCUE_USERNAME=wtrdk
LEMMING_RESCUE_PASSWORD=kies-een-eigen-uniek-lang-wachtwoord
```

De eerste gebruiker wordt beheerder. Als je de eerdere login met alleen een wachtwoord gebruikte, wordt dat wachtwoord gekoppeld aan de ingestelde gebruikersnaam, standaard `wtrdk`. De eerdere gedeelde scores en replays gaan bij de migratie naar het eerste account. Bij een upgrade van de eerdere multiuserversie krijgt het eerste bestaande account de beheerdersrol. Andere gebruikers beginnen of gaan verder met hun eigen voortgang.

Maak vooraf een data-back-up volgens [DOCKER.md](DOCKER.md) of gebruik het updatepakket met installatiescript uit [FEATURES.md](FEATURES.md). Je bestaande `.env` wordt niet vervangen. De initiële instellingen veranderen na het aanmaken geen bestaand account; het initiële wachtwoord mag na de eerste geslaagde start uit `.env` worden verwijderd.

## Rollen en pagina's

| Mogelijkheid | Speler | Beheerder |
| --- | --- | --- |
| Spelen, eigen voortgang en replays | Ja | Ja |
| Privé scorebord bekijken | Ja | Ja |
| Eigen wachtwoord wijzigen op `/account` | Ja | Ja |
| Andere accounts en rollen beheren op `/admin` | Nee | Ja |
| Back-ups bekijken, maken en downloaden | Nee | Ja |

Een beheerder kan spelers en extra beheerders aanmaken. Bij het verwijderen van een gebruiker moet de gebruikersnaam worden bevestigd; ook diens scores en challenge-records worden verwijderd. Op het web kun je je eigen account niet verwijderen of je eigen rol wijzigen. De laatste beheerder blijft ook via het terminalbeheer beschermd.

## Wachtwoorden wijzigen

Op **Mijn account** vul je het huidige wachtwoord en tweemaal het nieuwe wachtwoord in. Op **Beheer** kan een beheerder het wachtwoord van een andere gebruiker opnieuw instellen. Na beide wijzigingen moeten alle bestaande sessies van die gebruiker opnieuw aanmelden.

Gebruikersnamen hebben 3–32 tekens: letters, cijfers, punt, underscore of streepje, beginnend met een letter of cijfer. Hoofdletters worden naar kleine letters omgezet. Wachtwoorden hebben 12–256 tekens. De database slaat willekeurig gezouten scrypt-hashes op met N=32768, r=8 en p=3, volgens het [OWASP-profiel](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html).

## Beheer via de terminal

Voer de opdrachten uit in `/opt/lemmings`. Wachtwoorden worden interactief en verborgen gevraagd; gebruik hiervoor geen `-T` en zet geen wachtwoord in commandoregelargumenten.

```sh
docker compose exec --user node lemming-rescue node server/manage-users.js list
docker compose exec --user node lemming-rescue node server/manage-users.js add guusje
docker compose exec --user node lemming-rescue node server/manage-users.js password guusje
docker compose exec --user node lemming-rescue node server/manage-users.js admin guusje
docker compose exec --user node lemming-rescue node server/manage-users.js user guusje
docker compose exec --user node lemming-rescue node server/manage-users.js delete guusje
```

`admin` maakt een beheerder; `user` zet een beheerder terug naar speler. `delete` vraagt de gebruikersnaam ter bevestiging. De laatste gebruiker en laatste beheerder kunnen niet worden verwijderd. Voeg bij Nginx Proxy Manager dezelfde Compose-override-opties toe als bij starten.

Als je je eigen wachtwoord bent vergeten, kan iemand met toegang tot de server het opnieuw instellen:

```sh
docker compose exec --user node lemming-rescue node server/manage-users.js password wtrdk
```

## Sessies en privacy

De server geeft een willekeurige sessiecookie met HttpOnly, SameSite=Strict en Secure bij HTTPS. Sessies verlopen na 12 uur, bij uitloggen en bij een serverherstart. Wachtwoordwijziging of accountverwijdering maakt de betreffende sessies ongeldig. De rol wordt bij elk verzoek opnieuw gecontroleerd.

Tien mislukte inlogpogingen vanaf dezelfde verbinding binnen 15 minuten blokkeren nieuwe pogingen tijdelijk. Achter een reverse proxy kunnen meerdere bezoekers hetzelfde limiet delen. Voor het controleren van het huidige wachtwoord bij een eigen wachtwoordwijziging geldt eveneens een pogingenlimiet.

De server kiest de eigenaar van scores vanuit de sessie; een gebruiker kan geen andere eigenaar opgeven in het verzoek. Accountpagina's, scores en ranglijsten worden niet door gedeelde caches bewaard. Alleen `/api/health` is anoniem bereikbaar en meldt uitsluitend de serverstatus. Gebruik HTTPS buiten je vertrouwde thuisnetwerk.

Back-ups bevatten wachtwoordhashes, rollen en voortgang en blijven privé. Na een herstel moeten alle gebruikers opnieuw aanmelden; de accounts en wachtwoorden zijn dan die van het gekozen back-upmoment. Zie [FEATURES.md](FEATURES.md). De Sites-versie behoudt haar afzonderlijke bestaande toegangsbeveiliging.

## Testen en repositorybeheer

Voer `sh check-project.sh` uit voor tests en build via Node 24 in Docker; de Node-versie op de host hoeft niet aangepast te worden. De controles werken met tijdelijke databases. Het bijwerken van de private GitHub-repository staat in [GITHUB.md](GITHUB.md).
