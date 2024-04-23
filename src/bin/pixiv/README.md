# Executable scripts

This folder contains the scripts that fetch data from Pixiv.

## Setting up your data

You will need to create a `/data/pixiv/manual_process_urls.txt` file with the address of
one Pixiv gallery per line.

## Running the script

Run `bun run src/bin/pixiv/process-urls.ts`. This will go through each line of the file
and attempt to download the content of the gallery.
