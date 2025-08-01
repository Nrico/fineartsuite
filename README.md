# FineArtSuite

FineArtSuite is a minimal gallery website project. This repository provides a single HTML file that serves as a starting point for displaying art online.

## Running the site locally

The project now includes a small Node.js/Express application. Install dependencies and start the server:

```bash
npm install
npm start
```

After running the server, visit `http://localhost:3000` in your browser to view the homepage.

### Configuration

The server reads credentials and session configuration from environment variables. These are optional and default to development-friendly values:

- `ADMIN_USERNAME` – username for the admin login (defaults to `admin`)
- `ADMIN_PASSWORD` – password for the admin login (defaults to `password`)
- `SESSION_SECRET` – secret used to sign session cookies (defaults to `gallerysecret`)

Set these variables before starting the server to override the defaults.

## Gallery pages

Navigating to `/demo-gallery` or another gallery slug will display a public gallery page rendered from placeholder data.

## Planned gallery features

The current page is only a basic landing page. Future improvements may include:

- A dedicated gallery page showing artwork thumbnails
- Upload functionality for adding new pieces
- Navigation enhancements and styling refinements
- Search and filtering tools for visitors

## Admin upload page

An `admin-upload.html` file is available for uploading new artwork. It provides fields for title, medium, dimensions, price, image upload with preview, and status. Open the file in a browser to use the form.
