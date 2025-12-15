from gtts import gTTS
import os

# Flow Video Script - Voiceover Segments
# Each segment corresponds to a scene in the video

voiceover_segments = [
    {
        "name": "01_intro",
        "text": "This is Flow. A new way to bring rhythm, balance, and focus to your daily life."
    },
    {
        "name": "02_setup",
        "text": "Start by finding your rhythm. Define your anchors—when you work, when you rest, and the rituals that keep you grounded."
    },
    {
        "name": "03_building",
        "text": "Input your tasks. Priorities for focus, chores for maintenance, and flex blocks for you. Categorize them to see where your energy goes."
    },
    {
        "name": "04_auto_schedule",
        "text": "Hit generate. Flow intelligently stacks your day, respecting your meals and rituals, giving you a realistic plan in seconds."
    },
    {
        "name": "05_living_day",
        "text": "Life moves fast. Mark tasks done, or skip them if plans change. Flow adapts instantly so you never lose your stride."
    },
    {
        "name": "06_reflection",
        "text": "End each day with a moment of reflection. Track your mood, note your wins, and rest easy. This is Flow."
    }
]

# Output directory
output_dir = "voiceovers"
os.makedirs(output_dir, exist_ok=True)

# Generate individual segment audio files
print("Generating voiceover segments...\n")
for segment in voiceover_segments:
    filename = f"{output_dir}/{segment['name']}.mp3"
    tts = gTTS(text=segment["text"], lang='en', tld='com')
    tts.save(filename)
    print(f"✓ Created: {filename}")

# Also generate a combined full script
full_script = " ".join([s["text"] for s in voiceover_segments])
combined_filename = f"{output_dir}/full_voiceover.mp3"
tts_full = gTTS(text=full_script, lang='en', tld='com')
tts_full.save(combined_filename)
print(f"\n✓ Created combined: {combined_filename}")

print(f"\n🎬 All voiceovers saved to '{output_dir}/' folder!")
print("\n--- Full Script ---")
print(full_script)

# Optional: Play the intro to test
os.system(f"afplay {output_dir}/full_voiceover.mp3")