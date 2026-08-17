from pathlib import Path
from PIL import Image

source = Path('/home/ubuntu/rawdativ2/resources/play-feature-source.png')
target = Path('/home/ubuntu/rawdativ2/release/RawdhaPlus-google-play-feature-graphic.png')
target.parent.mkdir(parents=True, exist_ok=True)

with Image.open(source) as image:
    # The source was composed with the main activity centred and safe margins.
    target_ratio = 1024 / 500
    source_ratio = image.width / image.height
    if source_ratio > target_ratio:
        crop_width = round(image.height * target_ratio)
        left = (image.width - crop_width) // 2
        crop = image.crop((left, 0, left + crop_width, image.height))
    else:
        crop_height = round(image.width / target_ratio)
        top = (image.height - crop_height) // 2
        crop = image.crop((0, top, image.width, top + crop_height))
    graphic = crop.resize((1024, 500), Image.Resampling.LANCZOS)
    graphic.save(target, 'PNG', optimize=True)
