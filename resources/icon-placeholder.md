# Icon TODO

You need to create a 128x128 PNG icon for the VS Code Marketplace.

## Quick Options:

1. **Use an online converter:**
   - Go to https://cloudconvert.com/svg-to-png
   - Upload `resources/voight-logo-v2-32x32.svg`
   - Set dimensions to 128x128
   - Download and save as `resources/icon.png`

2. **Use Inkscape (free):**
   ```bash
   inkscape resources/voight-logo-v2-32x32.svg --export-type=png --export-filename=resources/icon.png -w 128 -h 128
   ```

3. **Use GIMP/Photoshop:**
   - Open the SVG
   - Resize to 128x128
   - Export as PNG

Once created, delete this file and the icon will be automatically included in the extension package.
