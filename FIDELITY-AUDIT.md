# Getrouwheidscontrole Lemming Rescue

Gecontroleerd op 30 september 2026. De game is een browserimplementatie met 120 speelposities voor de oorspronkelijke Amiga-singleplayercampagne: 30 per moeilijkheid. Het origineel hergebruikt 80 unieke levelindelingen; varianten staan als aparte levels in de browsergame. Het is geen cycle-exacte Amiga-emulator.

## Leveldata en beeld

| Onderdeel | Herkomst en controle |
|---|---|
| Fun, Tricky, Taxing en Mayhem | 120 Amiga-levelslots met plaatsingen, begincamera, lemmingaantallen, doelen, tijd, release rate en skills. De Amiga-bestanden leveren 80 unieke singleplayerindelingen; herhalingen blijven aparte levelslots. |
| Terrein | Alle vijf Amiga-stijlen met de oorspronkelijke 16-kleurenpaletten, 273 afzonderlijk geplaatste pixelstukken, terreinmaskers en plaatsingsvolgorde. De renderer gebruikt transparante bronpixels en laat de stukken weg wanneer terrein wordt uitgegraven. |
| Objecten | Originele Amiga-ingangen, uitgangen, decoratie, water, vuur, vallen en eenrichtingsborden met frame- en triggerdata. Vloeistofoppervlakken komen uit de volledige animatieframes; er worden geen labels over het level getekend. |
| Personages | De aangeleverde 320 × 374 spritesheet is ongewijzigd gebleven. `sprite-atlas.js` bevat pixelgeverifieerde uitsneden, framevolgordes en native voetankers voor beide richtingen. Vier beschadigde ripframes, de sprongen en de explosie zijn uit originele Amiga-records hersteld. Alle 337 oorspronkelijke framevormen en posities worden onafhankelijk met Amiga-data vergeleken; zie `SPRITE-AUDIT.md`. |
| Destructie | Basher-, miner- en explosiemaskers zijn uit de Amiga Code-data gehaald. De eerste Basher-frame en één explosiepixel verschillen van de DOS-variant; de Amiga-versie is behouden. De acht-bij-acht countdowncijfers zijn nog het als DOS geïdentificeerde masker. |

De eerste drie Amiga-levelrecords komen byte voor byte overeen met de passende DOS-records. De Amiga-plaatsingen van Fun 4 verschillen op 50 bytes en die van Fun 5 op 34 bytes van de DOS-records; de Amiga-data bepaalt de getoonde levels.

## Simulatie en bediening

De vaste spelstap duurt 3/50 seconde, passend bij drie stappen per 50 Hz Amiga-PAL-framecadans. Lemmings bewegen op integer wereldpixels en skillanimaties veranderen de terreinmaskers op animatiefases. Loopstappen, treden, vallen, klimmen, optrekken, bouwen, graven, bashen, mijnen, blockers, traps, staal, eenrichtings-terrein en exits hebben afzonderlijke logica.

De bomber telt tijdens zijn huidige toestand af, speelt daarna de Oh-no-animatie af en wordt na één explosie één keer als verloren geteld. Een bomber die nog valt, explodeert direct wanneer de teller afloopt. Nuke bevestigt met twee handelingen, stopt nieuwe instroom en wijst bestaande lemmings achtereenvolgens een afzonderlijke teller toe. De tijdslimiet beëindigt het level zonder automatisch Nuke in te schakelen.

De desktop- en aanraakbediening ondersteunen skillkeuze, lemmingselectie, Tab/Enter-cycling vanaf het speelveld, selectie van alleen walkers met Shift, horizontaal en verticaal pannen, klikbare minimap en zoom. De statusbalk en skillbudgetten worden uit de simulatiestand bijgewerkt. Oefenstand kan vijf seconden terug, stapsgewijs vooruit en naar een gekozen tick; pogingen waarin oefenstand is gebruikt worden niet opgeslagen.

## Audiovisuele data en voortgang

De vijf meegeleverde Amiga-tracks rouleren door de levelcatalogus. De 20 meegeleverde effecten zijn Amiga-opnames die voor browserafspelen naar PCM zijn geconverteerd. Een moderne browser mengt effecten en muziek tegelijk; de oorspronkelijke Amiga schakelde de muziek en effecten op een andere manier om.

De site gebruikt de eigenaarstoegang van de bestaande privé-site en D1 voor beste resultaten en replays. De browser bewaart alleen apparaatvoorkeuren zoals audio-instellingen. Replaybestanden gebruiken vaste ticks en gevalideerde skill-, rate- en Nuke-opdrachten.

## Browsercontrole

34 browserchecks slaagden op 30 september 2026. Ze omvatten de metadata van alle 120 levels, het laden van ieder levelrecord, alle 337 Amiga-spriteframevormen en native voetankers, actie-/richtingkoppelingen, valanimaties bij ingang en landing, parachuteloop, het einde van dood-/uitgangsanimaties, treden, wandbotsing, buildertiming, staal, eenrichtingsgraafrichting, bomber, basher, miner, digger, blockers, water, vuur, trapcooldown, exit, Nuke, timeout, snapshots, replaychecksums en de voortgangs-API. Daarnaast slaagden oplossingssimulaties voor Fun 1 (één strategische Digger), Fun 2 (alle Floaters), Fun 3 (meerdere Blockers), Fun 4 (Climbers en de ene Miner) en Fun 5 (Bashers).

De preview is ook via de echte spelpagina bediend: levelkeuze, start/pauze, skillselectie, toewijzing aan een lemming en de leesbare HUD zijn gecontroleerd. De QA-route staat niet in de productiebuild.

## Resterende verschillen

- De 20 aparte Amiga-tweepelerslevels zijn niet opgenomen in deze singleplayergame.
- De Amiga-exclusieve varianten van vijf special-graphicslevels zijn nog niet onafhankelijk gereconstrueerd; de campagne gebruikt daar de aanwezige levelrecords en gedeelde levelgrafiek.
- De 50/3 cadans en de gereconstrueerde botsingen benaderen Amiga-PAL-speltempo; de volledige 68000-gamecode is niet stap voor stap geëmuleerd.
- De beschikbare Amiga-HUD-achtergrondpanelen zijn niet als exacte productie-interface gebruikt; de onderbalk is een leesbare, aanraakvriendelijke browser-HUD.
- De moderne audio-output wijkt af van het historische geluidsmengsel.

## Onderzoeksbronnen

- Mindless, oorspronkelijke Amiga-levelrip: https://www.camanis.net/lemmings/files/rips/levels/amiga_lemmings_levels.zip
- SPS 0132 Amiga-diskrip: https://www.camanis.net/lemmings/files/rips/disks/amiga_lemmings_disk_rips_decrunched.7z
- Uitpak- en decodeergegevens: `ASSET-PROVENANCE.md` en `public/assets/audio/provenance.json`.
- Originele Amiga-handleiding: https://www.lemonamiga.com/doc/lemmings/994
- StrategyWiki, Fun 1–5: https://strategywiki.org/wiki/Lemmings/Fun_Levels_1-5
- Amiga-muziekopnames, jkapp76: https://www.lemmingsforums.net/index.php?topic=6376.0
- Amiga-effectopnames, The Tomato Watcher: https://www.lemmingsforums.net/index.php?topic=6512.0
- Framegedreven skillreferentie, MIT: https://github.com/tomsoftware/Lemmings.ts
