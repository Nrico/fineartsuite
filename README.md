# FineArtSuite

FineArtSuite is a minimal gallery website project. It now includes a basic Node.js/Express setup using EJS templates for rendering pages.

## Running the site locally

To run the Express server locally, install the dependencies and start the app:

```bash
npm install
npm start
```

The site will be available at `http://localhost:3000` by default.

## Gallery pages

Navigating directly to a path such as `/jenny` or `/leo` will display a simple gallery for that slug using placeholder data from `gallery.js`.

## Planned gallery features

The current page is only a basic landing page. Future improvements may include:

- A dedicated gallery page showing artwork thumbnails
- Upload functionality for adding new pieces
- Navigation enhancements and styling refinements
- Search and filtering tools for visitors

## Admin upload page

An `admin-upload.html` file is available for uploading new artwork. It provides fields for title, medium, dimensions, price, image upload with preview, and status. Open the file in a browser to use the form.
