# MRK Test — Google Sheets + Drive CMS

A separate, tiny portfolio test. No Three.js, 3D models, build tools or Pages CMS dependency. Google Sheets is the editor; Google Drive holds photos. Google Apps Script provides a public, read-only content endpoint. No Google API key required.

## One-time Google setup

1. Create a new Google spreadsheet named **MRK Test CMS**.
2. Open **Extensions → Apps Script**. Replace Code.gs with `apps-script/Code.gs` from this repository.
3. Run `setup` and authorize it with the Google account owning the content. It uses the supplied Drive folder, moves the spreadsheet into it and adds three tabs. For an existing root folder, set Script Property `ROOT_FOLDER_ID` to its ID before running setup.
4. Add only test/public website content to this folder. Originals remain private on Drive, but the deployed endpoint serves photos from published rows to everyone.
5. **Deploy → New deployment → Web app → Execute as: Me → Who has access: Anyone**. Authorize and copy the `/exec` URL. Do not use `/dev`.
6. Open `setup.html` on the site and paste the URL for a local browser test. To connect for all visitors, put it in `config.json` as `endpoint` and commit.
7. Configure GitHub Pages: **Settings → Pages → Deploy from a branch → main → /(root)**.

## Edit the site

### Pages

Columns: `slug`, `title`, `folder`, `published`, `spaceAbove`.

Add one row per page, e.g. `photography | Photography | [Drive folder URL] | TRUE | TRUE`.
`slug` must be unique, lower-case ASCII with hyphens. Set `published` to TRUE to show the page. `spaceAbove` separates that menu item. The page appears with no Git commit; reload the site.

Upload a whole photoshoot folder inside the page's folder. Each immediate subfolder automatically becomes a photoshoot. The folder name becomes its title; JPEG/PNG/WebP files become gallery images sorted by filename. Photos directly in the page folder become an additional photoshoot. Maximum 200 images per photoshoot. Subfolders within photoshoots are not scanned recursively.

### Works (optional manual control)

Columns: `id`, `page`, `title`, `folder`, `video`, `coverUrl`, `description`, `published`.
`page` refers to a Pages slug. `id` is unique and permanent. `folder` points to a photoshoot folder within MRK Test. Use `video` for Vimeo, YouTube or a direct MP4 URL. `coverUrl` is optional. An explicit row overrides automatic discovery of that folder. Use this tab to rename a photoshoot without renaming the Drive folder or to add videos.

### Home

Columns: `title`, `workId`, `imageUrl`, `published`. `workId` points to an explicit Works ID (automatic IDs can be copied from the endpoint JSON). If this tab has no published valid rows, the homepage shows all works. `imageUrl` overrides the cover.

## Notes

- Only pages marked published and works belonging to them are served. The endpoint will not read an arbitrary folder supplied by a site visitor.
- This is a basic integration test, not an optimized production image CDN. Small photos are delivered as base64 through Apps Script; originals over 6 MiB use the smaller Drive thumbnail. Many large photos may load slowly or hit Apps Script quotas. A production version should resize/cache images outside request handling.
- Each image request currently rescans published folders. No polling or hidden background sync: reload to see spreadsheet/Drive changes.
- Never place credentials or confidential text in published rows.
- Google Workspace accounts may prohibit public web apps. Deployment permissions must be granted in Google by the owner.
- `config.json` has no endpoint initially; the site clearly displays demo mode until connected.

## Local preview

`python -m http.server 4174 --bind 127.0.0.1`

## References

[Apps Script web apps](https://developers.google.com/apps-script/guides/web)
[Read-only JSONP via Content Service](https://developers.google.com/apps-script/guides/content)
