# Plan

I'm doing a 100km walk from London to Brighton. I want to build an app to visualize where I am on the route, and see how I'm doing compared to previous years.

## Data sources

- `./data/2021.tcx` and `./data/2022.tcx` - previous years data, in TCX format
- `./data/2026.kmz` - the route for this year.

Although each challenge was 100km, they tracked at slightly different lengths due to GPS inaccuracies.

The route itself is also slightly different each year.

## Comparing progress

The setting-off time is different each year, but I want to compare progress. A constant for the setting off time in 2026 should be saved to a constant, set to 7am 23rd May 2026 (BST).

Previous years data should be normalized to the same time, so that I can compare progress at the same time of day.

Progress should be shown as a percentage of the total distance for that year.

Progress for 2026 should be shown as a percentage of the 2026 route, by looking at GPS coordinates and calculating the distance along the route.

If there's a better way to handle this, I'm open to suggestions.

## The UI

### Map

A map should be shown that displays:

- The 2021 route in red.
- The 2022 route in yellow.
- The 2026 route in green.
- An icon showing the current GPS location.
- An icon showing the positions for the 2021 and 2022 attempts if they set off at the same time.

### Overlay

- Three bars showing the percentage progress for each year, had they set off at the same time.
- A time delta for the current attempt vs the previous attempts, showing how much ahead or behind I am compared to previous years.

### Share button

A share button which shares a URL with params for the current time and location. When these params are present, they're used rather than the current time & GPS location. The app should not ask for GPS permissions if the data is provided via the URL.

## Performance

The app should be performant on mobile devices, and should not consume excessive battery.

The app should not use CPU when it's in the background.

Data (such as the tcx files) should be processed by the build process so the minimal amount of data is downloaded by the browser. It should also be provided in a way that's easy for the client to parse.
