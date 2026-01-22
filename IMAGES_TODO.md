# Images TODO

## Current Status

The following images are currently using **temporary placeholders** copied from `IMG_20260121_143212.png`:

- ✅ `logo.png` - Using IMG_20260121_143212.png (FINAL)
- ⚠️ `splash.png` - **TEMPORARY** placeholder (needs proper design)
- ⚠️ `og-image.png` - **TEMPORARY** placeholder (needs proper design)

## Required Image Specifications

### 1. Splash Screen (`splash.png`)

**Purpose:** Displayed when the Farcaster mini app first loads

**Specifications:**
- **Dimensions:** 1080x1920px (portrait orientation)
- **Format:** PNG with transparency support
- **File size:** Optimize for web (< 500KB recommended)
- **Design guidelines:**
  - Toad-themed and aligned with KnownToads branding
  - Use splash background color: `#dcfce7` (light green)
  - Should be visually appealing during app startup
  - Include KnownToads logo/branding
  - Consider adding tagline: "Open address book for the toadgang crypto community"

### 2. Open Graph Image (`og-image.png`)

**Purpose:** Social sharing preview image (Twitter, Discord, etc.)

**Specifications:**
- **Dimensions:** 1200x630px (landscape orientation)
- **Format:** PNG or JPEG
- **File size:** Optimize for web (< 300KB recommended)
- **Design guidelines:**
  - Toad-themed and visually engaging
  - Include KnownToads branding/logo
  - Add descriptive text about the app
  - Consider including: "🐸 KnownToads - Toadgang Directory"
  - Ensure text is readable at small sizes
  - Follow social media best practices for OG images

## Design Assets

**Existing assets you can reference:**
- `logo.png` / `IMG_20260121_143212.png` - Main toad logo
- `favicon.svg` - Toad favicon
- Brand colors: Green theme (e.g., `#dcfce7` for backgrounds)

## Next Steps

1. Design proper splash screen at 1080x1920px
2. Design proper OG image at 1200x630px
3. Replace `splash.png` and `og-image.png` with final designs
4. Test loading in Farcaster app and social media sharing
5. Delete this TODO file once proper images are in place

## Notes

- The manifest file (`public/.well-known/farcaster.json`) references these images
- Images are served from: `https://known-toads.vercel.app/`
- Ensure images are optimized for fast loading on mobile devices
