# CSRF Template Updates

The following templates were updated to ensure CSRF protection:

- `views/admin/artworks.ejs`: added hidden `_csrf` field to per-artwork edit forms.

All other templates under `views/` already include CSRF fields in forms or set `CSRF-Token` headers for JavaScript `fetch` requests.
