# De private GitHub-repository bijwerken

De repository voor dit project is `git@github.com:wtrdk/lemming-rescue.git`. In de bestaande installatie op `t-rex` heet de remote `github` en is de branch `main`. Een download of uitgepakt updatepakket staat niet automatisch op GitHub: commit en push de bronbestanden vanuit `/opt/lemmings`.

## Gewijzigde bestanden controleren

```sh
cd /opt/lemmings
git remote -v
git status --short
git diff --stat
```

De bestaande remote hoeft niet opnieuw te worden toegevoegd. Bij een fout adres verander je het met `git remote set-url github git@github.com:wtrdk/lemming-rescue.git`.

Voer voor deze versie build en tests uit met Docker:

```sh
sh check-project.sh
```

Het script gebruikt Node 24 en installeert de builddependencies. Node 18 op de host is hiervoor niet geschikt, maar kan gewoon blijven staan.

## Privébestanden buiten Git houden

`.env`, `data/`, `backups/`, `node_modules/`, `dist/` en tijdelijke data-back-ups horen niet bij de broncode. De documentatie-update bevat `install-docs.sh`; dit script vult de Git- en Docker-uitsluitingen aan zonder jouw bestaande regels te vervangen:

```sh
sh install-docs.sh
```

Controleer of privébestanden al gevolgd worden:

```sh
git ls-files -- .env data backups
```

Als dit bestanden toont, houdt `.gitignore` die bestaande bestanden niet vanzelf buiten de repository. Haal ze uit de Git-index zonder lokale bestanden te verwijderen:

```sh
git rm --cached --ignore-unmatch .env
git rm -r --cached --ignore-unmatch data backups
```

Dit verwijdert ze niet uit eerdere commits. Als een echt wachtwoord al gecommit was, wijzig dat wachtwoord ook. Controleer bij eventuele andere `.env`-varianten of die al gevolgd worden.

## Broncode en documentatie toevoegen

Voor de huidige volledige versie:

```sh
git add README.md DOCKER.md MULTIUSER.md FEATURES.md GITHUB.md .env.example
git add Dockerfile docker-compose.yml docker-entrypoint.sh .gitignore .dockerignore
git add install-features.sh install-docs.sh check-project.sh server/
```

Heb je ook het Nginx Proxy Manager override-bestand aangepast, voeg dan `docker-compose.npm.yml` toe. De audit- en bronvermeldingsdocumenten voeg je alleen toe als je die inhoudelijk hebt gewijzigd.

Controleer vervolgens alle klaarstaande wijzigingen, inclusief eventueel eerder gestagede bestanden:

```sh
git diff --cached --name-status
git diff --cached --stat
```

Er moeten broncode, documentatie en voorbeeldconfiguratie in staan, geen echte wachtwoorden of databases. Een verwijdering van bijvoorbeeld het oude distributiearchief zie je als `D`; beoordeel of die verwijdering bewust is voordat je commit.

## Commit en push

```sh
git commit -m "Voeg accountbeheer, backups, scorebord en bijgewerkte documentatie toe"
git push github main
```

Als Git meldt dat er niets te committen is, controleer met `git status` of de veranderingen al in een eerdere commit zitten. Je kunt dan alleen nog hoeven pushen. Controleer daarna:

```sh
git status --short
git log -1 --oneline
git rev-parse HEAD
git ls-remote github refs/heads/main
```

De hash van `HEAD` en de hash van de remote `main` horen gelijk te zijn na een succesvolle push. Een schone werkmap geeft geen regels bij `git status --short`. Controleer op GitHub ook dat de repository **Private** blijft.

## Veelvoorkomende meldingen

- **Author identity unknown:** stel repo-lokaal `git config user.name "Wouter Dijk"` en `git config user.email "JOUW-GITHUB-NOREPLY-ADRES"` in. Het exacte adres staat op [GitHub Settings → Emails](https://github.com/settings/emails).
- **GH007 / private email:** configureer je eigen GitHub-noreply-adres. Als alleen de nog niet gepushte laatste commit het verkeerde adres heeft, pas je die aan met `git commit --amend --reset-author --no-edit`. Bij meerdere betrokken commits is alleen de laatste aanpassen niet voldoende.
- **Permission denied (publickey):** test met `ssh -T git@github.com` en controleer of de publieke SSH-sleutel bij account `wtrdk` is toegevoegd.
- **Remote github already exists:** de lokale remote bestaat al; gebruik `git remote -v` en eventueel `git remote set-url`, niet opnieuw `git remote add`.
- **Push rejected / non-fast-forward:** forceer de push niet. Controleer eerst de verschillen met de remote en werk die samen voordat je pusht.

## Volgende updates

Werk op dezelfde manier: wijzigingen bekijken, testen, expliciet toevoegen, de staged lijst controleren, committen en pushen. De game op een andere server wordt pas bijgewerkt nadat daar de nieuwe broncode is opgehaald en Docker opnieuw is gebouwd. Zie [DOCKER.md](DOCKER.md) voor de updateprocedure en de voorafgaande data-back-up.
