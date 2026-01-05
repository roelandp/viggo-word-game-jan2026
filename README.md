# Grillworstje boven de Lava

Een educatief woordspel voor kinderen om Nederlandse woorden te oefenen. Grillworstje springt naar platforms met betekenissen boven lava. Fout? Dan zakt het platform in de lava!

## Spelbeschrijving

- Kies het juiste antwoord voor elk woord door op het juiste paaltje te tikken.
- Grillworstje maakt een sprong-animatie naar je keuze.
- Goed: vrolijke animatie en score +1.
- Fout: platform zakt in lava, leven eraf, toon juiste antwoord, herhaal woord met nieuwe opties.
- 3 levens per spel. Game Over bij 0 levens.

## Technisch

- Static site: HTML, CSS, JavaScript (ES modules).
- PWA: installeerbaar op iPad via "Zet op beginscherm".
- Offline speelbaar dankzij service worker.

## Bestandsstructuur

- `index.html`: Hoofdpagina
- `style.css`: Styling en animaties
- `app.js`: Game logica
- `words.js`: Woordenlijst (vervang deze door je eigen lijst)
- `manifest.webmanifest`: PWA configuratie
- `sw.js`: Service worker voor caching
- `assets/`: Iconen en evt. afbeeldingen

## Woordenlijst uitbreiden

Bewerk `words.js`. Voeg entries toe aan `wordList`:

```javascript
{
  word: "nieuw woord",
  correct: "juiste betekenis",
  wrong: [
    "fout optie 1",
    "fout optie 2",
    "fout optie 3"
  ]
}
```

Zorg voor exact 3 foute opties per woord.

## Assets vervangen

- Grillworstje: vervang `assets/grillworstje.png` en update CSS in `#grillworstje` naar `background-image: url('assets/grillworstje.png');`
- Iconen: vervang `assets/icon-192.png` en `icon-512.png` met echte PNG's (192x192, 512x512).

## Deployen naar GitHub Pages

1. Push deze repo naar GitHub.
2. Ga naar repo Settings > Pages.
3. Kies branch (meestal main) en folder / (root).
4. Save. URL wordt iets als `https://username.github.io/repo-name/`.

De app is static, dus geen build nodig.

## PWA installeren op iPad

1. Open de URL in Safari op iPad.
2. Tik "Deel" > "Zet op beginscherm".
3. Geef naam, tik "Toevoegen".
4. App verschijnt op homescreen, open als standalone app.

## Ontwikkelen

Open `index.html` in browser. Voor PWA-testen, serve via localhost (bijv. `python -m http.server`).

Service worker werkt alleen over HTTPS of localhost.