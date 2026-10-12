# Wayfinder — a life DAG maker

Production: [wayfinder-life-map.vercel.app](https://wayfinder-life-map.vercel.app).

The app lives in [wayfinder/](wayfinder/README.md).

```sh
npm run dev
```

Then open http://127.0.0.1:5173. Requires Python 3 and Node.js 24. The app has no runtime dependencies.

This public version needs no signup. Each visitor starts with a blank map and saves in their own browser; JSON export/import moves plans between browsers or devices.

Run `npm run check` and `npm test` to validate the app. To deploy from this directory, sign in to the Vercel CLI and run:

```sh
npm run deploy
```

`vercel.json` serves `wayfinder/dist`, runs the checks before publishing, and applies security headers. No environment variables or database are required. Local and deployed URLs have separate browser storage, so export/import any existing local plan.
