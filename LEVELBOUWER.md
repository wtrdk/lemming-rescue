# Levelbouwer

De levelbouwer staat op `/editor.html` en is beschikbaar na aanmelden. Levels worden per eigenaar opgeslagen in SQLite; andere accounts zien ze alleen nadat de eigenaar ze met hun gebruikersnaam deelt. Een eigenaar kan de toegang weer intrekken. Een gedeeld level kan door de ontvanger worden geopend en als eigen kopie worden opgeslagen.

## Een level maken

1. Open **Levelbouwer** vanuit de link onderaan het hoofdspel.
2. Kies **Nieuw level**, geef het een naam en stel de breedte, graphics, aantallen, tijd, instroomsnelheid en skills in.
3. Kies Terrein, Object, Staal of Wissen. Plaats onderdelen met tik of klik; sleep ze om ze te verplaatsen. Rechtsklik wist een onderdeel.
4. Plaats minstens één ingang en één uitgang. De levelhoogte is 160 pixels; de breedte kan één tot vier schermen zijn.
5. Klik **Level opslaan** om het level aan je account te koppelen. Met **Verwijderen** verwijder je je eigen opgeslagen level en trek je gedeelde toegang in.

## Playtesten en delen

**Playtesten** opent dezelfde engine als de campagne in oefenstand. De poging overschrijft geen campagnevoortgang, privé scorebord of record. **Terug naar levelbouwer** bewaart de onopgeslagen werkversie in de huidige browsersessie zodat je kunt bijstellen en opnieuw testen.

Om samen met iemand anders te spelen, sla je het level op, vul je diens accountnaam in en klik je **Delen**. De ontvanger vindt het onder **Mijn levels**. Alleen de eigenaar kan het origineel aanpassen of delen intrekken. Na intrekken verdwijnt het level uit de lijst van de ontvanger. De ontvanger kan voor het intrekken een eigen kopie opslaan.

Je kunt ook JSON-bestanden downloaden en importeren. Stuur die bestanden zelf via een privé kanaal; ze worden niet openbaar gepubliceerd. De server controleert levelinstellingen en de gebruikte originele sprite-ID's bij opslaan.

## Gegevens en back-ups

Leveldata staat in dezelfde SQLite-database als accounts en voortgang (`/data/progress.sqlite` in Docker). De bestaande dagelijkse databaseback-ups nemen levels en deelrechten automatisch mee. Bij het starten maakt de server de benodigde leveltabellen aan; een aparte handmatige migratie is niet nodig.
