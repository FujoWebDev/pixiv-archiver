const ALBUM_ID_FROM_URL_REGEX = /www.pixiv.net\/en\/artworks\/([0-9]+)/;
export const getAlbumIdFromUrl = (albumUrl: string) => {
  return albumUrl.match(ALBUM_ID_FROM_URL_REGEX)?.[1];
};

export const getAlbumDirectory = ({
  createdAt,
  id,
}: {
  createdAt: Date;
  id: string;
}) => {
  // Use `en-CA` for the `-` separator
  const dateFolder = createdAt.toLocaleDateString("en-CA", {
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
  });

  return `src/content/pixiv/${dateFolder}/${id}/`;
};
