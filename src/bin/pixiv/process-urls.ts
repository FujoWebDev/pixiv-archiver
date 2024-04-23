import {
  destroyBrowser,
  getAlbumData,
  getBrowser,
} from "../../lib/pixiv-from-url";
import { getAlbumDirectory, getAlbumIdFromUrl } from "../../lib/process-pixiv";

import joinImages from "join-images";
import { stringify } from "yaml";

const path = "data/pixiv/manual_process_urls.txt";
const file = Bun.file(path);
const text = await file.text();

const urls = text.split("\n");

const browser = await getBrowser();

const glob = new Bun.Glob("src/content/pixiv/*/*/index.yaml");
const PROCESSED_ALBUMS = new Map<string, boolean>();
Array.from(glob.scanSync(".")).forEach((path) => {
  const folder = path.substring(0, path.length - "/index.yaml".length);
  const tweetId = folder.substring(folder.lastIndexOf("/") + 1);
  PROCESSED_ALBUMS.set(tweetId, true);
  return tweetId;
});

// If we get skipped back we haven't made any request so we know that we can skip
// the processing of this tweet
const SKIPPED = Symbol("skipped");
let processed = 0;
const failedUrls: string[] = [];

const getAlbums = function* () {
  for (let albumUrl of urls) {
    const albumId = getAlbumIdFromUrl(albumUrl);
    if (albumId && !PROCESSED_ALBUMS.has(albumId)) {
      yield albumUrl;
    } else {
      processed++;
    }
  }
};

let QUEUE = [];
const albumsGenerator = getAlbums();
try {
  while (true) {
    // Add to queue
    for (let i = 0; i < 1; i++) {
      const album = albumsGenerator.next();
      if (album.done) {
        break;
      }
      const url = album.value;
      const albumId = getAlbumIdFromUrl(url);
      if (!albumId) {
        console.error(`Failed to get album id from url ${url}`);
        processed++;
        failedUrls.push(url);
        break;
      }
      QUEUE.push(album.value);
    }
    if (QUEUE.length === 0) {
      console.log("No more urls to process");
      // Nothing left to process
      break;
    }
    // Process queue
    const results = await Promise.all(
      QUEUE.map(async (url) => {
        processed++;
        try {
          console.log(`Processing pixiv album with url ${url}`);
          const albumId = getAlbumIdFromUrl(url)!;
          const data = await getAlbumData(url, browser);

          const albumOutDir = getAlbumDirectory({
            createdAt: data.createdAt,
            id: albumId,
          });

          // Save all images
          // Some images might have more than one original image and need to be stitched together
          const imageUrls: Map<string, Buffer[]> = new Map();
          data.images.forEach(async (image) => {
            const relativeImageUrl =
              "./images/" + image.src.substring(image.src.lastIndexOf("/") + 1);
            if (!imageUrls.has(relativeImageUrl)) {
              imageUrls.set(relativeImageUrl, []);
            }
            imageUrls.get(relativeImageUrl)?.push(image.buffer);
          });
          Array.from(imageUrls.entries()).map(
            async ([relativeImageUrl, images]) => {
              const imageSrc = albumOutDir + relativeImageUrl;
              if (images.length === 1) {
                return await Bun.write(imageSrc, images[0]);
              } else {
                return await (
                  await joinImages(images, {
                    direction: "vertical",
                  })
                ).toFile(imageSrc);
              }
            }
          );
          const albumDataFile = Bun.file(albumOutDir + "index.yaml");
          console.log("Writing to ", albumDataFile.name);
          Bun.write(
            albumDataFile,
            stringify({
              url,
              id: albumId,
              text: data.text,
              date: data.createdAt,
              author: data.author,
              author_url: data.authorLink,
              images: imageUrls.keys(),
              last_fetched_at: new Date().toISOString(),
              tags: {
                original_tags: data.tags,
              },
            })
          );
          PROCESSED_ALBUMS.set(albumId, true);
        } catch (e) {
          console.log(`Failed to process album with url ${url}`);
          console.error(`Failed to process album with url ${url}`);
          failedUrls.push(url);
          console.error(e);
        }
      })
    );
    // Re-empty the queue
    QUEUE = [];
    console.log(`Processed ${processed} of ${urls.length}`);
    console.log("Sleeping for 5 seconds");
    await Bun.sleep(5000);
    console.log("Vroom vroom!");
  }
} finally {
  console.log("Failed urls\n", failedUrls.join("\n"));
  await destroyBrowser(browser);
}

// Makes this file a module
export {};
