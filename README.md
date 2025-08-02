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

The server reads credentials and session configuration from environment variables. These are optional and default to development-friendly values:

- `ADMIN_USERNAME` – username for the admin login (defaults to `admin`)
- `ADMIN_PASSWORD` – password for the admin login (defaults to `password`)
- `SESSION_SECRET` – secret used to sign session cookies (defaults to `gallerysecret`)
- `USE_DEMO_AUTH` – set to `true` to automatically log into admin pages

Set these variables before starting the server to override the defaults.

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
SQLite database.

## License

FineArtSuite is released under the [ISC License](LICENSE).
