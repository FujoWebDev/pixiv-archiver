import {
  request,
  type Browser,
  type Locator,
  type Page,
  type Request,
} from "playwright";

import { chromium } from "playwright-extra";
import stealth from "puppeteer-extra-plugin-stealth";

const createImageRequestsMap = (page: Page) => {
  const currentRequests = new Map<string, Request>();
  const requestHandler = async (request: Request) => {
    try {
      if (request.url().startsWith("https://i.pximg.net/")) {
        currentRequests.set(request.url(), request);
      }
    } catch (e) {
      console.error(e);
    }
  };
  page.on("requestfinished", requestHandler);

  return currentRequests;
};

export const getBrowser = async () => {
  chromium.use(stealth());
  return await chromium.launch({
    headless: false,
    // headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXEC_PATH,
  });
};

export const destroyBrowser = async (browser: Browser) => {
  return await browser.close();
};

const getAllAlbumImagesWithScrolling = async (page: Page) => {
  let toScroll = 0;
  let hasScrolled = false;
  do {
    toScroll = await page.evaluate(() =>
      Math.ceil(
        document.documentElement.clientHeight +
          document.documentElement.scrollTop
      )
    );
    const imageLocators = await page
      .locator('[role="presentation"]')
      .locator("img")
      .last();
    await imageLocators.scrollIntoViewIfNeeded();
    // Wait 2 seconds for scrolling to actually happen
    await Bun.sleep(2000);
    // Check if we have scrolled. If we did not, then the last image is the
    // last image in the album
    const newScroll = await page.evaluate(() =>
      Math.ceil(
        document.documentElement.clientHeight +
          document.documentElement.scrollTop
      )
    );
    hasScrolled = toScroll !== newScroll;
  } while (hasScrolled);

  return await page.locator('[role="presentation"]').locator("img").all();
};

const getAllReadingImagesWithScrolling = async (page: Page) => {
  let hasScrolled = false;
  do {
    const imageLocators = await page
      .locator(".gtm-expand-full-size-illust img")
      .all();
    const imagesQuantity = imageLocators.length;
    await imageLocators[imageLocators.length - 1].scrollIntoViewIfNeeded();
    // Wait 2 seconds for scrolling to actually happen
    await Bun.sleep(2000);
    // Check if we have scrolled. If we did not, then the last image is the
    // last image in the album
    const newImagesQuantity = await page
      .locator(".gtm-expand-full-size-illust img")
      .all();
    hasScrolled = imagesQuantity !== newImagesQuantity.length;
  } while (hasScrolled);

  return await page.locator(".gtm-expand-full-size-illust img").all();
};

const getImagesFromResponse = async (
  imageLocators: Locator[],
  imageRequests: Map<string, Request>
) => {
  return (
    await Promise.all(
      imageLocators.map(async (locator) => {
        const src = (await locator.getAttribute("src"))!;
        const response = await imageRequests.get(src!)?.response();
        if (!response) {
          console.error("Couldn't find a response for ", src);
          return;
        }
        return {
          src: src,
          buffer: await response.body(),
        };
      })
    )
  ).filter(Boolean);
};

const PREVIEW_INDICATOR_LOCATOR = '[aria-label="Preview"]';
const getPageType = async (page: Page) => {
  // Wait one second for it all to settle
  await Bun.sleep(1000);
  if (
    (
      await page
        .locator("main figure span", {
          hasText:
            "This work cannot be displayed as it may contain sensitive content",
        })
        .all()
    ).length
  ) {
    return "sensitive";
  }
  const isPreview = await page.locator(PREVIEW_INDICATOR_LOCATOR).all();
  if (!isPreview.length) {
    return "single";
  }
  const continueIndicator = await page
    .getByText("Show all")
    .or(page.getByText("Reading works"))
    .allTextContents();
  if (continueIndicator[0].trim() === "Show all") {
    return "album";
  } else if (continueIndicator[0].trim() === "Reading works") {
    return "reading";
  } else {
    throw new Error("unknown page type");
  }
};

const DESCRIPTION_LOCATOR = "figcaption p";
const TAGS_LOCATOR = "footer li a";
const CREATED_AT_TIME_LOCATOR = "figcaption time";
const AUTHOR_ANCHOR_LOCATOR = "aside h2 a:not(:has(img))";
let loggedInState:
  | Awaited<ReturnType<ReturnType<Page["context"]>["storageState"]>>
  | undefined;
export const getAlbumData = async (
  url: string,
  browser: Browser
): Promise<{
  text: string;
  createdAt: Date;
  author: string;
  tags: string[];
  authorLink: string | null;
  images: {
    src: string;
    buffer: Buffer;
  }[];
}> => {
  console.log("Getting album data for ", url);
  console.log("Cookies: ", loggedInState?.cookies.length);
  // TODO: Only keep cookies for stuff that's sensitive
  const page = await browser.newPage({ storageState: loggedInState });
  const imageRequests = createImageRequestsMap(page);
  await page.goto(url);

  try {
    const pageType = await getPageType(page);
    console.log("Found page type: ", pageType);
    if (pageType === "sensitive") {
      console.log("Go try to login");
      await page.waitForURL("https://accounts.pixiv.net/**");
      await page.waitForURL(url);
      console.log("Logged in, probably.");
      console.log("Saving context and restarting attempt.");
      loggedInState = await page.context().storageState();
      await page.close();
      return await getAlbumData(url, browser);
    }

    const text = (
      await Promise.all(
        (
          await page.locator(DESCRIPTION_LOCATOR).all()
        ).map(async (p) => await p.textContent())
      )
    ).join("\n");
    const tags = (
      await Promise.all(
        (
          await page.locator(TAGS_LOCATOR).all()
        ).map(async (li) => await li.textContent())
      )
    ).filter(Boolean);
    const createdAt = await (
      await page.locator(CREATED_AT_TIME_LOCATOR).first()
    ).getAttribute("datetime");
    const authorElement = await page.locator(AUTHOR_ANCHOR_LOCATOR).first();
    const author = await authorElement.innerText();
    const authorLink = await authorElement.getAttribute("href");
    // Show all the images in the page
    // TODO: is this button always there?
    // .or(page.getByText("Reading works"))
    // document.querySelectorAll('.gtm-expand-full-size-illust')
    // Note: some have more than one image and need to be stitched together
    let images: {
      src: string;
      buffer: Buffer;
    }[] = [];
    if (pageType === "album") {
      await page.getByText("Show all").click();
      const imageLocators = await getAllAlbumImagesWithScrolling(page);
      images = await getImagesFromResponse(imageLocators, imageRequests);
    } else if (pageType === "single") {
      const imageLocators = await page
        .locator('[role="presentation"]')
        .locator("img")
        .all();
      images = await getImagesFromResponse(imageLocators, imageRequests);
    } else if (pageType === "reading") {
      console.log("Reading works");
      await page.getByText("Reading works").first().click({
        // We force the click so that this will work even if the element is
        // not actually in the page (because the reading gallery is already
        // open) and just let us continue
        force: true,
      });
      await Bun.sleep(1000);
      const imageLocators = await getAllReadingImagesWithScrolling(page);

      images = await getImagesFromResponse(imageLocators, imageRequests);
    }
    return {
      text,
      createdAt: new Date(createdAt!),
      author,
      tags,
      authorLink,
      images,
    };
  } finally {
    await page.close();
  }
};
