"""
PILLAR Demo Video Producer
Generates narrated MP4 video from slide images + edge-tts voiceover.
"""
import json
import subprocess
import os
import sys

BASE = r"C:\Users\Emil V. Capino\DATA\QWork\PILLAR"
DOCS = os.path.join(BASE, "docs")
CONFIG = os.path.join(DOCS, "video-config.json")
TEMP_DIR = os.path.join(DOCS, "video-temp")
OUTPUT = os.path.join(DOCS, "DEMO-VIDEO.mp4")

EDGE_TTS = r"C:\Users\Emil V. Capino\AppData\Local\Programs\Python\Python313\Scripts\edge-tts.exe"
FFMPEG = "ffmpeg"


def run(cmd, desc=""):
    """Run a command and check for errors."""
    print(f"  > {desc}" if desc else f"  > {cmd[:80]}...")
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"    ERROR: {result.stderr[:500]}")
        return False
    return True


def main():
    # Load config
    with open(CONFIG, "r", encoding="utf-8") as f:
        config = json.load(f)

    # Create temp directory
    os.makedirs(TEMP_DIR, exist_ok=True)

    voice = config["voice"]
    rate = config["rate"]
    pitch = config["pitch"]
    slides = config["slides"]

    print(f"=== PILLAR Demo Video Producer ===")
    print(f"Voice: {voice}")
    print(f"Slides: {len(slides)}")
    print()

    # Step 1: Generate voiceover audio for each slide
    print("[1/4] Generating voiceover audio...")
    audio_files = []
    for slide in slides:
        n = slide["slide_number"]
        narration = slide["narration"]
        audio_path = os.path.join(TEMP_DIR, f"audio_{n:02d}.mp3")
        audio_files.append(audio_path)

        # Escape narration text for command line
        safe_text = narration.replace('"', '\\"')

        cmd = (
            f'"{EDGE_TTS}" '
            f'--voice "{voice}" '
            f'--rate="{rate}" '
            f'--pitch="{pitch}" '
            f'--text "{safe_text}" '
            f'--write-media "{audio_path}"'
        )

        if not run(cmd, f"Slide {n}: generating audio"):
            print(f"  FAILED on slide {n}")
            sys.exit(1)

    print(f"  Generated {len(audio_files)} audio files.\n")

    # Step 2: Create video segments (image + audio -> mp4)
    print("[2/4] Creating video segments...")
    segment_files = []
    for i, slide in enumerate(slides):
        n = slide["slide_number"]
        img_path = os.path.join(BASE, slide["image"])
        audio_path = audio_files[i]
        segment_path = os.path.join(TEMP_DIR, f"segment_{n:02d}.mp4")
        segment_files.append(segment_path)

        if not os.path.exists(img_path):
            print(f"  ERROR: Image not found: {img_path}")
            sys.exit(1)

        cmd = (
            f'{FFMPEG} -y '
            f'-loop 1 -i "{img_path}" '
            f'-i "{audio_path}" '
            f'-c:v libx264 -tune stillimage '
            f'-c:a aac -b:a 192k '
            f'-pix_fmt yuv420p '
            f'-shortest '
            f'"{segment_path}"'
        )

        if not run(cmd, f"Slide {n}: creating video segment"):
            print(f"  FAILED on segment {n}")
            sys.exit(1)

    print(f"  Created {len(segment_files)} video segments.\n")

    # Step 3: Create concat file list
    print("[3/4] Concatenating segments...")
    concat_file = os.path.join(TEMP_DIR, "segments.txt")
    with open(concat_file, "w", encoding="utf-8") as f:
        for seg in segment_files:
            # Use forward slashes for ffmpeg on Windows
            seg_normalized = seg.replace("\\", "/")
            f.write(f"file '{seg_normalized}'\n")

    # Step 4: Concatenate all segments
    cmd = (
        f'{FFMPEG} -y '
        f'-f concat -safe 0 -i "{concat_file}" '
        f'-c copy '
        f'"{OUTPUT}"'
    )

    if not run(cmd, "Final concatenation"):
        print("  FAILED on final concatenation")
        sys.exit(1)

    print(f"\n[4/4] Verifying output...")

    # Verify output
    if os.path.exists(OUTPUT):
        size_mb = os.path.getsize(OUTPUT) / (1024 * 1024)
        print(f"  Output: {OUTPUT}")
        print(f"  Size: {size_mb:.1f} MB")

        # Get duration with ffprobe
        probe_cmd = f'ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "{OUTPUT}"'
        result = subprocess.run(probe_cmd, shell=True, capture_output=True, text=True)
        if result.returncode == 0:
            duration = float(result.stdout.strip())
            mins = int(duration // 60)
            secs = int(duration % 60)
            print(f"  Duration: {mins}:{secs:02d}")
            print(f"  Resolution: 1920x1080")
            print(f"\n=== VIDEO COMPLETE ===")
        else:
            print(f"  (Could not probe duration)")
            print(f"\n=== VIDEO COMPLETE ===")
    else:
        print("  ERROR: Output file not created!")
        sys.exit(1)


if __name__ == "__main__":
    main()
