# Welcome to your Lovable project

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Open your project in the [Lovable editor](https://lovable.dev) and keep building.

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: connect the project to GitHub and every change made in Lovable is committed straight to your repository.
- **Full ownership**: this code is yours. Push to your repository and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Deploy to Netlify

The build settings are committed in `netlify.toml`, so Netlify needs nothing typed into its dashboard:

```sh
npm ci && npm run build   # build command — from netlify.toml
dist                      # publish directory — from netlify.toml
```

`NITRO_PRESET = "netlify"` in the same file tells the build to produce Netlify's serverless format; without it the build targets Cloudflare instead and the analysis calls never start.

1. Put this code in a GitHub repository.
2. In Netlify: **Add new site → Import an existing project → deploy with GitHub**, then pick the repository.
3. Add `LOVABLE_API_KEY` under **Site settings → Environment variables** — it is the only value the AI analysis needs, and it must never live in the repository.
4. Confirm `.env` is not in the repository (it is listed in `.gitignore`). It holds backend connection values this demo never reads, and a committed `.env` can override the environment variables you set in Netlify. If the file is already committed, remove it from the repository and redeploy.
5. Deploy. Every push to the branch redeploys automatically.

Reports are stored in the visitor's own browser, so there is no database to provision or migrate.

## Built with

- TanStack Start
- TypeScript
- React
- Tailwind CSS
