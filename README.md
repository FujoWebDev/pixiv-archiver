# PIXIV ARCHIVER

> [!CAUTION]
> This code is released for **reference only**. We might accept pull requests with bug fixes or
> improvements, but <u>won't be providing any type of support</u>.
>
> To help us get resources to provide support in the future, consider [sponsoring us on Patreon](https://www.patreon.com/essentialrandomness).

This code was originally written by [Essential Randomness](https://www.essentialrandomness.com/) as part of a
personal project. Due to "recent events", the Pixiv archive functionality has been extracted and
released. However, this code was never meant to be legible, extensible, maintainable, or correct.

Feel free to use as reference for extended functionality.

## What is this

This script:

- Takes a list of links to Pixiv art galleries (in `data/pixiv/manual_process_urls.txt`, one per line)
- Goes through them one by one and saves their metadata + images (in `src/data/pixiv/`)

It works with "single images", "albums", and "reading galleries" (?). If you're willing to risk your account
getting banned for scraping, it can also archive logged-in-only works.

> [!WARNING]
> The scripts waits inbetween opening pages to be kind to Pixiv and try to avoid getting your IP banned.
> Still, use this at your own risk and run it on a remote server if you're worried.

### How it works

This script uses [Playwright](https://playwright.dev/) to open a real browser and navigate to each
page, saving the data. It does the same things you'd do manually, just automated.

## How to run it

> [!CAUTION]
> This code was only tested on a macbook and a linux machine. It might or might not work on pure Windows, and
> it might or might not work on Windows using WSL. If you're having trouble you _could_ try changing `headless`
> to `true` in `src/lib/pixiv-from-url.ts` so the browser window doesn't open. That might help or not.

You will [need to install **bun**](https://bun.sh/) to run JavaScript code on your machine. Recent versions are needed or the script will fail. Then:

1. Clone this repo
2. Enter the cloned repo with your terminal
3. Add all the artwork links you want to process to `data/pixiv/manual_process_urls.txt`, one per line.
4. Run `bun install`
5. Run `bun run archive`
6. Watch stuff being scraped and don't mess with the opening windows (you can change `headless`
   to `true` in `src/lib/pixiv-from-url.ts` so the browser windows don't open).

> [!CAUTION]
> If you don't know what any of this means, consider sponsoring [FujoCoded](https://fujocoded.com/) on
> [Patreon](https://www.patreon.com/essentialrandomness). We're working on making this type of coding
> knowledge accessible to beginners.

### Scraping URLs again

Already-scraped URLs will be skipped, so you can just keep appending to the file. To scrape old URLs again
you must delete the corresponding folder. The folder format is `publication_date/artwork_id`.

### Retrying failed URLs.

Re-run the script `bun run archive`. Already-scraped URLs will be skipped.

### Logged-in-only artworks

> [!WARNING]
> Running an archiver with a logged in account increases the chances of your accounts being banned. Do it
> at your own risk.

If an artwork is logged-in-only the script will pause to give you time to log in. Once you log in, the archiver
will try that link again, will continue to the following ones while staying logged in to that account (so you
don't need to log in again).

If you don't want to log in, simply close the window. The script will fail that URL and continue to the next
one.

**Suggestion:** If you want to scrape logged-in-only artworks, do one pass with the _other_ archives first,
then another pass with _only_ the logged-in ones. This way you reduce your risk of banning.
