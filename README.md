# FineArtSuite

FineArtSuite is a minimal gallery website project. The repository now ships a
small Node.js/Express application using EJS templates for rendering pages.

## Running the site locally

The project now includes a small Node.js/Express application with SQLite persistence. Install dependencies and start the server:

```bash
npm install
npm start
```

On first run the application will create a `gallery.db` SQLite file in the project
root populated with demo data. Remove this file if you want to start with an
empty database.

After running the server, visit `http://localhost:3000` in your browser to view the homepage.

### Configuration

The server reads credentials and session configuration from environment variables. Most have development-friendly defaults, but `SESSION_SECRET` must always be provided:

- `ADMIN_USERNAME` – username for the admin login (defaults to `admin`)
- `ADMIN_PASSWORD` – password for the admin login (defaults to `password`)
- `SESSION_SECRET` – secret used to sign session cookies (required; set to a secure value)
- `USE_DEMO_AUTH` – set to `true` to automatically log into admin pages

Set these variables before starting the server. The application will refuse to start if `SESSION_SECRET` is not defined.

When `USE_DEMO_AUTH` is disabled (the default), all `/dashboard` routes require
logging in. Set the variable to `true` during development to bypass the login
form for convenience.

Flash messages are provided using the `connect-flash` middleware. These
messages give feedback after actions such as logging in or editing records.

### Sessions

Session data is persisted using [`connect-sqlite3`](https://www.npmjs.com/package/connect-sqlite3).
Running `npm install` will install this dependency and the application will
create a `sessions.db` file in the project root to store session data. Session
cookies are configured with the `secure` flag when `NODE_ENV` is set to
`production` and always use the `httpOnly` flag for improved security.

## Gallery pages

Navigating to `/demo-gallery` or another gallery slug will display a public gallery page. Gallery, artist and artwork data is loaded from the SQLite database.

## Custom domain setup

Each gallery is served from a URL in the form `https://your-domain/{gallerySlug}`. To use a custom domain for your gallery:

1. Purchase and manage your domain through a DNS provider.
2. Create a CNAME record pointing your chosen domain (for example, `gallery.yourdomain.com`) to your gallery's default URL (for example, `yourgallery.fineartsuite.com`).
3. Allow time for DNS propagation. This process can take up to 24 hours.

If you need assistance configuring a custom domain, open an issue in this repository or email the maintainers at [support@example.com](mailto:support@example.com).

## Planned gallery features

The current page is only a basic landing page. Future improvements may include:

- A dedicated gallery page showing artwork thumbnails
- Upload functionality for adding new pieces
- Navigation enhancements and styling refinements
- Search and filtering tools for visitors

## Admin upload page

After logging in you can upload new artwork at `/dashboard/upload`. The form
provides fields for the artwork details along with an image preview before
submitting.

## Sample EJS snippets

Styled navigation bar:

```ejs
<nav class="flex flex-col items-center justify-between p-4 border-b border-gray-300 md:flex-row">
  <a href="/" class="text-2xl font-bold">FineArtSuite</a>
  <div class="flex space-x-4 mt-2 md:mt-0">
    <a href="/galleries" class="hover:underline">Galleries</a>
    <a href="/artists" class="hover:underline">Artists</a>
  </div>
</nav>
```

Clean hero heading:

```ejs
<section class="text-center py-24">
  <h1 class="text-5xl font-bold mb-6">Discover Modern Art</h1>
  <p class="text-gray-600">Explore our curated collection.</p>
</section>
```

Two-column layout of artwork thumbnails:

```ejs
<div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
  <% artworks.forEach(art => { %>
    <a href="/artworks/<%= art.id %>" class="block">
      <img src="<%= art.image %>" alt="<%= art.title %>" class="w-full mb-2"/>
      <h3 class="font-semibold"><%= art.title %></h3>
    </a>
  <% }) %>
</div>
```

## Running tests

The project uses Node's built-in `test` runner for basic route tests. After installing dependencies, run:

```bash
npm test
```

This will start the application in test mode and verify that the homepage and a sample gallery page respond correctly.

## Deployment on Render

The repository includes a `render.yaml` file for deploying the app to
[Render](https://render.com). Create a new Web Service using this repository
and Render will apply the provided build and start commands. The configuration
sets default environment variables and mounts a small persistent disk for the
SQLite database. Be sure to configure a strong `SESSION_SECRET` environment
variable in your Render service; the application will not start without one.

## License

FineArtSuite is released under the [ISC License](LICENSE).
