# How to Add Your App Icon/Favicon

Place your icon files in this `public/` directory with the following names:

## Required Files:

1. **favicon.ico** (16x16 or 32x32)
   - Classic favicon for browser tabs
   - Can be generated from a PNG using online tools like favicon.io

2. **icon.png** (32x32 pixels)
   - Modern PNG icon for browser tabs
   - Should be a square image with transparent background

3. **apple-icon.png** (180x180 pixels)
   - Used when users save your site to their iPhone/iPad home screen
   - Should be a square image

## Quick Setup:

If you have a single square logo (512x512 or larger), you can:

1. Use https://favicon.io/favicon-converter/ to generate all sizes
2. Download the zip file
3. Extract and place the files in `/frontend/public/`
4. Restart your dev server

## File Structure:
```
frontend/
  public/
    favicon.ico          ← Browser tab icon
    icon.png             ← Modern browser icon
    apple-icon.png       ← iOS home screen icon
    images/
      carousel/
        ...
```

The metadata is already configured in `src/app/layout.tsx` to use these files!
