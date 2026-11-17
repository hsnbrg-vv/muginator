# Muginator

A pourover brewing helper for iPhone: log a brew's setup, time it phase by phase, rate it, and dial in each coffee over time. The full spec is in [muginator.md](muginator.md).

## Develop

```bash
npm install
npm run dev
```

To try it on the iPhone over local Wi-Fi, run `npm run dev -- --host` and open the "Network" address it prints.

```bash
npm test          # unit tests (timer, calculations, storage, backup)
npm run build     # type-check and production build into dist/
npm run icons     # regenerate PNG icons from public/icon.svg
```

## Deploy to GitHub Pages

1. Create an empty GitHub repository and push this one to it.
2. In the repository, go to **Settings → Pages** and set **Source** to **GitHub Actions**.
3. Every push to `main` runs `.github/workflows/deploy.yml`. It tests, builds with the right base path (`/<repo-name>/`) and publishes.
4. On the iPhone, open `https://<user>.github.io/<repo-name>/` in Safari, then **Share → Add to Home Screen**.

## Data

Brews live only on the phone, in IndexedDB under the site's address. Use **Settings → Export** regularly to save a JSON backup to Files or iCloud Drive. Renaming the repository changes the address, and the app would then start empty, so export first and import afterwards.
