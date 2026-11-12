# BitTune

Compose de la musique chiptune, avec les 4 voies des vieilles consoles 8 bits.

*English version: [README.en.md](README.en.md)*

![BitTune](screenshots/1.jpg)

## Les voies

- **Carré 1** et **Carré 2** : la mélodie et l'accompagnement. Trois formes d'onde : rapport cyclique 12,5 %, 25 % ou 50 % (du plus nasillard au plus rond).
- **Triangle** : la basse, une octave plus bas.
- **Bruit** : les percussions (grosse caisse, caisse claire, charleston, cymbale), tirées d'un bruit à registre comme celui de la NES.

Chaque voie a son volume. Les notes des autres voies restent visibles en pâle pour se repérer.

## Composer

- La grille fait 32 pas (8 temps) sur deux octaves, de do3 à do5.
- **Clic** pour poser une note (on l'entend), **glisser vers la droite** pour la tenir, **clic droit** pour l'effacer.
- 4 motifs, **A**, **B**, **C** et **D**, et un **ordre** libre (par exemple `AABACD`, 64 au plus).
- **Tempo** de 60 à 240 bpm. **Espace** : lecture ou pause ; la lecture tourne en boucle et suit le motif joué.

## Exporter

**Exporter WAV** rend tout le morceau en stéréo 44,1 kHz.

## Données

Les motifs, l'ordre, le tempo et les réglages des voies sont gardés dans le dossier du plugin. Autorisation : `storage` seulement.
