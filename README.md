# MRK Test — Google Sheets / Drive → GitHub Pages

Google Sheets is the CMS and Google Drive stores the originals. GitHub Actions downloads published content, optimizes images to WebP (maximum 2048px, quality 85), commits a snapshot to `content/`, and publishes the website. Visitors read only GitHub Pages files; no Google account or live Google API request is required.

## Editing

[Open the admin spreadsheet](https://docs.google.com/spreadsheets/d/1i9dwwYMbeUD40XT2ykHrO4tGhXDFtgcO60ugCyST8BA/edit).

### Pages

Columns: `slug`, `title`, `folder`, `published`, `spaceAbove`.

Add a row with a unique lowercase slug (e.g. `concerts`), menu title, Drive folder URL, and `published=TRUE`. Standard checkboxes work for both boolean fields. All folders must be inside [MRK Test](https://drive.google.com/drive/folders/1chVqAXwmi-lDIRuQuwTebpDIRXT-O_aQ).

Each immediate subfolder becomes a photoshoot using its folder name as title. Photos directly in the page folder form an additional album. Images are sorted by filename; up to 200 images per photoshoot. Photoshoot subfolders are not recursively scanned.

### Works (optional)

Columns: `id`, `page`, `title`, `folder`, `video`, `coverUrl`, `description`, `published`.

Use a unique permanent `id`, a Pages slug in `page`, and a folder within MRK Test. Explicit rows override automatic discovery of the same folder. `video` accepts Vimeo, YouTube or MP4 links. Video players remain external embeds; videos are not copied into Git. `coverUrl` overrides the first photo (HTTPS image URLs only).

### Home (optional)

Columns: `title`, `workId`, `imageUrl`, `published`.

`workId` references a work ID from `content/site.json`. With no valid published Home rows, all works appear on the homepage.

## Publication

The workflow **Sync Google content and publish** runs approximately every 15 minutes. GitHub may delay scheduled jobs; the interval is not a delivery guarantee. After a successful publication, reload the site to see changes.

For immediate publication, open [GitHub Actions](https://github.com/blackreaper228/mrk-test/actions/workflows/publish.yml), click **Run workflow**, choose `main`, and run it. This requires repository write access. There is no Publish button in the spreadsheet yet.

The workflow also publishes changes pushed to `main`. It commits content only when the snapshot changes and skips scheduled deployments when nothing changed. Failed Google downloads leave the previously deployed website intact. GitHub Pages uses the **GitHub Actions** deployment source, not branch builds.

The public Apps Script endpoint in `config.json` is used only by the synchronization script. It serves only published content within the configured Drive root. Do not publish private content. Originals remain unchanged on Drive. Large originals above 6 MiB currently use Drive thumbnails through the existing endpoint.

Standard GitHub-hosted runners are free for this public repository. Only standard Ubuntu runners are used, with no paid services or persistent Actions cache. The Pages artifact has one-day retention. Keep the test gallery small: repository size, Pages bandwidth and Google quotas still apply. Scheduled workflows in inactive public repositories may be disabled after 60 days without repository activity.

## Local checks

```text
pip install -r requirements.txt
python -m unittest discover -s tests -p 'test_*.py'
node tests/backend.test.cjs
python scripts/sync_content.py
python -m http.server 4174 --bind 127.0.0.1
```

The existing Apps Script remains bound to the admin spreadsheet. Its source is in `apps-script/`; the deployed read-only endpoint continues to use the configured Google account to read Sheets and Drive. No additional API keys or credentials are needed for the workflow beyond GitHub's built-in repository token.
